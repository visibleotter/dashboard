import { supabase } from "@/lib/supabaseClient";
import type {
  Attachment,
  AttachmentEntityType,
  Case,
  CaseStatus,
  CaseType,
  Counterparty,
  CounterpartyKind,
  DocType,
  DocumentRow,
  Expense,
  OpCostCategory,
  OpCostEntry,
  OrderRow,
  Payment,
  PaymentDirection,
  PaymentStatus,
  PaymentMilestone,
  Payslip,
  Person,
  TaskPriority,
  TaskRow,
  TaxCert,
  WorkItem,
  WorkStatus,
} from "@/types/db";

/** Private Supabase Storage bucket for uploaded source files (created in 0003_storage.sql). */
export const DOCUMENTS_BUCKET = "documents";

/*
  Typed data-access helpers for Phase 3 (Case CRUD). Thin wrappers over the Supabase
  client; every call runs through the authed browser client and is gated by RLS. All
  helpers throw on error so callers can use try/catch.

  The dataset is small (one company), so list helpers fetch all rows and compute
  derived bits (e.g. child counts) client-side rather than with SQL aggregates.
*/

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---- case_types (read-only catalogue in this phase) ----

export async function listCaseTypes(): Promise<CaseType[]> {
  return unwrap(
    await supabase
      .from("case_types")
      .select("*")
      .eq("is_active", true)
      .order("group", { ascending: true })
      .order("name_he", { ascending: true }),
  );
}

// ---- counterparties ----

export async function listCounterparties(): Promise<Counterparty[]> {
  return unwrap(
    await supabase.from("counterparties").select("*").order("name", { ascending: true }),
  );
}

export async function createCounterparty(input: {
  name: string;
  kind: CounterpartyKind;
  country?: string | null;
  tax_id?: string | null;
  email?: string | null;
  notes?: string | null;
}): Promise<Counterparty> {
  return unwrap(
    await supabase.from("counterparties").insert(input).select("*").single(),
  );
}

// ---- cases ----

export interface CaseWithRelations extends Case {
  case_type: CaseType | null;
  counterparty: Counterparty | null;
  /** Number of cases whose parent_id === this case's id. Computed client-side. */
  child_count: number;
}

const CASE_SELECT = "*, case_type:case_types(*), counterparty:counterparties(*)";

export async function listCases(): Promise<CaseWithRelations[]> {
  const rows = unwrap<(Case & { case_type: CaseType | null; counterparty: Counterparty | null })[]>(
    await supabase
      .from("cases")
      .select(CASE_SELECT)
      .order("created_at", { ascending: false }),
  );

  const childCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.parent_id) childCounts.set(r.parent_id, (childCounts.get(r.parent_id) ?? 0) + 1);
  }

  return rows.map((r) => ({ ...r, child_count: childCounts.get(r.id) ?? 0 }));
}

/** A case plus its case_type, counterparty name, and the doc_types of its documents. */
export interface CaseWithDocs extends Case {
  case_type: CaseType | null;
  counterparty: Pick<Counterparty, "id" | "name"> | null;
  documents: Pick<DocumentRow, "doc_type" | "extraction_status">[];
}

/** One fetch powering the dashboard + list completeness engine. */
export async function listCasesWithDocs(): Promise<CaseWithDocs[]> {
  return unwrap(
    await supabase
      .from("cases")
      .select(
        "*, case_type:case_types(*), counterparty:counterparties(id,name), documents(doc_type, extraction_status)",
      )
      .order("created_at", { ascending: false }),
  );
}

export async function getCase(id: string): Promise<CaseWithRelations | null> {
  const res = await supabase.from("cases").select(CASE_SELECT).eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return null;
  const row = res.data as Case & {
    case_type: CaseType | null;
    counterparty: Counterparty | null;
  };
  const { count } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  return { ...row, child_count: count ?? 0 };
}

export async function listChildCases(parentId: string): Promise<CaseWithRelations[]> {
  const rows = unwrap<(Case & { case_type: CaseType | null; counterparty: Counterparty | null })[]>(
    await supabase
      .from("cases")
      .select(CASE_SELECT)
      .eq("parent_id", parentId)
      .order("created_at", { ascending: false }),
  );
  return rows.map((r) => ({ ...r, child_count: 0 }));
}

export interface CaseInput {
  title: string;
  case_type_id: string;
  parent_id?: string | null;
  counterparty_id?: string | null;
  status?: CaseStatus;
  work_status?: WorkStatus;
  currency?: string | null;
  total_amount?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
}

