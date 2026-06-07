import { useEffect, useMemo, useState } from "react";
import { listOrders, listWorkItems, type OrderWithRefs, type WorkItemWithRefs } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";

/*
  Read-only inline preview of a case's work-items with their nested orders (Notion
  Project → Task → Order). Lazy: only fetches when mounted (i.e. when a row is expanded).
*/
export function CaseWorkPreview({ caseId }: { caseId: string }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<WorkItemWithRefs[] | null>(null);
  const [orders, setOrders] = useState<OrderWithRefs[]>([]);
  const [error, setError] = useState<string | null>(null);
  const money = (n: number) => n.toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  useEffect(() => {
    let active = true;
    Promise.all([listWorkItems(caseId), listOrders(caseId)])
      .then(([wi, ord]) => {
        if (!active) return;
        setItems(wi);
        setOrders(ord);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
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

  if (error) return <p className="px-4 pb-3 text-xs text-destructive">{error}</p>;
  if (items === null) return <p className="px-4 pb-3 text-xs text-muted-foreground">{t("common.loading")}</p>;
  if (items.length === 0 && orders.length === 0)
    return <p className="px-4 pb-3 text-xs text-muted-foreground">{t("workItems.none")}</p>;

  const orderLine = (o: OrderWithRefs) => (
    <div key={o.id} className="flex items-center justify-between gap-3 ps-6 pe-2 py-1 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">
        ↳ {o.title}
        {o.supplier?.name ? ` · ${o.supplier.name}` : ""}
        {o.order_date ? ` · ${formatDate(o.order_date, lang)}` : ""}
      </span>
      <span dir="ltr" className="shrink-0">
        {o.price != null ? `${money(Number(o.price))} ${o.currency ?? ""}` : "—"}
      </span>
    </div>
  );

  return (
    <div className="space-y-1.5 border-t bg-background/30 px-4 py-3">
      {items.map((w) => (
        <div key={w.id} className="rounded-md border bg-card/60 px-3 py-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{w.name}</span>
              {w.status && <Badge className="bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25">{w.status}</Badge>}
              {w.assignee?.name && <span className="text-xs text-muted-foreground">{w.assignee.name}</span>}
            </div>
            {w.cost != null && (
              <span className="shrink-0 text-xs" dir="ltr">
                {money(Number(w.cost))} ₪
              </span>
            )}
          </div>
          {(ordersByWi.get(w.id) ?? []).map(orderLine)}
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="rounded-md border bg-card/60 px-3 py-1.5">
          <div className="text-xs text-muted-foreground">{t("orders.unassigned")}</div>
          {unassigned.map(orderLine)}
        </div>
      )}
    </div>
  );
}
