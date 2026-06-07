import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, Link2 } from "lucide-react";
import {
  listCases,
  listCounterparties,
  listPayments,
  syncPaymentsFromSheet,
  updatePaymentLinkage,
  type CaseWithRelations,
  type PaymentWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import type { Counterparty, PaymentDirection, PaymentStatus } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DirFilter = "all" | PaymentDirection;
type StatusFilter = "all" | PaymentStatus;

export function PaymentsPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<PaymentWithRefs[] | null>(null);
  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [dir, setDir] = useState<DirFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    listPayments().then(setRows).catch((e) => setError(e.message));
    listCases().then(setCases).catch(() => setCases([]));
    listCounterparties().then(setCounterparties).catch(() => setCounterparties([]));
  }, []);

  async function refresh() { setRows(await listPayments()); }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const r = await syncPaymentsFromSheet();
      setSyncResult(t("payments.synced", { upserted: r.upserted, deleted: r.deleted }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function updateLink(id: string, patch: { case_id?: string | null; counterparty_id?: string | null }) {
    await updatePaymentLinkage(id, patch);
    await refresh();
  }

  // Filters + totals
  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (dir !== "all" && r.direction !== dir) return false;
      if (status !== "all" && r.status !== status) return false;
      return true;
    });
  }, [rows, dir, status]);

  const totals = useMemo(() => {
    const m = { income: 0, outcome: 0, openIncome: 0, openOutcome: 0 };
    for (const r of rows ?? []) {
      const a = Number(r.price_after_vat ?? 0);
      if (r.direction === "income") {
        m.income += a;
        if (r.status !== "paid") m.openIncome += a;
      } else {
        m.outcome += a;
        if (r.status !== "paid") m.openOutcome += a;
      }
    }
    return m;
  }, [rows]);

  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("payments.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("payments.subtitle")}</p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? t("payments.syncing") : t("payments.syncFromSheet")}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {syncResult && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-200">{syncResult}</p>
      )}

      {/* Totals strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <TotalCard label={t("payments.totalIncome")} value={money(totals.income)} tone="emerald" icon={<ArrowDownCircle className="size-5" />} />
        <TotalCard label={t("payments.openIncome")} value={money(totals.openIncome)} tone="amber" icon={<ArrowDownCircle className="size-5" />} />
        <TotalCard label={t("payments.totalOutcome")} value={money(totals.outcome)} tone="red" icon={<ArrowUpCircle className="size-5" />} />
        <TotalCard label={t("payments.openOutcome")} value={money(totals.openOutcome)} tone="amber" icon={<ArrowUpCircle className="size-5" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={dir === "all"} onClick={() => setDir("all")}>{t("common.all")}</FilterPill>
        <FilterPill active={dir === "income"} onClick={() => setDir("income")} dotClass="bg-emerald-500">
          {t("payments.income")}
        </FilterPill>
        <FilterPill active={dir === "outcome"} onClick={() => setDir("outcome")} dotClass="bg-red-500">
          {t("payments.outcome")}
        </FilterPill>
        <span className="mx-2 h-5 w-px bg-border" />
        <FilterPill active={status === "all"} onClick={() => setStatus("all")}>{t("common.all")}</FilterPill>
        <FilterPill active={status === "not_paid"} onClick={() => setStatus("not_paid")}>{t("payments.notPaid")}</FilterPill>
        <FilterPill active={status === "paid"} onClick={() => setStatus("paid")}>{t("payments.paid")}</FilterPill>
      </div>

      {/* Table */}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("payments.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-start">{t("payments.due")}</th>
                <th className="px-3 py-2 text-start">{t("payments.direction")}</th>
                <th className="px-3 py-2 text-start">{t("payments.client")}</th>
                <th className="px-3 py-2 text-start">{t("payments.invoice")}</th>
                <th className="px-3 py-2 text-end">{t("payments.amount")}</th>
                <th className="px-3 py-2 text-start">{t("payments.status")}</th>
                <th className="px-3 py-2 text-start">{t("payments.case")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50/60">
                  <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                    {p.due_date ? formatDate(p.due_date, lang) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.direction === "income" ? (
                      <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        ↓ {t("payments.income")}
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 ring-1 ring-red-200">
                        ↑ {t("payments.outcome")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="truncate text-foreground">{p.client_raw ?? "—"}</div>
                    {p.info && (
                      <div className="truncate text-xs text-muted-foreground" title={p.info}>{p.info}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground" dir="ltr">{p.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2 text-end font-medium" dir="ltr">
                    {p.price_after_vat != null ? `${money(Number(p.price_after_vat))} ${p.currency ?? "ILS"}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.status === "paid" ? (
                      <Badge className="bg-green-50 text-green-700 ring-1 ring-green-200">{t("payments.paid")}</Badge>
                    ) : p.status === "not_paid" ? (
                      <Badge className="bg-amber-50 text-amber-700 ring-1 ring-amber-200">{t("payments.notPaid")}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CaseLinkPicker
                      payment={p}
                      cases={cases}
                      onChange={(caseId) => updateLink(p.id, { case_id: caseId })}
                    />
                    <CounterpartyLinkPicker
                      payment={p}
                      counterparties={counterparties}
                      onChange={(cpId) => updateLink(p.id, { counterparty_id: cpId })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── small components ────────────────────────────────────────────────────────

function TotalCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "emerald" | "red" | "amber";
  icon: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    red: "text-red-700 bg-red-50 ring-red-200",
    amber: "text-amber-700 bg-amber-50 ring-amber-200",
  };
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <span className={`inline-flex size-8 items-center justify-center rounded-lg ring-1 ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground" dir="ltr">₪ {value}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-all ${
        active
          ? "border-primary/30 bg-primary/10 font-semibold text-primary"
          : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground"
      }`}
    >
      {dotClass && <span className={`size-2 rounded-full ${dotClass}`} />}
      {children}
    </button>
  );
}

function CaseLinkPicker({
  payment,
  cases,
  onChange,
}: {
  payment: PaymentWithRefs;
  cases: CaseWithRelations[];
  onChange: (caseId: string | null) => void;
}) {
  const linked = payment.case;
  return (
    <div className="flex items-center gap-1">
      {linked ? (
        <Link to={`/cases/${linked.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Link2 className="size-3" /> {linked.title}
        </Link>
      ) : (
        <select
          value=""
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          <option value="">— link case —</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
      {linked && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-red-500"
          title="unlink"
        >
          ×
        </button>
      )}
    </div>
  );
}

function CounterpartyLinkPicker({
  payment,
  counterparties,
  onChange,
}: {
  payment: PaymentWithRefs;
  counterparties: Counterparty[];
  onChange: (id: string | null) => void;
}) {
  if (payment.counterparty) {
    return (
      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <span>· {payment.counterparty.name}</span>
        <button type="button" onClick={() => onChange(null)} className="hover:text-red-500" title="unlink">×</button>
      </div>
    );
  }
  return (
    <select
      value=""
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="mt-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
    >
      <option value="">— link counterparty —</option>
      {counterparties.map((cp) => (
        <option key={cp.id} value={cp.id}>{cp.name}</option>
      ))}
    </select>
  );
}