export async function createCase(input: CaseInput): Promise<Case> {
  return unwrap(await supabase.from("cases").insert(input).select("*").single());
}

export async function updateCase(id: string, patch: Partial<CaseInput>): Promise<Case> {
  return unwrap(
    await supabase.from("cases").update(patch).eq("id", id).select("*").single(),
  );
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from("cases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateWorkStatus(id: string, workStatus: WorkStatus): Promise<void> {
  const { error } = await supabase.from("cases").update({ work_status: workStatus }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- documents (Phase 4: upload + storage; AI extraction fields fill in Phase 5) ----

export async function listDocuments(caseId: string): Promise<DocumentRow[]> {
  return unwrap(
    await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .order("uploaded_at", { ascending: false }),
  );
}

/** Keep only safe filename chars for the storage key; the display name is stored separately. */
function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  return `${crypto.randomUUID()}${ext}`;
}

/**
 * Upload a file to the private bucket under `<caseId>/<uuid>.<ext>`, then record a draft
 * document row. doc_type is chosen by the human here (extraction proposes it in Phase 5);
 * extraction_status stays 'pending'.
 */
export async function uploadDocument(
  caseId: string,
  file: File,
  docType: DocType,
): Promise<DocumentRow> {
  const path = `${caseId}/${safeFileName(file.name)}`;
  const up = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) throw new Error(up.error.message);

  const res = await supabase
    .from("documents")
    .insert({
      case_id: caseId,
      doc_type: docType,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type || null,
    })
    .select("*")
    .single();
  if (res.error) {
    // Roll back the orphaned storage object if the row insert failed.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw new Error(res.error.message);
  }
  return res.data;
}

export async function updateDocumentType(id: string, docType: DocType): Promise<void> {
  const { error } = await supabase.from("documents").update({ doc_type: docType }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** The human-editable extracted fields of a document (brief §5). */
export interface DocumentFields {
  doc_number: string | null;
  tracking_number: string | null;
  rashimon_number: string | null;
  amount: number | null;
  currency: string | null;
  doc_date: string | null;
  counterparty_name: string | null;
}

/**
 * Save the document's extracted fields. When a human enters/confirms them, mark the row
 * `confirmed` (brief §6: nothing is written to confirmed state silently — this IS the human
 * confirmation). Later, AI extraction pre-fills these fields as `extracted` and the user
 * confirms through this same path.
 */
export async function updateDocumentFields(
  id: string,
  fields: DocumentFields,
): Promise<DocumentRow> {
  return unwrap(
    await supabase
      .from("documents")
      .update({ ...fields, extraction_status: "confirmed" })
      .eq("id", id)
      .select("*")
      .single(),
  );
}

/** Short-lived signed URL for viewing/downloading a private object. */
export async function getDocumentUrl(storagePath: string, expiresInSec = 120): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteDocument(doc: Pick<DocumentRow, "id" | "storage_path">): Promise<void> {
  // Remove the storage object first, then the row (orphan object is worse than orphan row).
  const rm = await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  if (rm.error) throw new Error(rm.error.message);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}

// ---- attachments (0011): polymorphic files for tasks + orders ------------
// Same private bucket as documents; just nested under `attachments/<type>/<id>/...`.
// Mirrors uploadDocument / getDocumentUrl / deleteDocument shape.

export async function uploadAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  file: File,
): Promise<Attachment> {
  const path = `attachments/${entityType}/${entityId}/${safeFileName(file.name)}`;
  const up = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) throw new Error(up.error.message);

  const res = await supabase
    .from("attachments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size ?? null,
    })
    .select("*")
    .single();
  if (res.error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw new Error(res.error.message);
  }
  return res.data as Attachment;
}

export async function listAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<Attachment[]> {
  return unwrap(
    await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("uploaded_at", { ascending: false }),
  );
}

/**
 * Signed URL — longer TTL (30 min) than getDocumentUrl, since the dashboard
 * "Recent files" widget loads many thumbnails at once and a 2-min TTL would
 * expire during a normal viewing session. Still bucket-private; still scoped
 * to the user's auth.
 */
export async function getAttachmentUrl(storagePath: string, expiresInSec = 1800): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteAttachment(att: Pick<Attachment, "id" | "storage_path">): Promise<void> {
  // Links carry no storage object — skip the storage call.
  if (att.storage_path) {
    const rm = await supabase.storage.from(DOCUMENTS_BUCKET).remove([att.storage_path]);
    if (rm.error) throw new Error(rm.error.message);
  }
  const { error } = await supabase.from("attachments").delete().eq("id", att.id);
  if (error) throw new Error(error.message);
}

