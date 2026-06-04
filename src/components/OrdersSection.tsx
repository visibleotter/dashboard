import { useCallback, useEffect, useState } from "react";
import {
  createOrder,
  deleteOrder,
  listOrders,
  listWorkItems,
  type OrderWithRefs,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CounterpartySelect } from "@/components/CounterpartySelect";

const CURRENCIES = ["ILS", "USD", "CNY", "EUR"];

/* Orders (purchases) for a case. Reports the spend total up via onTotalChange. */
export function OrdersSection({
  caseId,
  onTotalChange,
}: {
  caseId: string;
  onTotalChange?: (spent: number) => void;
}) {
  const { t, lang } = useI18n();
  const [orders, setOrders] = useState<OrderWithRefs[]>([]);
  const [workItems, setWorkItems] = useState<WorkItemWithRefs[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [orderDate, setOrderDate] = useState("");
  const [status, setStatus] = useState("");
  const [tracking, setTracking] = useState("");
  const [workItemId, setWorkItemId] = useState("");
  const [saving, setSaving] = useState(false);

  const reportTotal = useCallback(
    (rows: OrderWithRefs[]) => {
      const sum = rows.reduce((s, o) => s + (o.price != null ? Number(o.price) : 0), 0);
      onTotalChange?.(sum);
    },
    [onTotalChange],
  );

  useEffect(() => {
    listOrders(caseId).then((rows) => { setOrders(rows); reportTotal(rows); }).catch((e) => setError(e.message));
    listWorkItems(caseId).then(setWorkItems).catch(() => setWorkItems([]));
  }, [caseId, reportTotal]);

  async function refresh() {
    const rows = await listOrders(caseId);
    setOrders(rows);
    reportTotal(rows);
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createOrder({
        case_id: caseId,
        work_item_id: workItemId || null,
        supplier_id: supplierId,
        title: title.trim(),
        price: price === "" ? null : Number(price),
        currency: currency || null,
        order_date: orderDate || null,
        status: status.trim() || null,
        tracking_number: tracking.trim() || null,
      });
      await refresh();
      setSupplierId(null); setTitle(""); setPrice(""); setOrderDate(""); setStatus(""); setTracking(""); setWorkItemId("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(o: OrderWithRefs) {
    if (!window.confirm(t("orders.deleteConfirm"))) return;
    try {
      await deleteOrder(o.id);
      setOrders((prev) => { const next = prev.filter((x) => x.id !== o.id); reportTotal(next); return next; });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("orders.title")} ({orders.length})
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? t("common.cancel") : t("orders.add")}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {adding && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="o-title">{t("orders.name")}</Label>
            <Input id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("orders.supplier")}</Label>
            <CounterpartySelect value={supplierId} onChange={setSupplierId} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-wi">{t("orders.workItem")}</Label>
            <Select id="o-wi" value={workItemId} onChange={(e) => setWorkItemId(e.target.value)}>
              <option value="">{t("orders.unassigned")}</option>
              {workItems.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-price">{t("orders.price")}</Label>
            <Input id="o-price" type="number" step="0.01" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-cur">{t("orders.price")} ({t("milestones.currency")})</Label>
            <Select id="o-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-date">{t("orders.date")}</Label>
            <Input id="o-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-status">{t("orders.status")}</Label>
            <Input id="o-status" value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-track">{t("orders.tracking")}</Label>
            <Input id="o-track" dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !title.trim()}>
              {saving ? t("common.saving") : t("common.add")}
            </Button>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("orders.none")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{o.title}</span>
                  {o.status && <Badge className="bg-white/10 text-neutral-300">{o.status}</Badge>}
                  {o.work_item && <Badge className="bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/25">{o.work_item.name}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.supplier?.name ?? "—"}
                  {o.order_date && ` · ${formatDate(o.order_date, lang)}`}
                  {o.tracking_number && ` · ${o.tracking_number}`}
                </div>
              </div>
              <div className="text-sm font-medium" dir="ltr">
                {o.price != null ? `${Number(o.price).toLocaleString(lang === "he" ? "he-IL" : "en-GB")} ${o.currency ?? ""}` : "—"}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(o)}>
                {t("common.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
