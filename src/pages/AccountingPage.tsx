import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import {
  createExpense,
  createTaxCert,
  deleteExpense,
  deleteTaxCert,
  listCounterparties,
  listEmployees,
  listExpenses,
  listOpCostCategories,
  listOpCostEntries,
  listPayslips,
  listTaxCerts,
  setExpenseRivhit,
  updateExpense,
  updateTaxCert,
  uploadAccountingFile,
  upsertOpCostEntry,
  upsertPayslip,
  getDocumentUrl,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  Counterparty,
  Expense,
  OpCostCategory,
  OpCostEntry,
  Person,
  TaxCert,
} from "@/types/db";
import type { ExpenseWithSupplier, PayslipWithPerson } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ── helpers ────────────────────────────────────────────────────────────────

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

function YearSelect({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-white/10 bg-card px-3 py-1.5 text-sm"
    >
      {YEARS.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}

function FileLink({ storagePath, name }: { storagePath: string | null; name?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  if (!storagePath) return null;
  return (
    <button
      className="flex items-center gap-1 text-xs text-sky-400 hover:underline"
      onClick={async () => {
        if (!url) {
          const signed = await getDocumentUrl(storagePath);
          setUrl(signed);
          window.open(signed, "_blank");
        } else {
          window.open(url, "_blank");
        }
      }}
    >
      <Paperclip className="size-3" />
      {name ?? "file"}
    </button>
  );
}

// ── tab bar ────────────────────────────────────────────────────────────────

type Tab = "payslips" | "taxcerts" | "expenses" | "opcosts";

// ── main page ──────────────────────────────────────────────────────────────

export function AccountingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("payslips");

  const TABS: { id: Tab; label: string }[] = [
    { id: "payslips", label: t("accounting.tabPayslips") },
    { id: "taxcerts", label: t("accounting.tabTaxCerts") },
    { id: "expenses", label: t("accounting.tabExpenses") },
    { id: "opcosts", label: t("accounting.tabOpCosts") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("accounting.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("accounting.subtitle")}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-card p-1">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === tb.id
                ? "bg-white/10 text-white"
                : "text-muted-foreground hover:bg-white/5 hover:text-white",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "payslips" && <PayslipsSection />}
      {tab === "taxcerts" && <TaxCertsSection />}
      {tab === "expenses" && <ExpensesSection />}
      {tab === "opcosts" && <OpCostsSection />}
    </div>
  );
}

// ── Payslips ───────────────────────────────────────────────────────────────

function PayslipsSection() {
  const { t } = useI18n();
  const months: string[] = t("accounting.payslips.months") as unknown as string[];
  const [year, setYear] = useState(THIS_YEAR);
  const [employees, setEmployees] = useState<Person[]>([]);
  const [payslips, setPayslips] = useState<PayslipWithPerson[]>([]);
  const [uploading, setUploading] = useState<string | null>(null); // `${person_id}-${month}`

  const load = useCallback(async () => {
    const [emps, slips] = await Promise.all([listEmployees(), listPayslips(year)]);
    setEmployees(emps);
    setPayslips(slips);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  function slipFor(personId: string, month: number) {
    return payslips.find((p) => p.person_id === personId && p.month === month) ?? null;
  }

  async function toggleReceived(personId: string, month: number) {
    const slip = slipFor(personId, month);
    await upsertPayslip({ person_id: personId, year, month, received: !(slip?.received ?? false) });
    await load();
  }

  async function handleFileUpload(personId: string, month: number, file: File) {
    const key = `${personId}-${month}`;
    setUploading(key);
    try {
      const meta = await uploadAccountingFile(`payslips/${year}/${personId}`, file);
      await upsertPayslip({ person_id: personId, year, month, received: true, ...meta });
      await load();
    } finally {
      setUploading(null);
    }
  }

  if (employees.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("accounting.payslips.noEmployees")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("accounting.year")}</span>
        <YearSelect value={year} onChange={setYear} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-2.5 text-start font-medium text-muted-foreground">
                {t("accounting.payslips.employee")}
              </th>
              {months.map((m, i) => (
                <th key={i} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-4 py-2.5 font-medium">{emp.name}</td>
                {months.map((_, i) => {
                  const month = i + 1;
                  const slip = slipFor(emp.id, month);
                  const key = `${emp.id}-${month}`;
                  const isUploading = uploading === key;
                  return (
                    <td key={month} className="px-1 py-1.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => toggleReceived(emp.id, month)}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg border transition-colors",
                            slip?.received
                              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                              : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20",
                          )}
                          title={slip?.received ? "Mark as not received" : "Mark as received"}
                        >
                          {slip?.received ? <Check className="size-3.5" /> : <span className="text-xs">–</span>}
                        </button>
                        {slip?.storage_path ? (
                          <FileLink storagePath={slip.storage_path} name={slip.original_filename} />
                        ) : (
                          <label
                            className={cn(
                              "cursor-pointer text-xs text-muted-foreground hover:text-sky-400",
                              isUploading && "opacity-50",
                            )}
                            title="Upload payslip PDF"
                          >
                            {isUploading ? "…" : <Upload className="size-3" />}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              disabled={isUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileUpload(emp.id, month, f);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tax Certs ──────────────────────────────────────────────────────────────

type CertForm = {
  kind: string;
  year: string;
  valid_from: string;
  valid_to: string;
  rate: string;
  notes: string;
};

const BLANK_CERT: CertForm = { kind: "withholding", year: "", valid_from: "", valid_to: "", rate: "", notes: "" };

function TaxCertsSection() {
  const { t } = useI18n();
  const [certs, setCerts] = useState<TaxCert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CertForm>(BLANK_CERT);
  const [editId, setEditId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => { setCerts(await listTaxCerts()); };
  useEffect(() => { load(); }, []);

  function startEdit(cert: TaxCert) {
    setEditId(cert.id);
    setForm({
      kind: cert.kind,
      year: cert.year?.toString() ?? "",
      valid_from: cert.valid_from ?? "",
      valid_to: cert.valid_to ?? "",
      rate: cert.rate?.toString() ?? "",
      notes: cert.notes ?? "",
    });
    setFile(null);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditId(null);
    setForm(BLANK_CERT);
    setFile(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let fileMeta: Partial<TaxCert> = {};
      if (file) {
        const meta = await uploadAccountingFile("tax_certs", file);
        fileMeta = meta;
      }
      const payload: Partial<TaxCert> = {
        kind: form.kind,
        year: form.year ? Number(form.year) : null,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        rate: form.rate ? Number(form.rate) : null,
        notes: form.notes || null,
        ...fileMeta,
      };
      if (editId) {
        await updateTaxCert(editId, payload);
      } else {
        await createTaxCert(payload);
      }
      cancel();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("accounting.deleteConfirm"))) return;
    await deleteTaxCert(id);
    await load();
  }

  const kindLabel = (k: string) =>
    k === "withholding" ? t("accounting.taxCerts.kindWithholding") : t("accounting.taxCerts.kindForm101");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span />
        <Button size="sm" onClick={() => { cancel(); setShowForm(true); }}>
          <Plus className="size-4" /> {t("accounting.taxCerts.add")}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("accounting.taxCerts.kind")}</Label>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-background px-3 py-1.5 text-sm"
              >
                <option value="withholding">{t("accounting.taxCerts.kindWithholding")}</option>
                <option value="form_101">{t("accounting.taxCerts.kindForm101")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.year")}</Label>
              <Input value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="2025" type="number" />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.taxCerts.rate")}</Label>
              <Input value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} placeholder="0.00" type="number" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.taxCerts.validFrom")}</Label>
              <Input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.taxCerts.validTo")}</Label>
              <Input type="date" value={form.valid_to} onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.file")}</Label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full text-sm text-muted-foreground"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("accounting.notes")}</Label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
            <Button size="sm" variant="outline" onClick={cancel}>{t("common.cancel")}</Button>
          </div>
        </div>
      )}

      {certs.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">{t("accounting.taxCerts.noCerts")}</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-start">{t("accounting.taxCerts.kind")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.year")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.taxCerts.validFrom")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.taxCerts.validTo")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.taxCerts.rate")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.file")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.notes")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-4 py-2.5">
                    <Badge className="bg-gray-100 text-gray-700 ring-1 ring-gray-200">{kindLabel(c.kind)}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.year ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.valid_from ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.valid_to ? (
                      <span className={cn(
                        c.valid_to < new Date().toISOString().slice(0, 10)
                          ? "text-red-400"
                          : "text-emerald-400",
                      )}>{c.valid_to}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.rate != null ? `${c.rate}%` : "—"}</td>
                  <td className="px-4 py-2.5">
                    <FileLink storagePath={c.storage_path} name={c.original_filename} />
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">{c.notes ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
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

// ── Expenses → Rivhit ──────────────────────────────────────────────────────

type ExpFilter = "all" | "pending" | "done";

type ExpenseForm = {
  supplier_id: string;
  invoice_number: string;
  amount: string;
  currency: string;
  expense_date: string;
  category: string;
  notes: string;
};

const BLANK_EXP: ExpenseForm = {
  supplier_id: "", invoice_number: "", amount: "", currency: "ILS",
  expense_date: "", category: "", notes: "",
};

function ExpensesSection() {
  const { t } = useI18n();
  const [expenses, setExpenses] = useState<ExpenseWithSupplier[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [filter, setFilter] = useState<ExpFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(BLANK_EXP);
  const [editId, setEditId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [exps, cps] = await Promise.all([listExpenses(), listCounterparties()]);
    setExpenses(exps);
    setCounterparties(cps);
  };
  useEffect(() => { load(); }, []);

  const visible = expenses.filter((e) => {
    if (filter === "pending") return !e.rivhit_uploaded;
    if (filter === "done") return e.rivhit_uploaded;
    return true;
  });

  function startEdit(exp: Expense) {
    setEditId(exp.id);
    setForm({
      supplier_id: exp.supplier_id ?? "",
      invoice_number: exp.invoice_number ?? "",
      amount: exp.amount?.toString() ?? "",
      currency: exp.currency ?? "ILS",
      expense_date: exp.expense_date ?? "",
      category: exp.category ?? "",
      notes: exp.notes ?? "",
    });
    setFile(null);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditId(null);
    setForm(BLANK_EXP);
    setFile(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let fileMeta: Partial<ExpenseForm & { storage_path: string; original_filename: string; mime_type: string | null }> = {};
      if (file) {
        const meta = await uploadAccountingFile("expenses", file);
        fileMeta = meta;
      }
      const payload = {
        supplier_id: form.supplier_id || null,
        invoice_number: form.invoice_number || null,
        amount: form.amount ? Number(form.amount) : null,
        currency: form.currency || "ILS",
        expense_date: form.expense_date || null,
        category: form.category || null,
        notes: form.notes || null,
        ...fileMeta,
      };
      if (editId) {
        await updateExpense(editId, payload);
      } else {
        await createExpense(payload);
      }
      cancel();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("accounting.deleteConfirm"))) return;
    await deleteExpense(id);
    await load();
  }

  async function toggleRivhit(exp: ExpenseWithSupplier) {
    await setExpenseRivhit(exp.id, !exp.rivhit_uploaded);
    await load();
  }

  const filterLabels: { id: ExpFilter; label: string }[] = [
    { id: "all", label: t("accounting.expenses.filterAll") },
    { id: "pending", label: t("accounting.expenses.filterPending") },
    { id: "done", label: t("accounting.expenses.filterDone") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {filterLabels.map((fl) => (
            <button
              key={fl.id}
              onClick={() => setFilter(fl.id)}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs transition-colors",
                filter === fl.id
                  ? "border-sky-500/40 bg-sky-500/20 text-sky-300"
                  : "border-white/10 text-muted-foreground hover:text-white",
              )}
            >
              {fl.label}
              {fl.id === "pending" && (
                <span className="ms-1 rounded bg-amber-500/20 px-1 text-amber-400">
                  {expenses.filter((e) => !e.rivhit_uploaded).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { cancel(); setShowForm(true); }}>
          <Plus className="size-4" /> {t("accounting.expenses.add")}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("accounting.expenses.supplier")}</Label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-background px-3 py-1.5 text-sm"
              >
                <option value="">— None —</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.expenses.invoiceNumber")}</Label>
              <Input value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.amount")}</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.currency")}</Label>
              <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.date")}</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("accounting.expenses.category")}</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1 sm:col-span-3">
              <Label>{t("accounting.file")}</Label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="text-sm text-muted-foreground"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="col-span-2 space-y-1 sm:col-span-3">
              <Label>{t("accounting.notes")}</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
            <Button size="sm" variant="outline" onClick={cancel}>{t("common.cancel")}</Button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("accounting.expenses.noExpenses")}</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-start">{t("accounting.expenses.supplier")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.expenses.invoiceNumber")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.amount")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.date")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.expenses.category")}</th>
                <th className="px-4 py-2.5 text-start">{t("accounting.file")}</th>
                <th className="px-4 py-2.5 text-center">{t("accounting.expenses.rivhitUploaded")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((exp) => (
                <tr key={exp.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-4 py-2.5 font-medium">{exp.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{exp.invoice_number ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {exp.amount != null
                      ? `${exp.amount.toLocaleString()} ${exp.currency ?? "ILS"}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{exp.expense_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{exp.category ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <FileLink storagePath={exp.storage_path} name={exp.original_filename} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => toggleRivhit(exp)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors",
                        exp.rivhit_uploaded
                          ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
                      )}
                    >
                      {exp.rivhit_uploaded ? (
                        <><Check className="size-3" /> {t("accounting.expenses.rivhitUploaded")}</>
                      ) : (
                        t("accounting.expenses.rivhitPending")
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(exp)}>
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(exp.id)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
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

// ── Operating Costs ────────────────────────────────────────────────────────

function OpCostsSection() {
  const { t } = useI18n();
  const monthLabels: string[] = t("accounting.opCosts.monthLabels") as unknown as string[];
  const [year, setYear] = useState(THIS_YEAR);
  const [categories, setCategories] = useState<OpCostCategory[]>([]);
  const [entries, setEntries] = useState<OpCostEntry[]>([]);
  // localValues: key = `${month}-${categoryId}`, value = string (editing)
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cats, ents] = await Promise.all([listOpCostCategories(), listOpCostEntries(year)]);
    setCategories(cats);
    setEntries(ents);
    // reset local values on year change
    setLocalValues({});
  }, [year]);

  useEffect(() => { load(); }, [load]);

  function entryFor(month: number, categoryId: string): OpCostEntry | null {
    return entries.find((e) => e.month === month && e.category_id === categoryId) ?? null;
  }

  function displayValue(month: number, categoryId: string): string {
    const key = `${month}-${categoryId}`;
    if (key in localValues) return localValues[key];
    const e = entryFor(month, categoryId);
    return e?.amount?.toString() ?? "";
  }

  async function handleBlur(month: number, categoryId: string) {
    const key = `${month}-${categoryId}`;
    const raw = localValues[key];
    if (raw === undefined) return; // untouched
    const amount = raw === "" ? null : Number(raw);
    if (isNaN(amount as number)) return;
    setSaving(key);
    try {
      await upsertOpCostEntry(year, month, categoryId, amount);
      await load();
    } finally {
      setSaving(null);
    }
  }

  function rowTotal(month: number): number {
    return categories.reduce((sum, cat) => {
      const val = displayValue(month, cat.id);
      const n = val === "" ? 0 : Number(val);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }

  function colTotal(categoryId: string): number {
    return Array.from({ length: 12 }, (_, i) => i + 1).reduce((sum, month) => {
      const val = displayValue(month, categoryId);
      const n = val === "" ? 0 : Number(val);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }

  function grandTotal(): number {
    return Array.from({ length: 12 }, (_, i) => i + 1).reduce((s, m) => s + rowTotal(m), 0);
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("accounting.opCosts.noCategories")}</p>;
  }

  const fmt = (n: number) => n === 0 ? "" : n.toLocaleString("en-IL", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("accounting.year")}</span>
        <YearSelect value={year} onChange={setYear} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-3 py-2.5 text-start text-xs font-medium text-muted-foreground sticky start-0 bg-card z-10 min-w-[60px]">
                {/* month col */}
              </th>
              {categories.map((cat) => (
                <th key={cat.id} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {cat.name}
                </th>
              ))}
              <th className="px-3 py-2.5 text-end text-xs font-bold text-white">
                {t("accounting.opCosts.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {monthLabels.map((label, i) => {
              const month = i + 1;
              return (
                <tr key={month} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-3 py-1.5 text-xs font-medium text-muted-foreground sticky start-0 bg-card">
                    {label}
                  </td>
                  {categories.map((cat) => {
                    const key = `${month}-${cat.id}`;
                    const isSaving = saving === key;
                    return (
                      <td key={cat.id} className="px-1 py-1">
                        <input
                          type="number"
                          step="1"
                          className={cn(
                            "w-20 rounded border border-transparent bg-transparent px-2 py-1 text-center text-sm transition-colors",
                            "hover:border-white/10 focus:border-sky-500/50 focus:bg-white/5 focus:outline-none",
                            isSaving && "opacity-50",
                          )}
                          value={displayValue(month, cat.id)}
                          placeholder="—"
                          disabled={isSaving}
                          onChange={(e) =>
                            setLocalValues((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          onBlur={() => handleBlur(month, cat.id)}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-end text-sm font-semibold">
                    {fmt(rowTotal(month))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/15 bg-white/5">
              <td className="px-3 py-2.5 text-xs font-bold sticky start-0 bg-card">
                {t("accounting.opCosts.total")}
              </td>
              {categories.map((cat) => (
                <td key={cat.id} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                  {fmt(colTotal(cat.id))}
                </td>
              ))}
              <td className="px-3 py-2.5 text-end text-sm font-bold text-white">
                {fmt(grandTotal())}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
