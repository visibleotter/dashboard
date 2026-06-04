import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createCase,
  deleteCase,
  getCase,
  listCases,
  listCaseTypes,
  listChildCases,
  updateCase,
  type CaseWithRelations,
} from "@/lib/data";
import {
  ALL_STATUSES,
  GROUP_ORDER,
  groupLabel,
  statusBadgeClass,
  statusLabel,
} from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import type { CaseStatus, CaseType, DocType } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CounterpartySelect } from "@/components/CounterpartySelect";
import { DocumentsSection } from "@/components/DocumentsSection";
import { MilestonesSection } from "@/components/MilestonesSection";
import { CaseTimeline } from "@/components/CaseTimeline";
import { SpendSummary } from "@/components/SpendSummary";
import { WorkItemsSection } from "@/components/WorkItemsSection";
import { OrdersSection } from "@/components/OrdersSection";

const CURRENCIES = ["ILS", "USD", "CNY", "EUR"];

export function CaseFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const { t, tl } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [allCases, setAllCases] = useState<CaseWithRelations[]>([]);
  const [children, setChildren] = useState<CaseWithRelations[]>([]);

  // form state
  const [title, setTitle] = useState("");
  const [caseTypeId, setCaseTypeId] = useState("");
  const [parentId, setParentId] = useState<string | null>(searchParams.get("parent"));
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [status, setStatus] = useState<CaseStatus>("incomplete");
  const [currency, setCurrency] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [orderSpent, setOrderSpent] = useState(0);
  const [workCost, setWorkCost] = useState(0);

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Load catalogue + cases (for the parent picker) once.
  useEffect(() => {
    Promise.all([listCaseTypes(), listCases()])
      .then(([types, cases]) => {
        setCaseTypes(types);
        setAllCases(cases);
      })
      .catch((e) => setError(e.message));
  }, []);

  // In edit mode, load the case being edited + its children.
  useEffect(() => {
    if (mode !== "edit" || !id) return;
    setLoading(true);
    getCase(id)
      .then((c) => {
        if (!c) {
          setNotFound(true);
          return;
        }
        setTitle(c.title);
        setCaseTypeId(c.case_type_id);
        setParentId(c.parent_id);
        setCounterpartyId(c.counterparty_id);
        setStatus(c.status);
        setCurrency(c.currency ?? "");
        setTotalAmount(c.total_amount != null ? String(c.total_amount) : "");
        setDueDate(c.due_date ?? "");
        setNotes(c.notes ?? "");
        setCreatedAt(c.created_at);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    listChildCases(id).then(setChildren).catch(() => setChildren([]));
  }, [mode, id]);

  // Parent options: any case except self (prevents the simplest cycle).
  const parentOptions = useMemo(
    () => allCases.filter((c) => c.id !== id),
    [allCases, id],
  );

  // Expected documents for the currently-selected case type → drives the doc slots.
  const expectedDocs: DocType[] = useMemo(
    () => caseTypes.find((ct) => ct.id === caseTypeId)?.expected_documents ?? [],
    [caseTypes, caseTypeId],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !caseTypeId) {
      setError(t("caseForm.required"));
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      case_type_id: caseTypeId,
      parent_id: parentId,
      counterparty_id: counterpartyId,
      status,
      currency: currency || null,
      total_amount: totalAmount.trim() === "" ? null : Number(totalAmount),
      due_date: dueDate || null,
      notes: notes.trim() || null,
    };
    try {
      if (mode === "create") {
        const created = await createCase(payload);
        navigate(`/cases/${created.id}`);
      } else if (id) {
        await updateCase(id, payload);
        navigate("/");
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    const msg =
      children.length > 0
        ? t("caseForm.deleteConfirmChildren", { n: children.length })
        : t("caseForm.deleteConfirm");
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      await deleteCase(id);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("caseForm.notFound")}</p>
        <Button asChild variant="outline">
          <Link to="/">{t("common.back")}</Link>
        </Button>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {mode === "create" ? t("caseForm.newTitle") : t("caseForm.editTitle")}
        </h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">{t("common.back")}</Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="title">{t("caseForm.title")} *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="case_type">{t("caseForm.caseType")} *</Label>
          <Select
            id="case_type"
            value={caseTypeId}
            onChange={(e) => setCaseTypeId(e.target.value)}
            required
          >
            <option value="" disabled>
              {t("caseForm.selectType")}
            </option>
            {GROUP_ORDER.map((group) => {
              const types = caseTypes.filter((ct) => ct.group === group);
              if (types.length === 0) return null;
              return (
                <optgroup key={group} label={tl(groupLabel[group])}>
                  {types.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {tl({ he: ct.name_he, en: ct.name_en })}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        </div>

        <CounterpartySelect value={counterpartyId} onChange={setCounterpartyId} />

        <div className="grid gap-2">
          <Label htmlFor="parent">{t("caseForm.parent")}</Label>
          <Select
            id="parent"
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value || null)}
          >
            <option value="">{t("caseForm.parentNone")}</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="status">{t("caseForm.status")}</Label>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CaseStatus)}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tl(statusLabel[s])}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="due_date">{t("caseForm.dueDate")}</Label>
            <Input
              id="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="currency">{t("caseForm.currency")}</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="">—</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="total">{t("caseForm.total")}</Label>
            <Input
              id="total"
              type="number"
              step="0.01"
              dir="ltr"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">{t("caseForm.notes")}</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? t("common.saving") : mode === "create" ? t("common.create") : t("common.save")}
          </Button>
          {mode === "edit" && (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {t("common.delete")}
            </Button>
          )}
        </div>
      </form>

      {mode === "edit" && id && <DocumentsSection caseId={id} expectedDocs={expectedDocs} />}

      {mode === "edit" && id && (
        <SpendSummary
          budget={totalAmount.trim() === "" ? null : Number(totalAmount)}
          spent={orderSpent + workCost}
          currency={currency || "ILS"}
        />
      )}

      {mode === "edit" && id && <WorkItemsSection caseId={id} onCostChange={setWorkCost} />}

      {mode === "edit" && id && <OrdersSection caseId={id} onTotalChange={setOrderSpent} />}

      {mode === "edit" && id && <MilestonesSection caseId={id} />}

      {mode === "edit" && id && createdAt && (
        <CaseTimeline caseId={id} createdAt={createdAt} />
      )}

      {mode === "edit" && id && (
        <section className="space-y-2 border-t pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("caseForm.childrenTitle")} ({children.length})
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to={`/cases/new?parent=${id}`}>+ {t("caseForm.addChild")}</Link>
            </Button>
          </div>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("caseForm.noChildren")}</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {children.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/cases/${c.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-accent"
                  >
                    <span>
                      {c.title}
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        · {c.case_type ? tl({ he: c.case_type.name_he, en: c.case_type.name_en }) : ""}
                      </span>
                    </span>
                    <Badge className={statusBadgeClass[c.status]}>
                      {tl(statusLabel[c.status])}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