/**
 * External-link attachment (Google Drive, OneDrive, generic URL). Stored as a
 * row in the same `attachments` table with `external_url` set and
 * `storage_path` null (DB enforces the XOR). The `label` becomes
 * `original_filename` so the display column is uniform with files.
 */
export async function createAttachmentLink(
  entityType: AttachmentEntityType,
  entityId: string,
  url: string,
  label?: string | null,
): Promise<Attachment> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("URL is required");
  // Basic URL sanity — accept http/https only to avoid javascript: etc.
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Only http(s) links are allowed");
    }
  } catch {
    throw new Error("Invalid URL");
  }
  const res = await supabase
    .from("attachments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      storage_path: null,
      external_url: trimmed,
      original_filename: (label?.trim() || null),
      mime_type: null,
      size_bytes: null,
    })
    .select("*")
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data as Attachment;
}

// ---- recent files aggregator (dashboard widget) --------------------------
// Unions documents + attachments(task) + attachments(order). The dataset is
// small, so we fetch in parallel and merge in JS rather than building a view.

export type RecentFileSource = "document" | "task" | "order";

export interface RecentFile {
  id: string;                  // synthetic: "{source}:{row_id}"
  source: RecentFileSource;
  source_id: string;
  source_title: string;        // task text / order title / case title
  case_id: string | null;
  case_title: string | null;
  /** File rows: the storage key. Link rows: null. */
  storage_path: string | null;
  /** Link rows: the external URL. File rows: null. */
  external_url: string | null;
  original_filename: string | null;
  mime_type: string | null;
  uploaded_at: string;
}

export async function listRecentFiles(limit = 12): Promise<RecentFile[]> {
  const [docsRes, taskAttRes, orderAttRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id, storage_path, original_filename, mime_type, uploaded_at, case:cases(id, title)")
      .order("uploaded_at", { ascending: false })
      .limit(limit),
    supabase
      .from("attachments")
      .select("id, entity_id, storage_path, external_url, original_filename, mime_type, uploaded_at")
      .eq("entity_type", "task")
      .order("uploaded_at", { ascending: false })
      .limit(limit),
    supabase
      .from("attachments")
      .select("id, entity_id, storage_path, external_url, original_filename, mime_type, uploaded_at")
      .eq("entity_type", "order")
      .order("uploaded_at", { ascending: false })
      .limit(limit),
  ]);
  if (docsRes.error) throw new Error(docsRes.error.message);
  if (taskAttRes.error) throw new Error(taskAttRes.error.message);
  if (orderAttRes.error) throw new Error(orderAttRes.error.message);

  // Denormalise titles for tasks/orders. Single batched fetch each.
  const taskIds = Array.from(new Set((taskAttRes.data ?? []).map((a) => a.entity_id as string)));
  const orderIds = Array.from(new Set((orderAttRes.data ?? []).map((a) => a.entity_id as string)));
  const [tasksData, ordersData] = await Promise.all([
    taskIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("tasks")
          .select("id, text, case:cases(id, title)")
          .in("id", taskIds),
    orderIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("orders")
          .select("id, title, case:cases(id, title)")
          .in("id", orderIds),
  ]);
  if (tasksData.error) throw new Error(tasksData.error.message);
  if (ordersData.error) throw new Error(ordersData.error.message);

  const taskById = new Map(
    ((tasksData.data ?? []) as { id: string; text: string; case: { id: string; title: string } | null }[]).map((t) => [t.id, t]),
  );
  const orderById = new Map(
    ((ordersData.data ?? []) as { id: string; title: string; case: { id: string; title: string } | null }[]).map((o) => [o.id, o]),
  );

  const items: RecentFile[] = [];

  for (const d of (docsRes.data ?? []) as never[]) {
    const dd = d as {
      id: string;
      storage_path: string;
      original_filename: string | null;
      mime_type: string | null;
      uploaded_at: string;
      case: { id: string; title: string } | null;
    };
    items.push({
      id: `document:${dd.id}`,
      source: "document",
      source_id: dd.id,
      source_title: dd.case?.title ?? "—",
      case_id: dd.case?.id ?? null,
      case_title: dd.case?.title ?? null,
      storage_path: dd.storage_path,
      external_url: null,
      original_filename: dd.original_filename,
      mime_type: dd.mime_type,
      uploaded_at: dd.uploaded_at,
    });
  }
  for (const a of (taskAttRes.data ?? []) as never[]) {
    const aa = a as {
      id: string;
      entity_id: string;
      storage_path: string | null;
      external_url: string | null;
      original_filename: string | null;
      mime_type: string | null;
      uploaded_at: string;
    };
    const t = taskById.get(aa.entity_id);
    items.push({
      id: `task:${aa.id}`,
      source: "task",
      source_id: aa.entity_id,
      source_title: t?.text ?? "—",
      case_id: t?.case?.id ?? null,
      case_title: t?.case?.title ?? null,
      storage_path: aa.storage_path,
      external_url: aa.external_url,
      original_filename: aa.original_filename,
      mime_type: aa.mime_type,
      uploaded_at: aa.uploaded_at,
    });
  }
  for (const a of (orderAttRes.data ?? []) as never[]) {
    const aa = a as {
      id: string;
      entity_id: string;
      storage_path: string | null;
      external_url: string | null;
      original_filename: string | null;
      mime_type: string | null;
      uploaded_at: string;
    };
    const o = orderById.get(aa.entity_id);
    items.push({
      id: `order:${aa.id}`,
      source: "order",
      source_id: aa.entity_id,
      source_title: o?.title ?? "—",
      case_id: o?.case?.id ?? null,
      case_title: o?.case?.title ?? null,
      storage_path: aa.storage_path,
      external_url: aa.external_url,
      original_filename: aa.original_filename,
      mime_type: aa.mime_type,
      uploaded_at: aa.uploaded_at,
    });
  }

  items.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  return items.slice(0, limit);
}

