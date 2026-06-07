import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createOrder,
  createWorkItem,
  deleteOrder,
  deleteWorkItem,
  listOrders,
  listWorkItems,
  type OrderWithRefs,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PersonSelect } from "@/components/PersonSelect";
import { CounterpartySelect } from "@/components/CounterpartySelect";

const STAGES = ["Design", "Orders", "Assembling", "Instalation", "Testing"];
const CURRENCIES = ["ILS", "USD", "CNY", "EUR"];

/*
  Project work-items (Notion "Tasks") with their orders nested underneath, mirroring Notion's
  Project → Task → Order structure. Reports combined spent (Σ work-item cost + Σ order price).
*/
export function WorkItemsSection({
  caseId,
  onSpentChange,
}: {
  caseId: string;
  onSpentChange?: (total: number) => void;
}) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<WorkItemWithRefs[]>([]);
  const [orders, setOrders] = useState<OrderWithRefs[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // new work-item form
  const [name, setName] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [cost, setCost] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [wi, ord] = await Promise.all([listWorkItems(caseId), listOrders(caseId)]);
    setItems(wi);
    setOrders(ord);
  }, [caseId]);

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  // combined spend → parent
  useEffect(() => {
    const wiCost = items.reduce((s, w) => s + (w.cost != null ? Number(w.cost) : 0), 0);
    const ordPrice = orders.reduce((s, o) => s + (o.price != null ? Number(o.price) : 0), 0);
    onSpentChange?.(wiCost + ordPrice);
  }, [items, orders, onSpentChange]);

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

  async function handleAddWorkItem() {
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
      await load();
      setName(""); setStage(""); setStatus(""); setCost(""); setAssigneeId(null); setDueDate("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeWorkItem(w: WorkItemWithRefs) {
    if (!window.confirm(t("workItems.deleteConfirm"))) return;
    try {
      await deleteWorkItem(w.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeOrder(o: OrderWithRefs) {
    if (!window.confirm(t("orders.deleteConfirm"))) return;
    try {
      await deleteOrder(o.id);
      await load();
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
            <Button type="button" size="sm" onClick={handleAddWorkItem} disabled={saving || !name.trim()}>
              {saving ? t("common.saving") : t("common.add")}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("workItems.none")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((w) => (
            <WorkItemRow
              key={w.id}
              item={w}
              orders={ordersByWi.get(w.id) ?? []}
              onAddedOrder={load}
              onRemoveOrder={removeOrder}
              onRemove={() => removeWorkItem(w)}
              onError={setError}
            />
          ))}
        </ul>
      )}

      {/* Orders not tied to a work-item */}
      {unassigned.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">{t("orders.unassigned")}</div>
          <ul className="divide-y rounded-lg border bg-card">
            {unassigned.map((o) => (
              <OrderLine key={o.id} order={o} lang={lang} onRemove={() => removeOrder(o)} t={t} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function WorkItemRow({
  item,
  orders,
  onAddedOrder,
  onRemoveOrder,
  onRemove,
  onError,
}: {
  item: WorkItemWithRefs;
  orders: OrderWithRefs[];
  onAddedOrder: () => Promise<void>;
  onRemoveOrder: (o: OrderWithRefs) => void;
  onRemove: () => void;
  onError: (m: string) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [addingOrder, setAddingOrder] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [orderDate, setOrderDate] = useState("");
  const [status, setStatus] = useState("");
  const [tracking, setTracking] = useState("");
  const [saving, setSaving] = useState(false);

  async function addOrder() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createOrder({
        case_id: item.case_id,
        work_item_id: item.id,
        supplier_id: supplierId,
        title: title.trim(),
        price: price === "" ? null : Number(price),
        currency: currency || null,
        order_date: orderDate || null,
        status: status.trim() || null,
        tracking_number: tracking.trim() || null,
      });
      await onAddedOrder();
      setSupplierId(null); setTitle(""); setPrice(""); setOrderDate(""); setStatus(""); setTracking("");
      setAddingOrder(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const Chevron = open ? ChevronDown : ChevronLeft;
  const orderTotal = orders.reduce((s, o) => s + (o.price != null ? Number(o.price) : 0), 0);

  return (
    <li className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-muted-foreground hover:text-foreground">
          <Chevron className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.stage && <Badge className="bg-white/10 text-neutral-300">{item.stage}</Badge>}
            {item.status && <Badge className="bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25">{item.status}</Badge>}
            {orders.length > 0 && (
              <Badge className="bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/25">
                {orders.length} {t("orders.title")}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.assignee?.name ?? "—"}
            {item.cost != null && ` · ${t("workItems.cost")} ${Number(item.cost).toLocaleString(lang === "he" ? "he-IL" : "en-GB")} ₪`}
            {orderTotal > 0 && ` · ${t("orders.title")} ${orderTotal.toLocaleString(lang === "he" ? "he-IL" : "en-GB")} ₪`}
            {item.due_date && ` · ${formatDate(item.due_date, lang)}`}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t("common.delete")}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t px-4 py-3">
          {orders.length === 0 && !addingOrder && (
            <p className="text-xs text-muted-foreground">{t("orders.none")}</p>
          )}
          {orders.length > 0 && (
            <ul className="divide-y rounded-md border bg-background/40">
              {orders.map((o) => (
                <OrderLine key={o.id} order={o} lang={lang} onRemove={() => onRemoveOrder(o)} t={t} />
              ))}
            </ul>
          )}

          {addingOrder ? (
            <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>{t("orders.name")}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("orders.supplier")}</Label>
                <CounterpartySelect value={supplierId} onChange={setSupplierId} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("orders.price")}</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("orders.date")}</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("orders.status")}</Label>
                <Input value={status} onChange={(e) => setStatus(e.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>{t("orders.tracking")}</Label>
                <Input dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" size="sm" onClick={addOrder} disabled={saving || !title.trim()}>
                  {saving ? t("common.saving") : t("common.add")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingOrder(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAddingOrder(true)}>
              {t("orders.add")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function OrderLine({
  order,
  lang,
  onRemove,
  t,
}: {
  order: OrderWithRefs;
  lang: "he" | "en";
  onRemove: () => void;
  t: (k: string) => string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{order.title}</span>
          {order.status && <Badge className="bg-white/10 text-neutral-300">{order.status}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {order.supplier?.name ?? "—"}
          {order.order_date && ` · ${formatDate(order.order_date, lang)}`}
          {order.tracking_number && ` · ${order.tracking_number}`}
        </div>
      </div>
      <div className="text-sm font-medium" dir="ltr">
        {order.price != null ? `${Number(order.price).toLocaleString(lang === "he" ? "he-IL" : "en-GB")} ${order.currency ?? ""}` : "—"}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        {t("common.delete")}
      </Button>
    </li>
  );
}
