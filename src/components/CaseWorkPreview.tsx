import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createOrder,
  createWorkItem,
  deleteOrder,
  deleteWorkItem,
  listCounterparties,
  listOrders,
  listWorkItems,
  type OrderWithRefs,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import type { Counterparty } from "@/types/db";

export function CaseWorkPreview({ caseId }: { caseId: string }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<WorkItemWithRefs[] | null>(null);
  const [orders, setOrders] = useState<OrderWithRefs[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [error, setError] = useState<string | null>(null);

  // add-work-item form state
  const [addingWI, setAddingWI] = useState(false);
  const [wiName, setWiName] = useState("");
  const [wiCost, setWiCost] = useState("");
  const [savingWI, setSavingWI] = useState(false);

  // add-order form: keyed by work_item_id (or "" for unassigned)
  const [addingOrderFor, setAddingOrderFor] = useState<string | null>(null);
  const [orderTitle, setOrderTitle] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderSupplier, setOrderSupplier] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  async function load() {
    const [wi, ord] = await Promise.all([listWorkItems(caseId), listOrders(caseId)]);
    setItems(wi);
    setOrders(ord);
  }

  useEffect(() => {
    let active = true;
    Promise.all([listWorkItems(caseId), listOrders(caseId), listCounterparties()])
      .then(([wi, ord, cps]) => {
        if (!active) return;
        setItems(wi);
        setOrders(ord);
        setCounterparties(cps);
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

  async function handleAddWI(e: React.FormEvent) {
    e.preventDefault();
    if (!wiName.trim()) return;
    setSavingWI(true);
    try {
      await createWorkItem({
        case_id: caseId,
        name: wiName.trim(),
        cost: wiCost ? Number(wiCost) : null,
      });
      setWiName(""); setWiCost(""); setAddingWI(false);
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

  if (error) return <p className="px-4 pb-3 text-xs text-destructive">{error}</p>;
  if (items === null) return <p className="px-4 pb-3 text-xs text-muted-foreground">{t("common.loading")}</p>;

  const orderForm = (_workItemId: string) => (
    <form onSubmit={handleAddOrder} className="ms-6 mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border bg-gray-50 px-3 py-2">
      <input
        autoFocus
        className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        placeholder={t("orders.name")}
        value={orderTitle}
        onChange={(e) => setOrderTitle(e.target.value)}
      />
      <input
        type="number"
        step="0.01"
        className="w-20 rounded border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        placeholder={t("orders.price")}
        value={orderPrice}
        onChange={(e) => setOrderPrice(e.target.value)}
      />
      <select
        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-foreground focus:outline-none"
        value={orderSupplier}
        onChange={(e) => setOrderSupplier(e.target.value)}
      >
        <option value="">— {t("orders.supplier")} —</option>
        {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
      </select>
      <input
        type="date"
        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none"
        value={orderDate}
        onChange={(e) => setOrderDate(e.target.value)}
      />
      <button
        type="submit"
        disabled={savingOrder || !orderTitle.trim()}
        className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {savingOrder ? "…" : t("common.add")}
      </button>
      <button type="button" onClick={() => setAddingOrderFor(null)} className="text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </form>
  );

  const orderLine = (o: OrderWithRefs) => (
    <div key={o.id} className="group flex items-center justify-between gap-3 ps-6 pe-2 py-1 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">
        ↳ {o.title}
        {o.supplier?.name ? ` · ${o.supplier.name}` : ""}
        {o.order_date ? ` · ${formatDate(o.order_date, lang)}` : ""}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <span dir="ltr">{o.price != null ? `${money(Number(o.price))} ${o.currency ?? ""}` : "—"}</span>
        <button
          type="button"
          onClick={() => handleDeleteOrder(o.id)}
          className="hidden text-muted-foreground hover:text-red-500 group-hover:inline-flex"
          title={t("orders.deleteConfirm")}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-1.5 border-t bg-gray-50/60 px-4 py-3">
      {items.map((w) => (
        <div key={w.id} className="rounded-lg border bg-white px-3 py-2">
          {/* Work item header */}
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

          {/* Orders under this work item */}
          {(ordersByWi.get(w.id) ?? []).map(orderLine)}

          {/* Inline add-order form */}
          {addingOrderFor === w.id && orderForm(w.id)}
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
          {addingOrderFor === "" && orderForm("")}
        </div>
      )}

      {/* Add work item */}
      {addingWI ? (
        <form onSubmit={handleAddWI} className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-white px-3 py-2">
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder={t("workItems.namePlaceholder")}
            value={wiName}
            onChange={(e) => setWiName(e.target.value)}
          />
          <input
            type="number"
            step="0.01"
            className="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder={t("workItems.cost")}
            value={wiCost}
            onChange={(e) => setWiCost(e.target.value)}
          />
          <button
            type="submit"
            disabled={savingWI || !wiName.trim()}
            className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {savingWI ? "…" : t("common.add")}
          </button>
          <button type="button" onClick={() => setAddingWI(false)} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
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
      {items.length === 0 && addingOrderFor === "" && orderForm("")}
    </div>
  );
}
