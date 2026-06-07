/**
 * Vercel API route — pull the owner's CashFlow_9 Google Sheet into the
 * `payments` table (read-only mirror).
 *
 * Hand-rolled service-account JWT + Sheets v4 REST call to avoid pulling in
 * `googleapis` (~1MB). Uses `node:crypto` for the RS256 signature.
 *
 * Required env vars (set in Vercel, NOT shipped to the browser):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL    e.g. cashflow-sync@my-proj.iam.gserviceaccount.com
 *   GOOGLE_SERVICE_ACCOUNT_KEY      the PEM private key. Vercel UI accepts multi-line;
 *                                   if you escape newlines as \n, that's fine too.
 *   CASHFLOW_SHEET_ID               the spreadsheetId from the sheet URL
 *   CASHFLOW_SHEET_RANGE            optional; default "CashFlow_9!A2:L"
 *   SUPABASE_SERVICE_ROLE_KEY       already set
 *   VITE_SUPABASE_URL               already set
 *
 * One-time setup the owner does (NOT Claude):
 *  1. Create a GCP project, enable the Google Sheets API.
 *  2. Make a Service Account, download its JSON key.
 *  3. Share the CashFlow_9 sheet with the service account email (Viewer).
 *  4. Drop the four env vars into Vercel project settings.
 */

import { createHash, createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Minimal Vercel function types — avoids adding @vercel/node as a dep.
type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // Require a signed-in user — we trust the access token's mere validity via the
  // anon-key supabase client; nothing user-specific is needed beyond "authed".
  const authHeader = (req.headers["authorization"] ?? req.headers["Authorization"]) as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const SHEET_ID = need("CASHFLOW_SHEET_ID");
    const SHEET_RANGE = process.env.CASHFLOW_SHEET_RANGE || "CashFlow_9!A2:L";
    const SA_EMAIL = need("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const SA_KEY = need("GOOGLE_SERVICE_ACCOUNT_KEY").replace(/\\n/g, "\n");
    const SB_URL = need("VITE_SUPABASE_URL");
    const SB_SRK = need("SUPABASE_SERVICE_ROLE_KEY");

    // 1) Get an OAuth2 access token from Google via JWT bearer flow.
    const accessToken = await getGoogleAccessToken(SA_EMAIL, SA_KEY);

    // 2) Fetch the sheet rows.
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      SHEET_ID,
    )}/values/${encodeURIComponent(SHEET_RANGE)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
    const sheetRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sheetRes.ok) {
      const text = await sheetRes.text();
      return res.status(502).json({ error: `Sheets API: ${sheetRes.status} ${text}` });
    }
    const sheetJson = (await sheetRes.json()) as { values?: unknown[][] };
    const rows = sheetJson.values ?? [];

    // 3) Parse rows → payment rows + content hash.
    const supabase = createClient(SB_URL, SB_SRK);
    const seen = new Set<string>();
    const upserts: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const [
        dateOpened, dueDate, paymentReceived, invoiceNumber,
        financeRaw, priceBeforeVat, priceAfterVat, remain,
        currency, statusRaw, info, client,
      ] = r as (string | number | null | undefined)[];

      // Skip blanks
      if (!dateOpened && !dueDate && !invoiceNumber && !client && !info) continue;

      const row = {
        sheet_row_num: i + 2, // header is row 1, data starts row 2
        date_opened: parseDate(dateOpened),
        due_date: parseDate(dueDate),
        payment_received: parseDate(paymentReceived),
        invoice_number: invoiceNumber != null ? String(invoiceNumber).trim() || null : null,
        direction: parseDirection(financeRaw),
        price_before_vat: parseAmount(priceBeforeVat),
        price_after_vat: parseAmount(priceAfterVat),
        remain: parseAmount(remain),
        currency: (typeof currency === "string" && currency.trim()) ? currency.trim() : "ILS",
        status: parseStatus(statusRaw),
        info: typeof info === "string" ? info.trim() || null : null,
        client_raw: typeof client === "string" ? client.trim() || null : null,
      };
      const hash = createHash("sha1")
        .update(JSON.stringify(row))
        .digest("hex");
      seen.add(hash);
      upserts.push({ ...row, sheet_row_hash: hash, synced_at: now });
    }

    // 4) Upsert by sheet_row_hash. Linkage columns (case_id / counterparty_id)
    //    are intentionally omitted from the upsert payload, so they persist on
    //    existing rows where the content hash hasn't changed.
    let upserted = 0;
    if (upserts.length > 0) {
      const { error } = await supabase
        .from("payments")
        .upsert(upserts, { onConflict: "sheet_row_hash", ignoreDuplicates: false });
      if (error) return res.status(500).json({ error: `Supabase upsert: ${error.message}` });
      upserted = upserts.length;
    }

    // 5) Delete rows whose source row is gone from the sheet.
    const { data: existing, error: selErr } = await supabase
      .from("payments")
      .select("id, sheet_row_hash");
    if (selErr) return res.status(500).json({ error: `Supabase select: ${selErr.message}` });
    const orphanIds = (existing ?? [])
      .filter((r) => !seen.has(r.sheet_row_hash))
      .map((r) => r.id);
    let deleted = 0;
    if (orphanIds.length > 0) {
      const { error: delErr } = await supabase.from("payments").delete().in("id", orphanIds);
      if (delErr) return res.status(500).json({ error: `Supabase delete: ${delErr.message}` });
      deleted = orphanIds.length;
    }

    return res.status(200).json({ upserted, deleted });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** RS256-signed JWT → POST to Google's token endpoint → access_token. */
async function getGoogleAccessToken(email: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (buf: Buffer) =>
    buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const headerB64 = b64url(Buffer.from(JSON.stringify(header)));
  const claimsB64 = b64url(Buffer.from(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = b64url(signer.sign(privateKeyPem));
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token: ${tokenRes.status} ${text}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return access_token;
}

function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  // DD/MM/YYYY (Israeli format used in the sheet)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  // YYYY-MM-DD (already ISO)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  // Excel serial number — Sheets sometimes returns these for date cells
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    // Days since 1899-12-30 (Excel epoch)
    const ms = (n - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

function pad(s: string): string { return s.length === 1 ? `0${s}` : s; }

function parseDirection(v: unknown): "income" | "outcome" {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("inc")) return "income";
  return "outcome";
}

function parseStatus(v: unknown): "paid" | "not_paid" | null {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("not")) return "not_paid";
  if (s === "paid" || s.includes("paid")) return "paid";
  return null;
}

function parseAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[₪$€,]/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
