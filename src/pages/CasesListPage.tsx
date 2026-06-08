import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import {
  deleteCase,
  listCasesWithDocs,
  listCaseTypes,
  listCounterparties,
  updateCase,
  updateWorkStatus,
  type CaseWithDocs,
} from "@/lib/data";
import { buildCaseViews, type CaseView } from "@/lib/completeness";
import { useI18n } from "@/lib/i18n";
import {
  ALL_WORK_STATUSES,
  GROUP_ORDER,
  groupLabel,
  workStatusBadgeClass,
  workStatusLabel,
} from "@/lib/labels";
import type { CaseGroup, CaseType, Counterparty, WorkStatus } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const CURRENCIES = ["ILS", "USD", "CNY", "EUR"];

// ---- Status Picker (same pattern as Dashboard) ----
function StatusPicker({
  value,
  onChange,
}: {
  value: WorkStatus;
  onChange: (v: WorkStatus) => void;
}) {
  const { tl } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${workStatusBadgeClass[value]}`}
      >
        {tl(workStatusLabel[value])}
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-20 mt-1 w-36 rounded-lg border bg-card shadow-lg">
          {ALL_WORK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs hover:bg-gray-50"
            >
              <span className={`inline-block size-2 rounded-full ring-1 ${workStatusBadgeClass[s]}`} />
              {tl(workStatusLabel[s])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Inline edit form ----
function InlineEditForm({
  view,
  caseTypes,
  counterparties,
  onSave,
  onCancel,
}: {
  view: CaseView;
  caseTypes: CaseType[];
  counterparties: Counterparty[];
  onSave: (id: string, patch: Parameters<typeof updateCase>[1]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, tl } = useI18n();
  const c = view.case;

  const [title, setTitle] = useState(c.title);
  const [caseTypeId, setCaseTypeId] = useState(c.case_type_id);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(c.counterparty_id);
  const [startDate, setStartDate] = useState(c.start_date ?? "");
  const [dueDate, setDueDate] = useState(c.due_date ?? "");
  const [currency, setCurrency] = useState(c.currency ?? "");
  const [totalAmount, setTotalAmount] = useState(
    c.total_amount != null ? String(c.total_amount) : "",
  );
  const [notes, setNotes] = useState(c.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!title.trim() || !caseTypeId) { setError(t("caseForm.required")); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(c.id, {
        title: title.trim(),
        case_type_id: caseTypeId,
        counterparty_id: counterpartyId,
        start_date: startDate || null,
        due_date: dueDate || null,
        currency: currency || null,
        total_amount: totalAmount.trim() === "" ? null : Number(totalAmount),
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      onClick={(e) => e.stopPropagation()}
      className="border-t bg-gray-50/80 px-4 py-3 space-y-3"
    >
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Title */}
        <div className="lg:col-span-2 grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("caseForm.title")}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            required
          />
        </div>
        {/* Case type */}
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("caseForm.caseType")}</label>
          <select
            value={caseTypeId}
            onChange={(e) => setCaseTypeId(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            required
          >
            {caseTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>{tl({ he: ct.name_he, en: ct.name_en })}</option>
            ))}
          </select>
        </div>
        {/* Counterparty */}
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("cases.client")}</label>
          <select
            value={counterpartyId ?? ""}
            onChange={(e) => setCounterpartyId(e.target.value || null)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">—</option>
            {counterparties.map((cp) => (
              <option key={cp.id} value={cp.id}>{cp.name}</option>
            ))}
          </select>
        </div>
        {/* Start date */}
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("caseForm.startDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        {/* Due date */}
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("caseForm.dueDate")}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        {/* Currency */}
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("caseForm.currency")}</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">—</option>
            {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
          </select>
        </div>
        {/* Budget */}
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t("cases.budget")}</label>
          <input
            type="number"
            step="0.01"
            dir="ltr"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        {/* Notes */}
        <div className="grid gap-1 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">{t("caseForm.notes")}</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-primary/90"
        >
          {saving ? t("common.saving") : t("cases.saveChanges")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

// ---- Main page ----
export function CasesListPage() {
  const { t, tl, lang } = useI18n();
  const [cases, setCases] = useState<CaseWithDocs[] | null>(null);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCasesWithDocs(), listCaseTypes(), listCounterparties()])
      .then(([cs, cts, cps]) => { setCases(cs); setCaseTypes(cts); setCounterparties(cps); })
      .catch((e) => setError(e.message));
  }, []);

  const [pendingDelete, setPendingDelete] = useState<CaseView | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleDelete(v: CaseView, e: React.MouseEvent) {
    e.preventDefault();
    setPendingDelete(v);
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteCase(pendingDelete.case.id);
      setCases((prev) => prev?.filter((c) => c.id !== pendingDelete.case.id) ?? null);
      setPendingDelete(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(id: string, ws: WorkStatus) {
    setCases((prev) =>
      prev?.map((c) => c.id === id ? { ...c, work_status: ws } : c) ?? null,
    );
    await updateWorkStatus(id, ws);
  }

  async function handleSave(id: string, patch: Parameters<typeof updateCase>[1]) {
    await updateCase(id, patch);
    const updated = await listCasesWithDocs();
    setCases(updated);
    setEditingId(null);
  }

  const views = useMemo(() => (cases ? buildCaseViews(cases) : []), [cases]);

  const fmtDate = (d: string | null) => {
    if (!d) return null;
    const dt = new Date(d);
    return dt.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("cases.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("cases.subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/cases/new">+ {t("cases.newCase")}</Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {cases === null && !error && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {cases !== null && views.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("cases.empty")}</p>
          <Button asChild className="mt-4">
            <Link to="/cases/new">+ {t("cases.newCase")}</Link>
          </Button>
        </div>
      )}

      {cases !== null &&
        views.length > 0 &&
        GROUP_ORDER.map((group) => {
          const inGroup = views.filter((v) => v.case.case_type?.group === group);
          if (inGroup.length === 0) return null;
          return (
            <GroupSection
              key={group}
              group={group}
              views={inGroup}
              caseTypes={caseTypes}
              counterparties={counterparties}
              editingId={editingId}
              fmtDate={fmtDate}
              t={t}
              tl={tl}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onEdit={setEditingId}
              onSave={handleSave}
              onCancelEdit={() => setEditingId(null)}
            />
          );
        })}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete && pendingDelete.children.length > 0
            ? t("caseForm.deleteConfirmChildren", { n: pendingDelete.children.length })
            : t("caseForm.deleteConfirm")
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function GroupSection({
  group,
  views,
  caseTypes,
  counterparties,
  editingId,
  fmtDate,
  t,
  tl,
  onDelete,
  onStatusChange,
  onEdit,
  onSave,
  onCancelEdit,
}: {
  group: CaseGroup;
  views: CaseView[];
  caseTypes: CaseType[];
  counterparties: Counterparty[];
  editingId: string | null;
  fmtDate: (d: string | null) => string | null;
  t: (k: string, v?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
  onDelete: (v: CaseView, e: React.MouseEvent) => void;
  onStatusChange: (id: string, ws: WorkStatus) => void;
  onEdit: (id: string) => void;
  onSave: (id: string, patch: Parameters<typeof updateCase>[1]) => Promise<void>;
  onCancelEdit: () => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        {tl(groupLabel[group])}{" "}
        <span className="rounded-full bg-gray-100 px-2 py-0 text-xs font-normal text-muted-foreground">
          {views.length}
        </span>
      </h2>

      {/* Column headers */}
      <div className="mb-1 grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 text-xs font-medium text-muted-foreground">
        <span>{t("caseForm.title")}</span>
        <span className="w-28 text-start">{t("cases.client")}</span>
        <span className="w-32 text-start">{t("cases.dates")}</span>
        <span className="w-24 text-start">{t("caseForm.status")}</span>
        <span className="w-16" />
      </div>

      <ul className="overflow-hidden rounded-2xl border bg-card shadow-card divide-y">
        {views.map((v) => {
          const isEditing = editingId === v.case.id;
          const startFmt = fmtDate(v.case.start_date);
          const dueFmt = fmtDate(v.case.due_date);
          const dateStr = startFmt && dueFmt
            ? `${startFmt} → ${dueFmt}`
            : startFmt ?? dueFmt ?? "—";

          return (
            <li key={v.case.id}>
              {/* Main row */}
              <div className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
                {/* Title + badges */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/cases/${v.case.id}`}
                      className="truncate font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {v.case.title}
                    </Link>
                    {v.case.parent_id && (
                      <Badge className="bg-gray-100 text-gray-500 ring-1 ring-gray-200 text-xs">{t("cases.child")}</Badge>
                    )}
                    {v.children.length > 0 && (
                      <Badge className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-xs">
                        {t("cases.children", { n: v.children.length })}
                      </Badge>
                    )}
                    {v.showMissingDocs && v.own.missing.length > 0 && (
                      <Badge className="bg-red-50 text-red-600 ring-1 ring-red-200 text-xs">
                        {t("cases.missingDocs", { n: v.own.missing.length })}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.case.case_type ? tl({ he: v.case.case_type.name_he, en: v.case.case_type.name_en }) : "—"}
                  </p>
                </div>

                {/* Client */}
                <span className="w-28 truncate text-sm text-muted-foreground">
                  {v.case.counterparty?.name ?? "—"}
                </span>

                {/* Dates */}
                <span className="w-32 truncate text-xs text-muted-foreground" dir="ltr">
                  {dateStr}
                </span>

                {/* Status picker */}
                <div className="w-24">
                  <StatusPicker
                    value={v.case.work_status}
                    onChange={(ws) => onStatusChange(v.case.id, ws)}
                  />
                </div>

                {/* Actions */}
                <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                  <IconButton
                    variant="primary"
                    onClick={() => onEdit(isEditing ? "" : v.case.id)}
                    title={t("cases.editCase")}
                    aria-label={t("cases.editCase")}
                    size="sm"
                    className={isEditing ? "bg-primary/10" : "hidden group-hover:inline-flex"}
                  >
                    {isEditing ? <X /> : <Pencil />}
                  </IconButton>
                  <Link
                    to={`/cases/${v.case.id}`}
                    className="hidden rounded-md size-6 items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary group-hover:inline-flex [&_svg]:size-3.5"
                    title={t("common.open")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink />
                  </Link>
                  <IconButton
                    variant="destructive"
                    onClick={(e) => onDelete(v, e)}
                    title={t("caseForm.deleteConfirm")}
                    aria-label={t("caseForm.deleteConfirm")}
                    size="sm"
                    className="hidden group-hover:inline-flex"
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </div>

              {/* Inline edit form */}
              {isEditing && (
                <InlineEditForm
                  view={v}
                  caseTypes={caseTypes}
                  counterparties={counterparties}
                  onSave={onSave}
                  onCancel={onCancelEdit}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