// ---- payment milestones (Phase 7) ----

export async function listMilestones(caseId: string): Promise<PaymentMilestone[]> {
  return unwrap(
    await supabase
      .from("payment_milestones")
      .select("*")
      .eq("case_id", caseId)
      .order("due_date", { ascending: true, nullsFirst: false }),
  );
}

export interface MilestoneInput {
  case_id: string;
  label: string;
  percent?: number | null;
  amount?: number | null;
  currency?: string | null;
  due_date?: string | null;
}

export async function createMilestone(input: MilestoneInput): Promise<PaymentMilestone> {
  return unwrap(
    await supabase.from("payment_milestones").insert(input).select("*").single(),
  );
}

/** Toggle paid (stamps/clears paid_at) or patch other fields. */
export async function updateMilestone(
  id: string,
  patch: Partial<Omit<PaymentMilestone, "id" | "case_id">>,
): Promise<PaymentMilestone> {
  return unwrap(
    await supabase.from("payment_milestones").update(patch).eq("id", id).select("*").single(),
  );
}

export async function setMilestonePaid(id: string, paid: boolean): Promise<PaymentMilestone> {
  return updateMilestone(id, { paid, paid_at: paid ? new Date().toISOString() : null });
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from("payment_milestones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- tasks (Phase 7) ----

export interface TaskWithCase extends TaskRow {
  case: Pick<Case, "id" | "title"> | null;
}

export async function listTasks(): Promise<TaskWithCase[]> {
  return unwrap(
    await supabase
      .from("tasks")
      .select("*, case:cases(id, title)")
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
  );
}

export interface TaskInput {
  text: string;
  priority?: TaskPriority;
  due_date?: string | null;
  category?: string | null;
  notes?: string | null;
  case_id?: string | null;
}

export async function createTask(input: TaskInput): Promise<TaskRow> {
  return unwrap(await supabase.from("tasks").insert(input).select("*").single());
}

export async function updateTask(id: string, patch: Partial<TaskInput & { done: boolean }>) {
  return unwrap(await supabase.from("tasks").update(patch).eq("id", id).select("*").single());
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Tasks scoped to a single case — used by the inline tasks list under the project row. */
export async function listTasksForCase(caseId: string): Promise<TaskRow[]> {
  return unwrap(
    await supabase
      .from("tasks")
      .select("*")
      .eq("case_id", caseId)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  );
}

// ---- payments (0010): mirrored from owner's Google Sheet CashFlow_9 ----

export interface PaymentWithRefs extends Payment {
  counterparty: Pick<Counterparty, "id" | "name"> | null;
  case: Pick<Case, "id" | "title"> | null;
}

export interface PaymentFilters {
  direction?: PaymentDirection;
  status?: PaymentStatus;
}

const PAYMENT_SELECT = "*, counterparty:counterparties(id, name), case:cases(id, title)";

export async function listPayments(filters: PaymentFilters = {}): Promise<PaymentWithRefs[]> {
  let q = supabase.from("payments").select(PAYMENT_SELECT);
  if (filters.direction) q = q.eq("direction", filters.direction);
  if (filters.status) q = q.eq("status", filters.status);
  return unwrap(await q.order("due_date", { ascending: true, nullsFirst: false }));
}

/** Update the in-app linkage (case_id / counterparty_id). Sheet fields are read-only. */
export async function updatePaymentLinkage(
  id: string,
  patch: { case_id?: string | null; counterparty_id?: string | null },
) {
  return unwrap(await supabase.from("payments").update(patch).eq("id", id).select("*").single());
}

// ── Payments import: CSV/TSV paste from the CashFlow sheet ─────────────────
// No Google integration — the sheet is exported manually (copy / save as CSV).
// Expected column order (matches CashFlow_9):
//   Date Opened, Due Date, Payment Received, Invoice Number, Finance,
//   Price Before VAT, Price After VAT, Remain, Currency, Status, Info, Client
// A "header row" is optional; we detect & skip one if its first cell isn't a date.

export interface ImportOptions {
  /** If true, delete payments whose hash isn't in this import (full mirror). */
  replaceAll?: boolean;
}

export async function importPaymentsFromCsv(
  text: string,
  opts: ImportOptions = {},
): Promise<{ upserted: number; deleted: number; skipped: number }> {
  const allRows = parseDelimited(text);
  // Skip a header row if its first cell isn't parseable as a date.
  const startsWithHeader = allRows.length > 0 && parseSheetDate(allRows[0]?.[0]) === null;
  const dataRows = startsWithHeader ? allRows.slice(1) : allRows;

  const seen = new Set<string>();
  type Row = {
    sheet_row_hash: string;
    sheet_row_num: number;
    date_opened: string | null;
    due_date: string | null;
    payment_received: string | null;
    invoice_number: string | null;
    direction: PaymentDirection;
    price_before_vat: number | null;
    price_after_vat: number | null;
    remain: number | null;
    currency: string;
    status: PaymentStatus | null;
    info: string | null;
    client_raw: string | null;
    synced_at: string;
  };
  const upserts: Row[] = [];
  const now = new Date().toISOString();
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i] ?? [];
    const [
      dateOpened, dueDate, paymentReceived, invoiceNumber,
      financeRaw, priceBeforeVat, priceAfterVat, remain,
      currency, statusRaw, info, client,
    ] = r;

    // skip blanks
    if (![dateOpened, dueDate, invoiceNumber, client, info].some((v) => v && String(v).trim())) {
      skipped++;
      continue;
    }
    // Only the lines with at least a date and a direction are useful.
    const dDue = parseSheetDate(dueDate);
    const dOpen = parseSheetDate(dateOpened);
    if (!dDue && !dOpen) { skipped++; continue; }

    const body = {
      sheet_row_num: (startsWithHeader ? i + 2 : i + 1),
      date_opened: dOpen,
      due_date: dDue,
      payment_received: parseSheetDate(paymentReceived),
      invoice_number: cleanText(invoiceNumber),
      direction: parseDirection(financeRaw),
      price_before_vat: parseAmount(priceBeforeVat),
      price_after_vat: parseAmount(priceAfterVat),
      remain: parseAmount(remain),
      currency: (cleanText(currency) ?? "ILS").toUpperCase(),
      status: parseStatus(statusRaw),
      info: cleanText(info),
      client_raw: cleanText(client),
    };
    const sheet_row_hash = await sha1Hex(JSON.stringify(body));
    if (seen.has(sheet_row_hash)) { skipped++; continue; }
    seen.add(sheet_row_hash);
    upserts.push({ ...body, sheet_row_hash, synced_at: now });
  }

  let upserted = 0;
  if (upserts.length > 0) {
    const { error } = await supabase
      .from("payments")
      .upsert(upserts, { onConflict: "sheet_row_hash", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    upserted = upserts.length;
  }

  let deleted = 0;
  if (opts.replaceAll) {
    const { data: existing, error: selErr } = await supabase
      .from("payments")
      .select("id, sheet_row_hash");
    if (selErr) throw new Error(selErr.message);
    const orphans = (existing ?? []).filter((r) => !seen.has(r.sheet_row_hash));
    if (orphans.length > 0) {
      const { error: delErr } = await supabase
        .from("payments")
        .delete()
        .in("id", orphans.map((r) => r.id));
      if (delErr) throw new Error(delErr.message);
      deleted = orphans.length;
    }
  }

  return { upserted, deleted, skipped };
}

// --- CSV / TSV parser (RFC4180-ish, autodetects tab vs comma) -------------
function parseDelimited(text: string): string[][] {
  if (!text.trim()) return [];
  // Find first non-empty line to detect the delimiter
  const sample = text.split(/\r?\n/).find((l) => l.length > 0) ?? "";
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  const delim = tabs >= commas ? "\t" : ",";

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* swallow */ }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c && c.trim()));
}

