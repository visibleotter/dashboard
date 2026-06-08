import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2 } from "lucide-react";
import {
  createTask,
  deleteTask,
  listTasksForBoard,
  updateTaskKanban,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { taskPriorityLabel } from "@/lib/labels";
import { ALL_KANBAN_STATUSES, type KanbanStatus, type TaskRow } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AttachmentList } from "@/components/AttachmentList";

/*
  Per-case Kanban — 4 columns (todo / doing / blocked / done), real DnD via
  @dnd-kit. Each column is its own droppable area; each task is draggable.
  When a card moves between columns we set kanban_status; when it lands at
  the top/bottom of a column we set kanban_order to the midpoint between
  the surrounding rows so we never need to re-number.
*/

export function TaskBoard({ caseId }: { caseId: string }) {
  const { t, tl, lang } = useI18n();
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTasksForBoard(caseId).then(setTasks).catch((e) => setError(e.message));
  }, [caseId]);

  const byColumn = useMemo(() => {
    const m: Record<KanbanStatus, TaskRow[]> = { todo: [], doing: [], blocked: [], done: [] };
    for (const t of tasks ?? []) m[t.kanban_status].push(t);
    return m;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  async function handleDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id);
    const targetCol = e.over?.id;
    if (!targetCol || typeof targetCol !== "string") return;
    if (!ALL_KANBAN_STATUSES.includes(targetCol as KanbanStatus)) return;
    const col = targetCol as KanbanStatus;

    const moved = tasks?.find((t) => t.id === taskId);
    if (!moved || moved.kanban_status === col) return;

    // Append to end of target column: order = max(order in col) + 1
    const targetMax = byColumn[col].reduce((m, t) => Math.max(m, Number(t.kanban_order ?? 0)), 0);
    const newOrder = targetMax + 1;

    // Optimistic update
    setTasks((prev) => (prev ?? []).map((t) => t.id === taskId ? { ...t, kanban_status: col, kanban_order: newOrder } : t));

    try {
      await updateTaskKanban(taskId, { kanban_status: col, kanban_order: newOrder });
    } catch (err) {
      setError((err as Error).message);
      // Re-fetch to revert
      setTasks(await listTasksForBoard(caseId));
    }
  }

  async function handleAddTask(col: KanbanStatus, text: string) {
    if (!text.trim()) return;
    const order = (byColumn[col].reduce((m, t) => Math.max(m, Number(t.kanban_order ?? 0)), 0)) + 1;
    await createTask({
      case_id: caseId,
      text: text.trim(),
    });
    // The createTask doesn't carry kanban_status — patch immediately after
    // to land it in the right column (the default is "todo" so we only need
    // to update when adding to another column).
    const fresh = await listTasksForBoard(caseId);
    setTasks(fresh);
    if (col !== "todo") {
      const justAdded = fresh.find((f) => f.text === text.trim() && f.kanban_status === "todo");
      if (justAdded) {
        await updateTaskKanban(justAdded.id, { kanban_status: col, kanban_order: order });
        setTasks(await listTasksForBoard(caseId));
      }
    }
  }

  const [pendingDelete, setPendingDelete] = useState<TaskRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTask(pendingDelete.id);
      setTasks((prev) => (prev ?? []).filter((t) => t.id !== pendingDelete.id));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (tasks === null) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {t("kanban.title")}
      </h3>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_KANBAN_STATUSES.map((col) => (
            <Column
              key={col}
              col={col}
              tasks={byColumn[col]}
              onAdd={(text) => handleAddTask(col, text)}
              onDelete={setPendingDelete}
              t={t}
              tl={tl}
              lang={lang}
            />
          ))}
        </div>
      </DndContext>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("tasks.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

// ── Column ─────────────────────────────────────────────────────────────────

const COLUMN_META: Record<KanbanStatus, { labelKey: string; cls: string; dot: string }> = {
  todo:    { labelKey: "kanban.todo",    cls: "bg-gray-50 text-gray-700 ring-1 ring-gray-200", dot: "bg-gray-400" },
  doing:   { labelKey: "kanban.doing",   cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-500" },
  blocked: { labelKey: "kanban.blocked", cls: "bg-red-50 text-red-700 ring-1 ring-red-200", dot: "bg-red-500" },
  done:    { labelKey: "kanban.done",    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" },
};

function Column({
  col,
  tasks,
  onAdd,
  onDelete,
  t,
  tl,
  lang,
}: {
  col: KanbanStatus;
  tasks: TaskRow[];
  onAdd: (text: string) => void;
  onDelete: (task: TaskRow) => void;
  t: (k: string) => string;
  tl: (l: { he: string; en: string }) => string;
  lang: "he" | "en";
}) {
  const { isOver, setNodeRef } = useDroppable({ id: col });
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const meta = COLUMN_META[col];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card transition-colors ${
        isOver ? "border-primary/30 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
          <span className={`size-1.5 rounded-full ${meta.dot}`} />
          {t(meta.labelKey)}
          <span className="text-muted-foreground">· {tasks.length}</span>
        </span>
        <IconButton
          variant="primary"
          size="sm"
          onClick={() => setAdding(true)}
          title={t("kanban.add")}
          aria-label={t("kanban.add")}
        >
          <Plus />
        </IconButton>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(text);
            setText("");
            setAdding(false);
          }}
          className="space-y-1.5"
        >
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("kanban.taskPlaceholder")}
          />
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" disabled={!text.trim()}>{t("common.add")}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setText(""); }}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2 min-h-[80px]">
        {tasks.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground italic px-1 py-2">{t("kanban.emptyColumn")}</p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDelete={onDelete}
            t={t}
            tl={tl}
            lang={lang}
          />
        ))}
      </div>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onDelete,
  t,
  tl,
  lang,
}: {
  task: TaskRow;
  onDelete: (task: TaskRow) => void;
  t: (k: string) => string;
  tl: (l: { he: string; en: string }) => string;
  lang: "he" | "en";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-lg border bg-white p-2.5 shadow-sm hover:shadow transition-shadow"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="flex-1 min-w-0 text-start text-sm font-medium text-foreground cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        >
          {task.text}
        </button>
        <IconButton
          variant="destructive"
          size="sm"
          onClick={() => onDelete(task)}
          aria-label={t("tasks.deleteConfirm")}
          title={t("tasks.deleteConfirm")}
          className="hidden group-hover:inline-flex"
        >
          <Trash2 />
        </IconButton>
      </div>
      {task.notes && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
          {task.notes}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge className={taskPriorityLabel[task.priority].cls}>
          {tl(taskPriorityLabel[task.priority])}
        </Badge>
        {task.due_date && (
          <span className="text-xs text-muted-foreground" dir="ltr">
            {formatDate(task.due_date, lang)}
          </span>
        )}
        <span className="ms-auto">
          <AttachmentList entityType="task" entityId={task.id} compact />
        </span>
      </div>
    </div>
  );
}
