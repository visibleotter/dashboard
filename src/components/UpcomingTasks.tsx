import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTasks, updateTask, type TaskWithCase } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate, relativeDays, urgencyMeta, urgencyOf } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";

/* Dashboard widget: the next open tasks with a due date, soonest first. */
export function UpcomingTasks({ limit = 6 }: { limit?: number }) {
  const { t, tl, lang } = useI18n();
  const [tasks, setTasks] = useState<TaskWithCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTasks().then(setTasks).catch((e) => setError(e.message));
  }, []);

  async function toggle(task: TaskWithCase) {
    setTasks((prev) => prev?.filter((x) => x.id !== task.id) ?? null);
    try {
      await updateTask(task.id, { done: true });
    } catch {
      setTasks(await listTasks());
    }
  }

  const upcoming = (tasks ?? []).filter((x) => !x.done && x.due_date).slice(0, limit);

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{t("upcoming.title")}</h2>
        <Link to="/tasks" className="text-xs text-primary hover:underline">
          {t("upcoming.all")}
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {tasks !== null && upcoming.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("upcoming.none")}</p>
      )}

      <ul className="space-y-2">
        {upcoming.map((task) => {
          const u = urgencyOf(task.due_date!);
          return (
            <li key={task.id} className="flex items-center gap-3">
              <input type="checkbox" onChange={() => toggle(task)} className="size-4" aria-label={t("tasks.done")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{task.text}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(task.due_date, lang)} · {relativeDays(task.due_date!, lang)}
                  {task.case && (
                    <>
                      {" · "}
                      <Link to={`/cases/${task.case.id}`} className="text-primary hover:underline">
                        {task.case.title}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <Badge className={urgencyMeta[u].cls}>{tl(urgencyMeta[u])}</Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