function cleanText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function parseSheetDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // DD/MM/YYYY (the format in CashFlow_9)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return null;
}

function pad2(s: string): string { return s.length === 1 ? `0${s}` : s; }

function parseDirection(v: unknown): PaymentDirection {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("inc") || s.includes("הכנס")) return "income";
  return "outcome";
}

function parseStatus(v: unknown): PaymentStatus | null {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("not") || s.includes("לא")) return "not_paid";
  if (s === "paid" || s.includes("paid") || s.includes("שולם")) return "paid";
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

async function sha1Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- calendar: every dated item across cases, milestones, tasks, payments ----

export type CalendarKind = "case" | "milestone" | "task" | "income" | "outcome";

export interface CalendarItem {
  id: string;
  date: string; // YYYY-MM-DD
  kind: CalendarKind;
  title: string;
  caseId: string | null;
  caseTitle: string | null;
  /** done (task) or paid (milestone / payment); undefined for cases. */
  resolved?: boolean;
  /** Money amount for payment kinds; undefined otherwise. */
  amount?: number | null;
  currency?: string | null;
}

/** Merge all forward/back-looking due dates into one sorted list (brief §6 calendar). */
export async function listCalendarItems(): Promise<CalendarItem[]> {
  const [cases, milestones, tasks, payments] = await Promise.all([
    supabase.from("cases").select("id, title, due_date, status").not("due_date", "is", null),
    supabase
      .from("payment_milestones")
      .select("id, label, due_date, paid, case:cases(id, title)")
      .not("due_date", "is", null),
    supabase
      .from("tasks")
      .select("id, text, due_date, done, case:cases(id, title)")
      .not("due_date", "is", null),
    supabase
      .from("payments")
      .select("id, due_date, direction, status, price_after_vat, currency, client_raw, info, case:cases(id, title)")
      .not("due_date", "is", null),
  ]);
  for (const r of [cases, milestones, tasks, payments]) {
    if (r.error) throw new Error(r.error.message);
  }

  const items: CalendarItem[] = [];

  for (const c of cases.data ?? []) {
    items.push({
      id: `case:${c.id}`,
      date: c.due_date as string,
      kind: "case",
      title: c.title,
      caseId: c.id,
      caseTitle: c.title,
      resolved: c.status === "closed",
    });
  }
  for (const m of (milestones.data ?? []) as never[]) {
    const mm = m as { id: string; label: string; due_date: string; paid: boolean; case: { id: string; title: string } | null };
    items.push({
      id: `milestone:${mm.id}`,
      date: mm.due_date,
      kind: "milestone",
      title: mm.label,
      caseId: mm.case?.id ?? null,
      caseTitle: mm.case?.title ?? null,
      resolved: mm.paid,
    });
  }
  for (const t of (tasks.data ?? []) as never[]) {
    const tt = t as { id: string; text: string; due_date: string; done: boolean; case: { id: string; title: string } | null };
    items.push({
      id: `task:${tt.id}`,
      date: tt.due_date,
      kind: "task",
      title: tt.text,
      caseId: tt.case?.id ?? null,
      caseTitle: tt.case?.title ?? null,
      resolved: tt.done,
    });
  }
  for (const p of (payments.data ?? []) as never[]) {
    const pp = p as {
      id: string;
      due_date: string;
      direction: PaymentDirection;
      status: PaymentStatus | null;
      price_after_vat: number | null;
      currency: string | null;
      client_raw: string | null;
      info: string | null;
      case: { id: string; title: string } | null;
    };
    // Title = client + info snippet (the sheet has no dedicated label column)
    const titleParts = [pp.client_raw, pp.info?.slice(0, 60)].filter(Boolean);
    items.push({
      id: `payment:${pp.id}`,
      date: pp.due_date,
      kind: pp.direction, // "income" | "outcome"
      title: titleParts.join(" — ") || (pp.direction === "income" ? "Income" : "Outcome"),
      caseId: pp.case?.id ?? null,
      caseTitle: pp.case?.title ?? null,
      resolved: pp.status === "paid",
      amount: pp.price_after_vat,
      currency: pp.currency,
    });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}

// ---- project spend chain (0005): people, work_items, orders ----

export async function listPeople(): Promise<Person[]> {
  return unwrap(await supabase.from("people").select("*").order("name", { ascending: true }));
}

export async function createPerson(input: {
  name: string;
  role?: string | null;
  email?: string | null;
}): Promise<Person> {
  return unwrap(await supabase.from("people").insert(input).select("*").single());
}

export interface WorkItemWithRefs extends WorkItem {
  assignee: Pick<Person, "id" | "name"> | null;
}

export async function listWorkItems(caseId: string): Promise<WorkItemWithRefs[]> {
  return unwrap(
    await supabase
      .from("work_items")
      .select("*, assignee:people(id, name)")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
  );
}

export interface WorkItemInput {
  case_id: string;
  name: string;
  stage?: string | null;
  status?: string | null;
  cost?: number | null;
  assignee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
}

export async function createWorkItem(input: WorkItemInput): Promise<WorkItem> {
  return unwrap(await supabase.from("work_items").insert(input).select("*").single());
}

export async function updateWorkItem(id: string, patch: Partial<Omit<WorkItemInput, "case_id">>) {
  return unwrap(await supabase.from("work_items").update(patch).eq("id", id).select("*").single());
}

export async function deleteWorkItem(id: string): Promise<void> {
  const { error } = await supabase.from("work_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface OrderWithRefs extends OrderRow {
  supplier: Pick<Counterparty, "id" | "name"> | null;
  work_item: Pick<WorkItem, "id" | "name"> | null;
}

export async function listOrders(caseId: string): Promise<OrderWithRefs[]> {
  return unwrap(
    await supabase
      .from("orders")
      .select("*, supplier:counterparties(id, name), work_item:work_items(id, name)")
      .eq("case_id", caseId)
      .order("order_date", { ascending: false, nullsFirst: false }),
  );
}

export interface OrderInput {
  case_id: string;
  work_item_id?: string | null;
  supplier_id?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  order_date?: string | null;
  status?: string | null;
  tracking_number?: string | null;
  notes?: string | null;
}

export async function createOrder(input: OrderInput): Promise<OrderRow> {
  return unwrap(await supabase.from("orders").insert(input).select("*").single());
}

export async function updateOrder(id: string, patch: Partial<Omit<OrderInput, "case_id">>) {
  return unwrap(await supabase.from("orders").update(patch).eq("id", id).select("*").single());
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * All orders across every case — used by the "attach existing order" picker.
 * Picking an existing order CLONES its fields into a new row for the chosen
 * work item; orders stay one-row-per-case (no schema change).
 */
export async function listAllOrders(): Promise<OrderWithRefs[]> {
  return unwrap(
    await supabase
      .from("orders")
      .select("*, supplier:counterparties(id, name), work_item:work_items(id, name)")
      .order("order_date", { ascending: false, nullsFirst: false }),
  );
}

/**
 * Spent per case = sum of orders' price + sum of work-items' cost (matches Notion's project
 * "Spent" = Σ task Total Sum, where Total Sum = task cost + its orders' prices). Map<caseId, spent>.
 */
export async function listSpendByCase(): Promise<Map<string, number>> {
  const [ordersRes, wiRes] = await Promise.all([
    supabase.from("orders").select("case_id, price"),
    supabase.from("work_items").select("case_id, cost"),
  ]);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (wiRes.error) throw new Error(wiRes.error.message);

  const map = new Map<string, number>();
  const add = (id: string, n: number | null) => {
    if (n == null) return;
    map.set(id, (map.get(id) ?? 0) + Number(n));
  };
  for (const r of (ordersRes.data ?? []) as Pick<OrderRow, "case_id" | "price">[]) add(r.case_id, r.price);
  for (const r of (wiRes.data ?? []) as Pick<WorkItem, "case_id" | "cost">[]) add(r.case_id, r.cost);
  return map;
}

// ============================================================================
// Accounting (0006): employees, payslips, tax certs, expenses, operating costs.
// Files reuse the private `documents` bucket under subfolders + signed URLs.
// ============================================================================

/** Upload a file to a subfolder of the documents bucket; returns the stored metadata. */
export async function uploadAccountingFile(
  prefix: string,
  file: File,
): Promise<{ storage_path: string; original_filename: string; mime_type: string | null }> {
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const path = `${prefix}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return { storage_path: path, original_filename: file.name, mime_type: file.type || null };
}

// ---- employees (people flagged is_employee) ----

export async function listEmployees(): Promise<Person[]> {
  return unwrap(
    await supabase.from("people").select("*").eq("is_employee", true).order("name"),
  );
}

export async function createEmployee(input: { name: string; role?: string | null }): Promise<Person> {
  return unwrap(
    await supabase.from("people").insert({ ...input, is_employee: true }).select("*").single(),
  );
}

// ---- payslips ----

export interface PayslipWithPerson extends Payslip {
  person: Pick<Person, "id" | "name"> | null;
}

export async function listPayslips(year: number): Promise<PayslipWithPerson[]> {
  return unwrap(
    await supabase
      .from("payslips")
      .select("*, person:people(id, name)")
      .eq("year", year),
  );
}

/** Insert-or-update a payslip for (person, year, month). */
export async function upsertPayslip(input: {
  person_id: string;
  year: number;
  month: number;
  received?: boolean;
  amount?: number | null;
  storage_path?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  notes?: string | null;
}): Promise<Payslip> {
  return unwrap(
    await supabase
      .from("payslips")
      .upsert(input, { onConflict: "person_id,year,month" })
      .select("*")
      .single(),
  );
}

export async function deletePayslip(id: string): Promise<void> {
  const { error } = await supabase.from("payslips").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- tax certs ----

export async function listTaxCerts(): Promise<TaxCert[]> {
  return unwrap(
    await supabase.from("tax_certs").select("*").order("valid_to", { ascending: false, nullsFirst: false }),
  );
}

export async function createTaxCert(input: Partial<TaxCert> & { kind?: string }): Promise<TaxCert> {
  return unwrap(await supabase.from("tax_certs").insert(input).select("*").single());
}

export async function updateTaxCert(id: string, patch: Partial<TaxCert>): Promise<TaxCert> {
  return unwrap(await supabase.from("tax_certs").update(patch).eq("id", id).select("*").single());
}

export async function deleteTaxCert(id: string): Promise<void> {
  const { error } = await supabase.from("tax_certs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- expenses (→ Rivhit) ----

export interface ExpenseWithSupplier extends Expense {
  supplier: Pick<Counterparty, "id" | "name"> | null;
}

export async function listExpenses(): Promise<ExpenseWithSupplier[]> {
  return unwrap(
    await supabase
      .from("expenses")
      .select("*, supplier:counterparties(id, name)")
      .order("expense_date", { ascending: false, nullsFirst: false }),
  );
}

export interface ExpenseInput {
  supplier_id?: string | null;
  invoice_number?: string | null;
  amount?: number | null;
  currency?: string | null;
  expense_date?: string | null;
  category?: string | null;
  storage_path?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  rivhit_uploaded?: boolean;
  notes?: string | null;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  return unwrap(await supabase.from("expenses").insert(input).select("*").single());
}

export async function updateExpense(id: string, patch: Partial<ExpenseInput>): Promise<Expense> {
  return unwrap(await supabase.from("expenses").update(patch).eq("id", id).select("*").single());
}

export async function setExpenseRivhit(id: string, uploaded: boolean): Promise<Expense> {
  return updateExpense(id, {
    rivhit_uploaded: uploaded,
    // stamp time only when marking uploaded
    ...(uploaded ? {} : {}),
  } as ExpenseInput).then(async (e) => {
    await supabase
      .from("expenses")
      .update({ rivhit_uploaded_at: uploaded ? new Date().toISOString() : null })
      .eq("id", id);
    return e;
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- operating costs ----

export async function listOpCostCategories(): Promise<OpCostCategory[]> {
  return unwrap(
    await supabase.from("op_cost_categories").select("*").eq("active", true).order("sort"),
  );
}

export async function listOpCostEntries(year: number): Promise<OpCostEntry[]> {
  return unwrap(await supabase.from("op_cost_entries").select("*").eq("year", year));
}

/** Insert-or-update one (year, month, category) amount. Deletes the row when cleared. */
export async function upsertOpCostEntry(
  year: number,
  month: number,
  categoryId: string,
  amount: number | null,
): Promise<void> {
  if (amount == null) {
    const { error } = await supabase
      .from("op_cost_entries")
      .delete()
      .match({ year, month, category_id: categoryId });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("op_cost_entries")
    .upsert({ year, month, category_id: categoryId, amount }, { onConflict: "year,month,category_id" });
  if (error) throw new Error(error.message);
}
