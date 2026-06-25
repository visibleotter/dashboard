import { useEffect, useState } from "react";
import { Package, Plus, X } from "lucide-react";
import {
  createOrder,
  linkOrderToTask,
  listAllOrders,
  listCounterparties,
  listOrdersForTask,
  unlinkOrderFromTask,
  updateOrderTaskLink,
  type LinkedOrderForTask,
  type OrderWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { Counterparty } from "@/types/db";

/*
  Inline orders panel for a single task. Shows each linked order as a chip
  (title × quantity = line total). The same order can be linked to multiple
  tasks across different projects — picking an existing order from any
  project just creates a new row in order_tasks.

  Compact-by-default. Add affordances live at the end of the chip row:
  Plus icon → small inline form (New / Pick existing toggle).
*/
export function TaskOrdersInline({
  taskId,
  caseId,
}: {
  taskId: string;
  caseId: string;
}) {
  const { t, lang } = useI18n();

  const [links, setLinks] = useState<LinkedOrderForTask[] | null>(null);
  const [allOrders, setAllOrders] = useState<OrderWithRefs[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add-form state
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  // shared
  const [qty, setQty] = useState("1");
  // new
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newDate, setNewDate] = useState("");
  // existing
  const [existingId, setExistingId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLinks(await listOrdersForTask(taskId));
  }

  useEffect(() => {
    let active = true;
    Promise.all([listOrdersForTask(taskId), listAllOrders(), listCounterparties()])
      .then(([lk, ord, cps]) => {
        if (!active) return;
        setLinks(lk);
        setAllOrders(ord);
        setCounterparties(cps);
      })
      .catch((e) => setError(e.message));
    return () => { active = false; };
  }, [taskId]);

  // For the "Pick existing" mode — don't show orders already linked to this task.
  const linkedIds = new Set((links ?? []).map((l) => l.order.id));
  const pickable = allOrders.filter((o) => !linkedIds.has(o.id));

  function resetForm() {
    setAdding(false);
    setMode("new");
    setQty("1");
    setNewTitle(""); setNewPrice(""); setNewSupplier(""); setNewDate("");
    setExistingId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const quantity = Number(qty) || 1;
    setSaving(true);
    setError(null);
    try {
      let orderId: string;
      if (mode === "existing") {
        if (!existingId) return;
        orderId = existingId;
      } else {
        if (!newTitle.trim()) return;
        const created = await createOrder({
          case_id: caseId,
          work_item_id: null,
          title: newTitle.trim(),
          price: newPrice ? Number(newPrice) : null,
          quantity,
          supplier_id: newSupplier || null,
          order_date: newDate || null,
        });
        orderId = created.id;
      }
      await linkOrderToTask(orderId, taskId, quantity);
      resetForm();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  }

  async function changeQty(linkId: string, q: string) {
    const quantity = Number(q) || 1;
    setLinks((prev) => prev?.map((l) => l.link_id === linkId ? { ...l, quantity } : l) ?? null);
    try { await updateOrderTaskLink(linkId, { quantity }); }
    catch (e) { setError((e as Error).message); }
  }

  async function handleUnlink(linkId: string) {
    await unlinkOrderFromTask(linkId);
    await load();
  }

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (links === null) return null;

  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 });

  return (
    <div
      className="mt-1 ms-6 space-y-1"
      onClick={(e) => e.stopPropagation()}
    >
      {links.map((l) => {
        const unit = Number(l.order.price ?? 0);
        const total = unit * l.quantity;
        return (
          <div
            key={l.link_id}
            className="group flex items-center gap-1.5 text-xs"
          >
            <Package className="size-3 shrink-0 text-amber-500" />
            <span className="min-w-0 truncate text-muted-foreground">
              {l.order.title}
              {l.order.supplier?.name ? ` · ${l.order.supplier.name}` : ""}
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={String(l.quantity)}
              onChange={(e) => changeQty(l.link_id, e.target.value)}
              className="w-12 rounded border border-gray-200 bg-white px-1.5 py-0 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              dir="ltr"
              aria-label={t("orders.quantity")}
              title={t("orders.quantity")}
            />
            <span className="text-muted-foreground" dir="ltr">×</span>
            <span className="text-muted-foreground" dir="ltr">
              {unit ? `${money(unit)}` : "—"}
            </span>
            <span className="ms-auto font-medium text-foreground" dir="ltr">
              {total ? `${money(total)} ${l.order.currency ?? "ILS"}` : "—"}
            </span>
            <IconButton
              size="sm"
              variant="destructive"
              onClick={() => handleUnlink(l.link_id)}
              aria-label={t("orders.unlink")}
              title={t("orders.unlink")}
              className="hidden group-hover:inline-flex"
            >
              <X />
            </IconButton>
          </div>
        );
      })}

      {/* Add affordance */}
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        >
          <Plus className="size-3" />
          {t("orders.linkOrCreate")}
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-1.5 rounded-md border bg-white p-2"
        >
          {/* Tabs */}
          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex gap-1 rounded-full bg-gray-50 p-0.5 ring-1 ring-gray-200">
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`rounded-full px-2 py-0.5 ${mode === "new" ? "bg-primary text-white" : "text-muted-foreground"}`}
              >
                {t("orders.newOne")}
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`rounded-full px-2 py-0.5 ${mode === "existing" ? "bg-primary text-white" : "text-muted-foreground"}`}
              >
                {t("orders.pickExisting")}
              </button>
            </div>
            <IconButton size="sm" onClick={resetForm} aria-label={t("common.cancel")}>
              <X />
            </IconButton>
          </div>

          {mode === "new" ? (
            <div className="flex flex-wrap items-center gap-1">
              <input
                autoFocus
                className="min-w-[10rem] flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={t("orders.name")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <input
                type="number" step="0.01" dir="ltr"
                className="w-20 rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={t("orders.priceUnit")}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
              <select
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-foreground focus:outline-none"
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
              >
                <option value="">— {t("orders.supplier")} —</option>
                {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
              </select>
              <input
                type="date"
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          ) : pickable.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("orders.noOrdersYet")}</p>
          ) : (
            <select
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-foreground focus:outline-none"
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
            >
              <option value="">— {t("orders.pickExisting")} —</option>
              {pickable.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                  {o.supplier?.name ? ` · ${o.supplier.name}` : ""}
                  {o.price != null ? ` · ${money(Number(o.price))} ${o.currency ?? ""}/u` : ""}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-14 rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
              dir="ltr"
              aria-label={t("orders.quantity")}
            />
            <span className="text-xs text-muted-foreground">{t("orders.quantity")}</span>
            <Button
              type="submit"
              size="sm"
              disabled={saving || (mode === "new" ? !newTitle.trim() : !existingId)}
            >
              {saving ? "…" : t("common.add")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
