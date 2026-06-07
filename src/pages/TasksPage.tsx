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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Optional order attached to the task being created ─────────────────
  // Order is linked to the SAME case as the task. Requires a case to be picked.
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [attachOrder, setAttachOrder] = useState(false);
  const [oWorkItems, setOWorkItems] = useState<WorkItemWithRefs[]>([]);
  const [oWorkItemId, setOWorkItemId] = useState("");
  const [oTitle, setOTitle] = useState("");
  const [oPrice, setOPrice] = useState("");
  const [oSupplier, setOSupplier] = useState("");
  const [oDate, setODate] = useState("");

  useEffect(() => {
    listTasks().then(setTasks).catch((e) => setError(e.message));
    listCases().then(setCases).catch(() => setCases([]));
    listCounterparties().then(setCounterparties).catch(() => setCounterparties([]));
  }, []);

  // When the task's case changes, refresh the work-item picker for the order
  useEffect(() => {
    setOWorkItemId("");
    if (!caseId) { setOWorkItems([]); return; }
    listWorkItems(caseId).then(setOWorkItems).catch(() => setOWorkItems([]));
  }, [caseId]);

  function resetAttachedOrder() {
    setAttachOrder(false);
    setOWorkItemId(""); setOTitle(""); setOPrice(""); setOSupplier(""); setODate("");
  }

  async function refresh() {
    setTasks(await listTasks());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    // If user enabled "attach order", a case + order title are required
    if (attachOrder && (!caseId || !oTitle.trim())) {
      setError(t("tasks.attachOrderNeedsCase"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTask({
        text: text.trim(),
        priority,
        due_date: dueDate || null,
        case_id: caseId || null,
        notes: notes.trim() || null,
      });
      if (attachOrder && caseId && oTitle.trim()) {
        await createOrder({
          case_id: caseId,
          work_item_id: oWorkItemId || null,
          title: oTitle.trim(),
          price: oPrice ? Number(oPrice) : null,
          supplier_id: oSupplier || null,
          order_date: oDate || null,
        });
      }
      setText(""); setPriority("med"); setDueDate(""); setCaseId(""); setNotes("");
      resetAttachedOrder();
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
            {task.notes && (
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.notes}</div>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
      <div>
        <h1 className="text-2xl font-semibold">{t("tasks.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tasks.subtitle")}</p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <form onSubmit={handleAdd} className="space-y-3 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
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
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="t-notes">{t("tasks.notes")}</Label>
          <Input
            id="t-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("tasks.notesPlaceholder")}
          />
        </div>

        {/* Optional: attach an order to the same case */}
        {!attachOrder ? (
          <button
            type="button"
            onClick={() => setAttachOrder(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            disabled={!caseId}
            title={!caseId ? t("tasks.attachOrderNeedsCase") : undefined}
          >
            <Plus className="size-3.5" /> {t("orders.attach")}
          </button>
        ) : (
          <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{t("orders.attach")}</span>
              <button
                type="button"
                onClick={resetAttachedOrder}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {!caseId ? (
              <p className="text-xs text-amber-700">{t("tasks.attachOrderNeedsCase")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-1">
                  <Label htmlFor="o-title" className="text-xs">{t("orders.name")} *</Label>
                  <Input id="o-title" value={oTitle} onChange={(e) => setOTitle(e.target.value)} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="o-wi" className="text-xs">{t("orders.workItem")}</Label>
                  <Select
                    id="o-wi"
                    value={oWorkItemId}
                    onChange={(e) => setOWorkItemId(e.target.value)}
                    disabled={oWorkItems.length === 0}
                  >
                    <option value="">— {t("orders.unassigned")} —</option>
                    {oWorkItems.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="o-supplier" className="text-xs">{t("orders.supplier")}</Label>
                  <Select id="o-supplier" value={oSupplier} onChange={(e) => setOSupplier(e.target.value)}>
                    <option value="">—</option>
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>{cp.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="o-price" className="text-xs">{t("orders.price")}</Label>
                  <Input id="o-price" type="number" step="0.01" dir="ltr" value={oPrice} onChange={(e) => setOPrice(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="o-date" className="text-xs">{t("orders.date")}</Label>
                  <Input id="o-date" type="date" value={oDate} onChange={(e) => setODate(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <Button type="submit" disabled={saving || !text.trim() || (attachOrder && (!caseId || !oTitle.trim()))}>
            {saving ? t("common.saving") : t("common.add")}
          </Button>
        </div>
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
