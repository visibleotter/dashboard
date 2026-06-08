import { useMemo } from "react";
import type { Payment } from "@/types/db";
import { useI18n } from "@/lib/i18n";

/*
  Income corridor — exact reproduction of the user's Google Sheet logic
  (Dashboard cells E2:E6 + F2:F6 + G2:G6). Filters: income rows that are
  NOT paid, bucketed by days-until-due-date.

  Buckets:
    0–7d, 8–30d, 31–60d, >60d, Overdue (due_date < today)

  Per bucket: count, sum (₪), comma-joined invoice numbers.
*/
type Bucket = { key: string; label: string; count: number; sum: number; invoices: string[] };

export function IncomeCorridor({ rows }: { rows: Payment[] }) {
  const { t, lang } = useI18n();

  const buckets = useMemo<Bucket[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86_400_000;
    const make = (key: string, label: string): Bucket => ({ key, label, count: 0, sum: 0, invoices: [] });
    const out = [
      make("d0_7", t("analytics.corridor.0_7")),
      make("d8_30", t("analytics.corridor.8_30")),
      make("d31_60", t("analytics.corridor.31_60")),
      make("d60p", t("analytics.corridor.60p")),
      make("overdue", t("analytics.overdue")),
    ];

    for (const r of rows) {
      if (r.direction !== "income") continue;
      if (r.status === "paid") continue;
      if (!r.due_date) continue;
      const due = new Date(r.due_date);
      due.setHours(0, 0, 0, 0);
      const days = Math.round((due.getTime() - today.getTime()) / dayMs);
      let idx = -1;
      if (days < 0) idx = 4;
      else if (days <= 7) idx = 0;
      else if (days <= 30) idx = 1;
      else if (days <= 60) idx = 2;
      else idx = 3;
      const b = out[idx];
      b.count += 1;
      b.sum += Number(r.price_after_vat ?? 0);
      if (r.invoice_number) b.invoices.push(r.invoice_number);
    }
    return out;
  }, [rows, t]);

  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  const totalSum = buckets.reduce((s, b) => s + b.sum, 0);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t("analytics.incomeCorridor")}</h3>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 ps-1 text-start font-medium">{t("analytics.bucket")}</th>
            <th className="py-2 text-end font-medium">{t("analytics.count")}</th>
            <th className="py-2 text-end font-medium">{t("analytics.sum")}</th>
            <th className="py-2 ps-3 text-start font-medium">{t("analytics.invoices")}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key} className="border-b border-gray-50 last:border-0">
              <td className="py-2 ps-1 text-foreground">{b.label}</td>
              <td className="py-2 text-end text-foreground" dir="ltr">{b.count || "—"}</td>
              <td className="py-2 text-end font-medium text-foreground" dir="ltr">
                {b.sum > 0 ? `₪${b.sum.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 })}` : "—"}
              </td>
              <td className="py-2 ps-3 truncate text-xs text-muted-foreground" dir="ltr" title={b.invoices.join("; ")}>
                {b.invoices.length === 0 ? "—" : b.invoices.slice(0, 5).join("; ") + (b.invoices.length > 5 ? ` …+${b.invoices.length - 5}` : "")}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50/60">
            <td className="py-2 ps-1 text-xs font-semibold text-foreground">{t("analytics.total")}</td>
            <td className="py-2 text-end text-xs font-semibold text-foreground" dir="ltr">{totalCount}</td>
            <td className="py-2 text-end text-xs font-semibold text-foreground" dir="ltr">
              ₪{totalSum.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 })}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
