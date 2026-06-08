import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createOrder,
  createTask,
  createWorkItem,
  deleteOrder,
  deleteTask,
  deleteWorkItem,
  listAllOrders,
  listCounterparties,
  listOrders,
  listTasksForCase,
  listWorkItems,
  updateOrder,
  updateTask,
  type OrderWithRefs,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { AttachmentList } from "@/components/AttachmentList";
import type { Counterparty, TaskRow } from "@/types/db";

// ─── Shared input style ────────────────────────────────────────────────────
const FIELD =
  "rounded border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40";

export function CaseWorkPreview({ caseId }: { caseId: string }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<WorkItemWithRefs[] | null>(null);
  const [orders, setOrders] = useState<OrderWithRefs[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [allOrders, setAllOrders] = useState<OrderWithRefs[]>([]);
  const [error, setError] = useState<string | null>(null);

  // add-work-item form state (now includes optional attached order)
  const [addingWI, setAddingWI] = useState(false);
  const [wiName, setWiName] = useState("");
  const [wiCost, setWiCost] = useState("");
  const [wiAttachOrder, setWiAttachOrder] = useState(false);
  const [wiOrderMode, setWiOrderMode] = useState<"new" | "existing">("new");
  const [wiOrderExistingId, setWiOrderExistingId] = useState("");
  const [wiOrderTitle, setWiOrderTitle] = useState("");
  const [wiOrderPrice, setWiOrderPrice] = useState("");
  const [wiOrderSupplier, setWiOrderSupplier] = useState("");
  const [wiOrderDate, setWiOrderDate] = useState("");
  const [savingWI, setSavingWI] = useState(false);

  // add-order form: keyed by work_item_id (or "" for unassigned)
  const [addingOrderFor, setAddingOrderFor] = useState<string | null>(null);
  const [orderTitle, setOrderTitle] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderSupplier, setOrderSupplier] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  // inline edit-order state
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

  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  async function load() {
    const [wi, ord, tks] = await Promise.all([
      listWorkItems(caseId),
      listOrders(caseId),
      listTasksForCase(caseId),
    ]);
    setItems(wi);
    setOrders(ord);
    setTasks(tks);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      listWorkItems(caseId),
      listOrders(caseId),
      listTasksForCase(caseId),
      listCounterparties(),
      listAllOrders(),
    ])
      .then(([wi, ord, tks, cps, allOrd]) => {
        if (!active) return;
        setItems(wi);
        setOrders(ord);
        setTasks(tks);
        setCounterparties(cps);
        setAllOrders(allOrd);
      })
      .catch((e) => setError(e.message));
    return () => { active = false; };
  }, [caseId]);

  const ordersByWi = useMemo(() => {
    const m = new Map<string, OrderWithRefs[]>();
    for (const o of orders) {
      if (!o.work_item_id) continue;
      const arr = m.get(o.work_item_id) ?? [];
      arr.push(o);
      m.set(o.work_item_id, arr);
    }
    return m;
  }, [orders]);
  const unassigned = useMemo(() => orders.filter((o) => !o.work_item_id), [orders]);

  // Existing orders available to clone — exclude this case's own orders to avoid noise.
  const reusableOrders = useMemo(
    () => allOrders.filter((o) => o.case_id !== caseId),
    [allOrders, caseId],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleDeleteWI(id: string) {
    if (!confirm(t("workItems.deleteConfirm"))) return;
    await deleteWorkItem(id);
    await load();
  }

  async function handleDeleteOrder(id: string) {
    if (!confirm(t("orders.deleteConfirm"))) return;
    await deleteOrder(id);
    await load();
  }

  function resetWIForm() {
    setWiName(""); setWiCost("");
    setWiAttachOrder(false);
    setWiOrderMode("new");
    setWiOrderExistingId("");
    setWiOrderTitle(""); setWiOrderPrice(""); setWiOrderSupplier(""); setWiOrderDate("");
    setAddingWI(false);
  }

  async function handleAddWI(e: React.FormEvent) {
    e.preventDefault();
    if (!wiName.trim()) return;
    setSavingWI(true);
    try {
      const newWI = await createWorkItem({
        case_id: caseId,
        name: wiName.trim(),
        cost: wiCost ? Number(wiCost) : null,
      });
      // Optional attached order
      if (wiAttachOrder) {
        if (wiOrderMode === "existing" && wiOrderExistingId) {
          const source = reusableOrders.find((o) => o.id === wiOrderExistingId);
          if (source) {
            await createOrder({
              case_id: caseId,
              work_item_id: newWI.id,
              title: source.title,
              price: source.price,
              currency: source.currency,
              supplier_id: source.supplier_id,
              order_date: source.order_date,
              tracking_number: source.tracking_number,
              notes: source.notes,
            });
          }
        } else if (wiOrderMode === "new" && wiOrderTitle.trim()) {
          await createOrder({
            case_id: caseId,
            work_item_id: newWI.id,
            title: wiOrderTitle.trim(),
            price: wiOrderPrice ? Number(wiOrderPrice) : null,
            supplier_id: wiOrderSupplier || null,
            order_date: wiOrderDate || null,
          });
        }
      }
      resetWIForm();
      await load();
    } finally { setSavingWI(false); }
  }

  function openOrderForm(workItemId: string) {
    setAddingOrderFor(workItemId);
    setOrderTitle(""); setOrderPrice(""); setOrderSupplier(""); setOrderDate("");
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderTitle.trim() || addingOrderFor === null) return;
    setSavingOrder(true);
    try {
      await createOrder({
        case_id: caseId,
        work_item_id: addingOrderFor || null,
        title: orderTitle.trim(),
        price: orderPrice ? Number(orderPrice) : null,
        supplier_id: orderSupplier || null,
        order_date: orderDate || null,
      });
      setAddingOrderFor(null);
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
    // Optimistic toggle
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t));
    await updateTask(task.id, { done: !task.done });
  }

  async function handleDeleteTask(id: string) {
    if (!confirm(t("inlineTasks.deleteConfirm"))) return;
    await deleteTask(id);
    await load();
  }

  if (error) return <p className="px-4 pb-3 text-xs text-destructive">{error}</p>;
  if (items === null) return <p className="px-4 pb-3 text-xs text-muted-foreground">{t("common.loading")}</p>;

  // ── Inline forms ─────────────────────────────────────────────────────────

  const addOrderForm = () => (
    <form onSubmit={handleAddOrder} className="ms-6 mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border bg-gray-50 px-3 py-2">
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
      <button type="submit" disabled={savingOrder || !orderTitle.trim()} className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50">
        {savingOrder ? "…" : t("common.add")}
      </button>
      <button type="button" onClick={() => setAddingOrderFor(null)} className="text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </form>
  );

  const editOrderForm = () => (
    <form
      onSubmit={handleSaveOrderEdit}
      className="ms-6 mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
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
      <button type="submit" disabled={savingOrderEdit || !editOrderTitle.trim()} className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50">
        {savingOrderEdit ? "…" : t("common.save")}
      </button>
      <button type="button" onClick={() => setEditingOrderId(null)} className="text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </form>
  );

  const orderLine = (o: OrderWithRefs) => {
    if (editingOrderId === o.id) return <div key={o.id}>{editOrderForm()}</div>;
    return (
      <div
        key={o.id}
        className="group flex items-center justify-between gap-3 ps-6 pe-2 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer"
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
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id); }}
            className="hidden text-muted-foreground hover:text-red-500 group-hover:inline-flex"
            title={t("orders.deleteConfirm")}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-1.5 border-t bg-gray-50/60 px-4 py-3">
      {/* Work items + nested orders */}
      {items.map((w) => (
        <div key={w.id} className="rounded-lg border bg-white px-3 py-2">
          <div className="group flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{w.name}</span>
              {w.status && (
                <Badge className="bg-sky-50 text-sky-700 ring-1 ring-sky-200 text-xs">{w.status}</Badge>
              )}
              {w.assignee?.name && (
                <span className="text-xs text-muted-foreground">{w.assignee.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {w.cost != null && (
                <span className="text-xs text-muted-foreground" dir="ltr">{money(Number(w.cost))} ₪</span>
              )}
              <button
                type="button"
                onClick={() => openOrderForm(w.id)}
                className="hidden items-center gap-1 text-xs text-primary hover:underline group-hover:flex"
              >
                <Plus className="size-3" /> {t("orders.add")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteWI(w.id)}
                className="hidden text-muted-foreground hover:text-red-500 group-hover:inline-flex"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          {(ordersByWi.get(w.id) ?? []).map(orderLine)}
          {addingOrderFor === w.id && addOrderForm()}
        </div>
      ))}

      {/* Unassigned orders */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border bg-white px-3 py-2">
          <div className="group flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("orders.unassigned")}</span>
            <button
              type="button"
              onClick={() => openOrderForm("")}
              className="hidden items-center gap-1 text-xs text-primary hover:underline group-hover:flex"
            >
              <Plus className="size-3" /> {t("orders.add")}
            </button>
          </div>
          {unassigned.map(orderLine)}
          {addingOrderFor === "" && addOrderForm()}
        </div>
      )}

      {/* Add work item — with optional attached order */}
      {addingWI ? (
        <form onSubmit={handleAddWI} className="space-y-2 rounded-lg border bg-white px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              className={`min-w-0 flex-1 ${FIELD} text-sm`}
              placeholder={t("workItems.namePlaceholder")}
              value={wiName}
              onChange={(e) => setWiName(e.target.value)}
            />
            <input type="number" step="0.01" className={`w-24 ${FIELD} text-sm`} placeholder={t("workItems.cost")} value={wiCost} onChange={(e) => setWiCost(e.target.value)} />
          </div>

          {/* Optional attach-order toggle */}
          {!wiAttachOrder ? (
            <button
              type="button"
              onClick={() => setWiAttachOrder(true)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="size-3" /> {t("orders.attach")}
            </button>
          ) : (
            <div className="space-y-1.5 rounded-md bg-gray-50 p-2">
              <div className="flex items-center justify-between text-xs">
                <div className="inline-flex gap-1 rounded-full bg-white p-0.5 ring-1 ring-gray-200">
                  <button
                    type="button"
                    onClick={() => setWiOrderMode("new")}
                    className={`rounded-full px-2 py-0.5 ${wiOrderMode === "new" ? "bg-primary text-white" : "text-muted-foreground"}`}
                  >
                    {t("orders.newOne")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWiOrderMode("existing")}
                    className={`rounded-full px-2 py-0.5 ${wiOrderMode === "existing" ? "bg-primary text-white" : "text-muted-foreground"}`}
                  >
                    {t("orders.pickExisting")}
                  </button>
                </div>
                <button type="button" onClick={() => setWiAttachOrder(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </div>

              {wiOrderMode === "new" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input className={`min-w-0 flex-1 ${FIELD}`} placeholder={t("orders.name")} value={wiOrderTitle} onChange={(e) => setWiOrderTitle(e.target.value)} />
                  <input type="number" step="0.01" className={`w-20 ${FIELD}`} placeholder={t("orders.price")} value={wiOrderPrice} onChange={(e) => setWiOrderPrice(e.target.value)} />
                  <select className={FIELD} value={wiOrderSupplier} onChange={(e) => setWiOrderSupplier(e.target.value)}>
                    <option value="">— {t("orders.supplier")} —</option>
                    {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                  </select>
                  <input type="date" className={FIELD} value={wiOrderDate} onChange={(e) => setWiOrderDate(e.target.value)} />
                </div>
              ) : reusableOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("orders.noOrdersYet")}</p>
              ) : (
                <select
                  className={`${FIELD} w-full`}
                  value={wiOrderExistingId}
                  onChange={(e) => setWiOrderExistingId(e.target.value)}
                >
                  <option value="">— {t("orders.pickExisting")} —</option>
                  {reusableOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                      {o.supplier?.name ? ` · ${o.supplier.name}` : ""}
                      {o.price != null ? ` · ${money(Number(o.price))} ${o.currency ?? ""}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="submit"
              disabled={savingWI || !wiName.trim()}
              className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {savingWI ? "…" : t("common.add")}
            </button>
            <button type="button" onClick={resetWIForm} className="text-xs text-muted-foreground hover:text-foreground">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingWI(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="size-3.5" /> {t("workItems.add")}
        </button>
      )}

      {/* Add unassigned order shortcut when no work items exist */}
      {items.length === 0 && unassigned.length === 0 && addingOrderFor === null && (
        <button
          type="button"
          onClick={() => openOrderForm("")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="size-3.5" /> {t("orders.add")}
        </button>
      )}
      {items.length === 0 && addingOrderFor === "" && addOrderForm()}

      {/* Tasks section */}
      <div className="mt-2 rounded-lg border bg-white px-3 py-2">
        <div className="mb-1 text-xs font-medium text-muted-foreground">{t("tasks.title")}</div>
        {tasks.length === 0 && !addingTask && (
          <p className="text-xs text-muted-foreground">{t("inlineTasks.none")}</p>
        )}
        {tasks.map((tk) => (
          <div
            key={tk.id}
            className="group flex items-center gap-2 py-1 text-xs"
          >
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
            <button
              type="button"
              onClick={() => handleDeleteTask(tk.id)}
              className="hidden text-muted-foreground hover:text-red-500 group-hover:inline-flex"
              title={t("inlineTasks.deleteConfirm")}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        {addingTask ? (
          <form onSubmit={handleAddTask} className="mt-1 flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              className={`min-w-0 flex-1 ${FIELD}`}
              placeholder={t("inlineTasks.addPlaceholder")}
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
            />
            <input type="date" className={FIELD} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <button type="submit" disabled={savingTask || !taskText.trim()} className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50">
              {savingTask ? "…" : t("common.add")}
            </button>
            <button type="button" onClick={() => { setAddingTask(false); setTaskText(""); setTaskDue(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3" /> {t("inlineTasks.add")}
          </button>
        )}
      </div>
    </div>
  );
}
