import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import {
  createOrder,
  deleteOrder,
  listAllOrders,
  listCases,
  listCounterparties,
  listWorkItems,
  updateOrder,
  type CaseWithRelations,
  type OrderWithRefs,
  type WorkItemWithRefs,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { AttachmentList } from "@/components/AttachmentList";
import type { Counterparty } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/*
  Standalone orders list — mirror of /tasks but for orders.
  Top: add-order form (case required, work item optional, supplier, price, date).
  List: all orders grouped by case, with inline edit + delete.
*/
export function OrdersPage() {
  const { t, lang } = useI18n();
  const [orders, setOrders] = useState<OrderWithRefs[] | null>(null);
  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add-order form state
  const [caseId, setCaseId] = useState("");
  const [workItems, setWorkItems] = useState<WorkItemWithRefs[]>([]);
  const [workItemId, setWorkItemId] = useState("");
  const [title, setTitle] = useState("");
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state — keyed by order id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eSupplier, setESupplier] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eDate, setEDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    listAllOrders().then(setOrders).catch((e) => setError(e.message));
    listCases().then(setCases).catch(() => setCases([]));
    listCounterparties().then(setCounterparties).catch(() => setCounterparties([]));
  }, []);

  // Refresh work items dropdown when the chosen case changes
  useEffect(() => {
    setWorkItemId("");
    if (!caseId) { setWorkItems([]); return; }
    listWorkItems(caseId).then(setWorkItems).catch(() => setWorkItems([]));
  }, [caseId]);

  async function refresh() {
    setOrders(await listAllOrders());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createOrder({
        case_id: caseId,
        work_item_id: workItemId || null,
        title: title.trim(),
        price: price ? Number(price) : null,
        supplier_id: supplier || null,
        order_date: date || null,
      });
      setTitle(""); setPrice(""); setSupplier(""); setDate("");
      setWorkItemId("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(o: OrderWithRefs) {
    setEditingId(o.id);
    setETitle(o.title);
    setESupplier(o.supplier_id ?? "");
    setEPrice(o.price != null ? String(o.price) : "");
    setEDate(o.order_date ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setETitle(""); setESupplier(""); setEPrice(""); setEDate("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !eTitle.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateOrder(editingId, {
        title: eTitle.trim(),
        price: ePrice ? Number(ePrice) : null,
        supplier_id: eSupplier || null,
        order_date: eDate || null,
      });
      cancelEdit();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(o: OrderWithRefs) {
    if (!confirm(t("orders.deleteConfirm"))) return;
    try {
      await deleteOrder(o.id);
      setOrders((prev) => prev?.filter((x) => x.id !== o.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const caseTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cases) m.set(c.id, c.title);
    return m;
  }, [cases]);

  // Group orders by case
  const grouped = useMemo(() => {
    if (!orders) return [];
    const m = new Map<string, OrderWithRefs[]>();
    for (const o of orders) {
      const arr = m.get(o.case_id) ?? [];
      arr.push(o);
      m.set(o.case_id, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      const ta = caseTitleById.get(a) ?? "";
      const tb = caseTitleById.get(b) ?? "";
      return ta.localeCompare(tb);
    });
  }, [orders, caseTitleById]);

  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("orders.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ordersPage.subtitle")}</p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Add order */}
      <form onSubmit={handleAdd} className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("orders.add")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="o-case">{t("ordersPage.caseRequired")} *</Label>
            <Select id="o-case" value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
              <option value="">—</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-wi">{t("orders.workItem")}</Label>
            <Select
              id="o-wi"
              value={workItemId}
              onChange={(e) => setWorkItemId(e.target.value)}
              disabled={!caseId || workItems.length === 0}
            >
              <option value="">— {t("orders.unassigned")} —</option>
              {workItems.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-title">{t("orders.name")} *</Label>
            <Input id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-supplier">{t("orders.supplier")}</Label>
            <Select id="o-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">—</option>
              {counterparties.map((cp) => (
                <option key={cp.id} value={cp.id}>{cp.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-price">{t("orders.price")}</Label>
            <Input id="o-price" type="number" step="0.01" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-date">{t("orders.date")}</Label>
            <Input id="o-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Button type="submit" disabled={saving || !caseId || !title.trim()}>
            {saving ? t("common.saving") : t("common.add")}
          </Button>
        </div>
      </form>

      {/* List */}
      {orders === null && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {orders !== null && orders.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("orders.none")}</p>
      )}

      {grouped.map(([cid, ords]) => {
        const caseTitle = caseTitleById.get(cid) ?? "—";
        return (
          <section key={cid} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Link to={`/cases/${cid}`} className="hover:text-primary hover:underline">
                {caseTitle}
              </Link>
              <span className="rounded-full bg-gray-100 px-2 py-0 text-xs font-normal text-muted-foreground">
                {ords.length}
              </span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {ords.map((o) => (
                <li key={o.id} className="px-4 py-3">
                  {editingId === o.id ? (
                    <form onSubmit={handleSaveEdit} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:items-end">
                      <div className="grid gap-1">
                        <Label htmlFor={`e-t-${o.id}`} className="text-xs">{t("orders.name")}</Label>
                        <Input id={`e-t-${o.id}`} value={eTitle} onChange={(e) => setETitle(e.target.value)} required />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`e-s-${o.id}`} className="text-xs">{t("orders.supplier")}</Label>
                        <Select id={`e-s-${o.id}`} value={eSupplier} onChange={(e) => setESupplier(e.target.value)}>
                          <option value="">—</option>
                          {counterparties.map((cp) => (
                            <option key={cp.id} value={cp.id}>{cp.name}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`e-p-${o.id}`} className="text-xs">{t("orders.price")}</Label>
                        <Input id={`e-p-${o.id}`} type="number" step="0.01" dir="ltr" value={ePrice} onChange={(e) => setEPrice(e.target.value)} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`e-d-${o.id}`} className="text-xs">{t("orders.date")}</Label>
                        <Input id={`e-d-${o.id}`} type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                      </div>
                      <Button type="submit" size="sm" disabled={savingEdit || !eTitle.trim()}>
                        {savingEdit ? "…" : t("common.save")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="size-4" />
                      </Button>
                    </form>
                  ) : (
                    <div className="group flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{o.title}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {o.work_item?.name && <span>↳ {o.work_item.name}</span>}
                          {o.supplier?.name && <span>· {o.supplier.name}</span>}
                          {o.order_date && <span dir="ltr">· {formatDate(o.order_date, lang)}</span>}
                        </div>
                      </div>
                      {o.price != null && (
                        <span className="text-sm font-medium text-foreground" dir="ltr">
                          {money(Number(o.price))} {o.currency ?? "ILS"}
                        </span>
                      )}
                      <AttachmentList entityType="order" entityId={o.id} compact />
                      <button
                        type="button"
                        onClick={() => openEdit(o)}
                        className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title={t("common.edit") ?? "Edit"}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(o)}
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                        title={t("common.delete")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

