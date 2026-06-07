import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import {
  createOrder,
  createTask,
  deleteTask,
  listCases,
  listCounterparties,
  listTasks,
  listWorkItems,
  updateTask,
  type CaseWithRelations,
  type TaskWithCase,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { ALL_TASK_PRIORITIES, taskPriorityLabel } from "@/lib/labels";
import { URGENCY_ORDER, formatDate, relativeDays, urgencyMeta, urgencyOf } from "@/lib/dates";
import type { Counterparty, TaskPriority } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function TasksPage() {
  const { t, tl, lang } = useI18n();
  const [tasks, setTasks] = useState<TaskWithCase[] | null>(null);
  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("med");
  const [dueDate, setDueDate] = useState("");
  const [caseId, setCaseId] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Add-order panel (optional, top-of-page) ───────────────────────────
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [addingOrder, setAddingOrder] = useState(false);
  const [oCaseId, setOCaseId] = useState("");
  const [oWorkItems, setOWorkItems] = useState<WorkItemWithRefs[]>([]);
  const [oWorkItemId, setOWorkItemId] = useState("");
  const [oTitle, setOTitle] = useState("");
  const [oPrice, setOPrice] = useState("");
  const [oSupplier, setOSupplier] = useState("");
  const [oDate, setODate] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    listTasks().then(setTasks).catch((e) => setError(e.message));
    listCases().then(setCases).catch(() => setCases([]));
    listCounterparties().then(setCounterparties).catch(() => setCounterparties([]));
  }, []);

  // Refresh work items whenever the chosen case changes
  useEffect(() => {
    if (!oCaseId) { setOWorkItems([]); setOWorkItemId(""); return; }
    listWorkItems(oCaseId).then(setOWorkItems).catch(() => setOWorkItems([]));
    setOWorkItemId("");
  }, [oCaseId]);

  function resetOrderForm() {
    setOCaseId(""); setOWorkItemId(""); setOTitle("");
    setOPrice(""); setOSupplier(""); setODate("");
    setAddingOrder(false);
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!oCaseId || !oTitle.trim()) return;
    setSavingOrder(true);
    setError(null);
    try {
      await createOrder({
        case_id: oCaseId,
        work_item_id: oWorkItemId || null,
        title: oTitle.trim(),
        price: oPrice ? Number(oPrice) : null,
        supplier_id: oSupplier || null,
        order_date: oDate || null,
      });
      resetOrderForm();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function refresh() {
    setTasks(await listTasks());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTask({ text: text.trim(), priority, due_date: dueDate || null, case_id: caseId || null });
      setText(""); setPriority("med"); setDueDate(""); setCaseId("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: TaskWithCase) {
    setTasks((prev) => prev?.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)) ?? null);
    try {
      await updateTask(task.id, { done: !task.done });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(task: TaskWithCase) {
    if (!window.confirm(t("tasks.deleteConfirm"))) return;
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev?.filter((x) => x.id !== task.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const open = useMemo(() => (tasks ?? []).filter((x) => !x.done), [tasks]);
  const done = useMemo(() => (tasks ?? []).filter((x) => x.done), [tasks]);

  const list = (group: TaskWithCase[]) => (
    <ul className="divide-y rounded-lg border bg-card">
      {group.map((task) => (
        <li key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <input type="checkbox" checked={task.done} onChange={() => toggle(task)} className="size-4" aria-label={t("tasks.done")} />
          <div className="min-w-0 flex-1">
            <div className={`text-sm ${task.done ? "text-muted-foreground line-through" : "font-medium"}`}>{task.text}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.due_date && (
                <span>
                  {formatDate(task.due_date, lang)}
                  {!task.done && ` · ${relativeDays(task.due_date, lang)}`}
                </span>
              )}
              {task.case && (
                <Link to={`/cases/${task.case.id}`} className="text-primary hover:underline">
                  {task.case.title}
                </Link>
              )}
            </div>
          </div>
          <Badge className={taskPriorityLabel[task.priority].cls}>{tl(taskPriorityLabel[task.priority])}</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(task)}>
            {t("common.delete")}
          </Button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("tasks.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tasks.subtitle")}</p>
        </div>
        {!addingOrder && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAddingOrder(true)}
          >
            <Plus className="size-4" /> {t("orders.add")}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Optional Add-Order panel */}
      {addingOrder && (
        <form
          onSubmit={handleAddOrder}
          className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t("orders.add")}</h2>
            <button
              type="button"
              onClick={resetOrderForm}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="o-case">{t("tasks.caseOptional").replace(/\s*\(.+\)\s*$/, "")} *</Label>
              <Select id="o-case" value={oCaseId} onChange={(e) => setOCaseId(e.target.value)} required>
                <option value="">—</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-wi">{t("orders.workItem")}</Label>
              <Select
                id="o-wi"
                value={oWorkItemId}
                onChange={(e) => setOWorkItemId(e.target.value)}
                disabled={!oCaseId || oWorkItems.length === 0}
              >
                <option value="">— {t("orders.unassigned")} —</option>
                {oWorkItems.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-title">{t("orders.name")} *</Label>
              <Input id="o-title" value={oTitle} onChange={(e) => setOTitle(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-supplier">{t("orders.supplier")}</Label>
              <Select id="o-supplier" value={oSupplier} onChange={(e) => setOSupplier(e.target.value)}>
                <option value="">—</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-price">{t("orders.price")}</Label>
              <Input id="o-price" type="number" step="0.01" dir="ltr" value={oPrice} onChange={(e) => setOPrice(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-date">{t("orders.date")}</Label>
              <Input id="o-date" type="date" value={oDate} onChange={(e) => setODate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={savingOrder || !oCaseId || !oTitle.trim()}>
              {savingOrder ? t("common.saving") : t("common.add")}
            </Button>
            <Button type="button" variant="ghost" onClick={resetOrderForm}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <form onSubmit={handleAdd} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="t-text">{t("tasks.task")}</Label>
          <Input id="t-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("tasks.taskPlaceholder")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-prio">{t("tasks.priority")}</Label>
          <Select id="t-prio" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {ALL_TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {tl(taskPriorityLabel[p])}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-due">{t("tasks.dueDate")}</Label>
          <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-case">{t("tasks.caseOptional")}</Label>
          <Select id="t-case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="sm:w-44">
            <option value="">{t("tasks.caseNone")}</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={saving || !text.trim()}>
          {saving ? t("common.saving") : t("common.add")}
        </Button>
      </form>

      {tasks === null && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {tasks !== null && open.length === 0 && done.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("tasks.empty")}</p>
      )}

      {URGENCY_ORDER.map((u) => {
        const group = open.filter((x) => x.due_date && urgencyOf(x.due_date) === u);
        if (group.length === 0) return null;
        return (
          <section key={u} className="space-y-2">
            <h2 className="text-sm font-medium">
              <Badge className={urgencyMeta[u].cls}>{tl(urgencyMeta[u])}</Badge>
            </h2>
            {list(group)}
          </section>
        );
      })}

      {(() => {
        const nodate = open.filter((x) => !x.due_date);
        if (nodate.length === 0) return null;
        return (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t("tasks.noDate")}</h2>
            {list(nodate)}
          </section>
        );
      })()}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("tasks.done")} ({done.length})
          </h2>
          {list(done)}
        </section>
      )}
    </div>
  );
}
