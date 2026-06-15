import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createOrder,
  createTask,
  deleteOrder,
  deleteTask,
  listCounterparties,
  listOrders,
  listTasksForCase,
  updateOrder,
  updateTask,
  type OrderWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AttachmentList } from "@/components/AttachmentList";
import type { Counterparty, TaskRow } from "@/types/db";

// ─── Shared input style ────────────────────────────────────────────────────
const FIELD =
  "rounded border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40";

/*
  Inline preview rendered under an expanded project row on the dashboard.
  Shows the case's orders and linked tasks — work items have been removed,
  tasks are now the single concept for "things to do".
*/
export function CaseWorkPreview({ caseId }: { caseId: string }) {
  const { t, lang } = useI18n();
  const [orders, setOrders] = useState<OrderWithRefs[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [error, setError] = useState<string | null>(null);

  // add-order form
  const [addingOrder, setAddingOrder] = useState(false);
  const [orderTitle, setOrderTitle] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderSupplier, setOrderSupplier] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  // inline edit-order
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editOrderTitle, setEditOrderTitle] = useState("");
  const [editOrderPrice, setEditOrderPrice] = useState("");
  const [editOrderSupplier, setEditOrderSupplier] = useState("");
  const [editOrderDate, setEditOrderDate] = useState("");
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);

  // add-task form
  const [addingTask, setAddingTask] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // polymorphic delete dialog (order | task)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "order"; id: string }
    | { kind: "task"; id: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  async function load() {
    const [ord, tks] = await Promise.all([
      listOrders(caseId),
      listTasksForCase(caseId),
    ]);
    setOrders(ord);
    setTasks(tks);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      listOrders(caseId),
      listTasksForCase(caseId),
      listCounterparties(),
    ])
      .then(([ord, tks, cps]) => {
        if (!active) return;
        setOrders(ord);
        setTasks(tks);
        setCounterparties(cps);
      })
      .catch((e) => setError(e.message));
    return () => { active = false; };
  }, [caseId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderTitle.trim()) return;
    setSavingOrder(true);
    try {
      await createOrder({
        case_id: caseId,
        work_item_id: null,
        title: orderTitle.trim(),
        price: orderPrice ? Number(orderPrice) : null,
        supplier_id: orderSupplier || null,
        order_date: orderDate || null,
      });
      setOrderTitle(""); setOrderPrice(""); setOrderSupplier(""); setOrderDate("");
      setAddingOrder(false);
      await load();
    } finally { setSavingOrder(false); }
  }

  function openOrderEdit(o: OrderWithRefs) {
    setEditingOrderId(o.id);
    setEditOrderTitle(o.title);
    setEditOrderPrice(o.price != null ? String(o.price) : "");
    setEditOrderSupplier(o.supplier_id ?? "");
    setEditOrderDate(o.order_date ?? "");
  }

  async function handleSaveOrderEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOrderId || !editOrderTitle.trim()) return;
    setSavingOrderEdit(true);
    try {
      await updateOrder(editingOrderId, {
        title: editOrderTitle.trim(),
        price: editOrderPrice ? Number(editOrderPrice) : null,
        supplier_id: editOrderSupplier || null,
        order_date: editOrderDate || null,
      });
      setEditingOrderId(null);
      await load();
    } finally { setSavingOrderEdit(false); }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskText.trim()) return;
    setSavingTask(true);
    try {
      await createTask({
        case_id: caseId,
        text: taskText.trim(),
        due_date: taskDue || null,
      });
      setTaskText(""); setTaskDue(""); setAddingTask(false);
      await load();
    } finally { setSavingTask(false); }
  }

  async function handleToggleTask(task: TaskRow) {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t));
    await updateTask(task.id, { done: !task.done });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "order") await deleteOrder(pendingDelete.id);
      else await deleteTask(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } finally { setDeleting(false); }
  }

  if (error) return <p className="px-4 pb-3 text-xs text-destructive">{error}</p>;
  if (orders === null) return <p className="px-4 pb-3 text-xs text-muted-foreground">{t("common.loading")}</p>;

  // ── Render ───────────────────────────────────────────────────────────────

  const editOrderForm = (
    <form
      onSubmit={handleSaveOrderEdit}
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <input
        autoFocus
        className={`min-w-0 flex-1 ${FIELD}`}
        placeholder={t("orders.name")}
        value={editOrderTitle}
        onChange={(e) => setEditOrderTitle(e.target.value)}
      />
      <input type="number" step="0.01" className={`w-20 ${FIELD}`} placeholder={t("orders.price")} value={editOrderPrice} onChange={(e) => setEditOrderPrice(e.target.value)} />
      <select className={FIELD} value={editOrderSupplier} onChange={(e) => setEditOrderSupplier(e.target.value)}>
        <option value="">— {t("orders.supplier")} —</option>
        {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
      </select>
      <input type="date" className={FIELD} value={editOrderDate} onChange={(e) => setEditOrderDate(e.target.value)} />
      <Button type="submit" size="sm" disabled={savingOrderEdit || !editOrderTitle.trim()}>
        {savingOrderEdit ? "…" : t("common.save")}
      </Button>
      <IconButton size="sm" onClick={() => setEditingOrderId(null)} aria-label={t("common.cancel")}>
        <X />
      </IconButton>
    </form>
  );

  return (
    <div className="space-y-3 border-t bg-gray-50/60 px-4 py-3">
      {/* Orders */}
      <div className="rounded-lg border bg-white px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t("orders.title")}</span>
          {!addingOrder && (
            <Button size="sm" variant="outline" onClick={() => setAddingOrder(true)}>
              <Plus />
              {t("orders.add")}
            </Button>
          )}
        </div>

        {addingOrder && (
          <form onSubmit={handleAddOrder} className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border bg-gray-50 px-3 py-2">
            <input
              autoFocus
              className={`min-w-0 flex-1 ${FIELD}`}
              placeholder={t("orders.name")}
              value={orderTitle}
              onChange={(e) => setOrderTitle(e.target.value)}
            />
            <input type="number" step="0.01" className={`w-20 ${FIELD}`} placeholder={t("orders.price")} value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} />
            <select className={FIELD} value={orderSupplier} onChange={(e) => setOrderSupplier(e.target.value)}>
              <option value="">— {t("orders.supplier")} —</option>
              {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
            </select>
            <input type="date" className={FIELD} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            <Button type="submit" size="sm" disabled={savingOrder || !orderTitle.trim()}>
              {savingOrder ? "…" : t("common.add")}
            </Button>
            <IconButton size="sm" onClick={() => setAddingOrder(false)} aria-label={t("common.cancel")}>
              <X />
            </IconButton>
          </form>
        )}

        {orders.length === 0 && !addingOrder && (
          <p className="px-1 py-1 text-xs text-muted-foreground italic">{t("orders.none")}</p>
        )}

        {orders.map((o) => {
          if (editingOrderId === o.id) return <div key={o.id}>{editOrderForm}</div>;
          return (
            <div
              key={o.id}
              className="group flex items-center justify-between gap-3 rounded px-1 py-1 text-xs hover:bg-gray-50 cursor-pointer"
              onClick={() => openOrderEdit(o)}
              title={t("orders.editClick")}
            >
              <span className="min-w-0 truncate text-muted-foreground">
                ↳ {o.title}
                {o.supplier?.name ? ` · ${o.supplier.name}` : ""}
                {o.order_date ? ` · ${formatDate(o.order_date, lang)}` : ""}
              </span>
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span dir="ltr">{o.price != null ? `${money(Number(o.price))} ${o.currency ?? ""}` : "—"}</span>
                <AttachmentList entityType="order" entityId={o.id} compact />
                <IconButton
                  variant="destructive"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: "order", id: o.id }); }}
                  title={t("orders.deleteConfirm")}
                  aria-label={t("orders.deleteConfirm")}
                  className="hidden group-hover:inline-flex"
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tasks */}
      <div className="rounded-lg border bg-white px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t("tasks.title")}</span>
          {!addingTask && (
            <Button size="sm" variant="outline" onClick={() => setAddingTask(true)}>
              <Plus />
              {t("inlineTasks.add")}
            </Button>
          )}
        </div>

        {addingTask && (
          <form onSubmit={handleAddTask} className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              className={`min-w-0 flex-1 ${FIELD}`}
              placeholder={t("inlineTasks.addPlaceholder")}
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
            />
            <input type="date" className={FIELD} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <Button type="submit" size="sm" disabled={savingTask || !taskText.trim()}>
              {savingTask ? "…" : t("common.add")}
            </Button>
            <IconButton size="sm" onClick={() => { setAddingTask(false); setTaskText(""); setTaskDue(""); }} aria-label={t("common.cancel")}>
              <X />
            </IconButton>
          </form>
        )}

        {tasks.length === 0 && !addingTask && (
          <p className="px-1 py-1 text-xs text-muted-foreground italic">{t("inlineTasks.none")}</p>
        )}

        {tasks.map((tk) => (
          <div key={tk.id} className="group flex items-center gap-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={tk.done}
              onChange={() => handleToggleTask(tk)}
              className="size-3.5 accent-primary"
            />
            <span className={`min-w-0 flex-1 truncate ${tk.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {tk.text}
            </span>
            {tk.due_date && (
              <span className="text-muted-foreground" dir="ltr">{formatDate(tk.due_date, lang)}</span>
            )}
            <AttachmentList entityType="task" entityId={tk.id} compact />
            <IconButton
              variant="destructive"
              size="sm"
              onClick={() => setPendingDelete({ kind: "task", id: tk.id })}
              aria-label={t("inlineTasks.deleteConfirm")}
              title={t("inlineTasks.deleteConfirm")}
              className="hidden group-hover:inline-flex"
            >
              <Trash2 />
            </IconButton>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === "order" ? t("orders.deleteConfirm") : t("inlineTasks.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
