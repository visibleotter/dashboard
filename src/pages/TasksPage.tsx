import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createTask,
  deleteTask,
  listCases,
  listTasks,
  updateTask,
  type CaseWithRelations,
  type TaskWithCase,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { ALL_TASK_PRIORITIES, taskPriorityLabel } from "@/lib/labels";
import { URGENCY_ORDER, formatDate, relativeDays, urgencyMeta, urgencyOf } from "@/lib/dates";
import type { TaskPriority } from "@/types/db";
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

  useEffect(() => {
    listTasks().then(setTasks).catch((e) => setError(e.message));
    listCases().then(setCases).catch(() => setCases([]));
  }, []);

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
      <div>
        <h1 className="text-2xl font-semibold">{t("tasks.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tasks.subtitle")}</p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
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
