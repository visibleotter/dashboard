import { useEffect, useState } from "react";
import {
  createWorkItem,
  deleteWorkItem,
  listWorkItems,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PersonSelect } from "@/components/PersonSelect";

const STAGES = ["Design", "Orders", "Assembling", "Instalation", "Testing"];

/* Project work-items (Notion "Tasks"): add, list, delete. Reports total cost up via onCostChange. */
export function WorkItemsSection({
  caseId,
  onCostChange,
}: {
  caseId: string;
  onCostChange?: (total: number) => void;
}) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<WorkItemWithRefs[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [cost, setCost] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listWorkItems(caseId).then(setItems).catch((e) => setError(e.message));
  }, [caseId]);

  // Report total work-item cost up so the case Spend bar can add it to orders.
  useEffect(() => {
    onCostChange?.(items.reduce((s, w) => s + (w.cost != null ? Number(w.cost) : 0), 0));
  }, [items, onCostChange]);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkItem({
        case_id: caseId,
        name: name.trim(),
        stage: stage || null,
        status: status.trim() || null,
        cost: cost === "" ? null : Number(cost),
        assignee_id: assigneeId,
        due_date: dueDate || null,
      });
      setItems(await listWorkItems(caseId));
      setName(""); setStage(""); setStatus(""); setCost(""); setAssigneeId(null); setDueDate("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(w: WorkItemWithRefs) {
    if (!window.confirm(t("workItems.deleteConfirm"))) return;
    try {
      await deleteWorkItem(w.id);
      setItems((prev) => prev.filter((x) => x.id !== w.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("workItems.title")} ({items.length})
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? t("common.cancel") : t("workItems.add")}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {adding && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="wi-name">{t("workItems.name")}</Label>
            <Input id="wi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("workItems.namePlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-stage">{t("workItems.stage")}</Label>
            <Select id="wi-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">—</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-status">{t("workItems.status")}</Label>
            <Input id="wi-status" value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-cost">{t("workItems.cost")}</Label>
            <Input id="wi-cost" type="number" step="0.01" dir="ltr" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-due">{t("workItems.dueDate")}</Label>
            <Input id="wi-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>{t("workItems.assignee")}</Label>
            <PersonSelect value={assigneeId} onChange={setAssigneeId} />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !name.trim()}>
              {saving ? t("common.saving") : t("common.add")}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("workItems.none")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{w.name}</span>
                  {w.stage && <Badge className="bg-white/10 text-neutral-300">{w.stage}</Badge>}
                  {w.status && <Badge className="bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25">{w.status}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {w.assignee?.name ?? "—"}
                  {w.cost != null && ` · ${Number(w.cost).toLocaleString(lang === "he" ? "he-IL" : "en-GB")} ₪`}
                  {w.due_date && ` · ${formatDate(w.due_date, lang)}`}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(w)}>
                {t("common.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
