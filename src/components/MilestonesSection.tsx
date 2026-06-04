import { useEffect, useState } from "react";
import { createMilestone, deleteMilestone, listMilestones, setMilestonePaid } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import type { PaymentMilestone } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CURRENCIES = ["ILS", "USD", "CNY", "EUR"];

/* Staged payments within a case (e.g. 30/50/20): add, mark paid, delete. */
export function MilestonesSection({ caseId }: { caseId: string }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<PaymentMilestone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listMilestones(caseId).then(setItems).catch((e) => setError(e.message));
  }, [caseId]);

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createMilestone({
        case_id: caseId,
        label: label.trim(),
        percent: percent === "" ? null : Number(percent),
        amount: amount === "" ? null : Number(amount),
        currency: currency || null,
        due_date: dueDate || null,
      });
      setItems(await listMilestones(caseId));
      setLabel(""); setPercent(""); setAmount(""); setDueDate(""); setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(m: PaymentMilestone) {
    try {
      const updated = await setMilestonePaid(m.id, !m.paid);
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(m: PaymentMilestone) {
    if (!window.confirm(t("milestones.deleteConfirm", { name: m.label }))) return;
    try {
      await deleteMilestone(m.id);
      setItems((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const unpaidTotal = items
    .filter((m) => !m.paid && m.amount != null)
    .reduce((sum, m) => sum + Number(m.amount), 0);

  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("milestones.title")} ({items.length})
          {unpaidTotal > 0 && (
            <span className="ms-2 text-amber-700">
              · {t("milestones.openTotal", { amount: unpaidTotal.toLocaleString(lang === "he" ? "he-IL" : "en-GB") })}
            </span>
          )}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? t("common.cancel") : t("milestones.add")}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {adding && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-5 sm:items-end">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ms-label">{t("milestones.label")}</Label>
            <Input id="ms-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("milestones.labelPlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ms-percent">%</Label>
            <Input id="ms-percent" type="number" dir="ltr" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ms-amount">{t("milestones.amount")}</Label>
            <Input id="ms-amount" type="number" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ms-cur">{t("milestones.currency")}</Label>
            <Select id="ms-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ms-due">{t("milestones.dueDate")}</Label>
            <Input id="ms-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !label.trim()}>
            {saving ? t("common.saving") : t("common.add")}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("milestones.none")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={m.paid}
                onChange={() => togglePaid(m)}
                className="size-4"
                aria-label={t("milestones.paid")}
              />
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${m.paid ? "text-muted-foreground line-through" : ""}`}>
                  {m.label}
                  {m.percent != null && <span className="text-muted-foreground"> · {m.percent}%</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.amount != null ? `${Number(m.amount).toLocaleString(lang === "he" ? "he-IL" : "en-GB")} ${m.currency ?? ""}` : "—"}
                  {m.due_date && ` · ${formatDate(m.due_date, lang)}`}
                </div>
              </div>
              <Badge
                className={
                  m.paid
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25"
                    : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25"
                }
              >
                {m.paid ? t("milestones.paid") : t("milestones.unpaid")}
              </Badge>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(m)}>
                {t("common.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
