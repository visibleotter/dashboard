import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { listPaymentsForAnalytics } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import type { Payment } from "@/types/db";
import { MonthlyCashFlowChart } from "@/components/charts/MonthlyCashFlowChart";
import { PaidVsOpenDonut } from "@/components/charts/PaidVsOpenDonut";
import { IncomeCorridor } from "@/components/charts/IncomeCorridor";

/*
  Analytics panel — sits above the payments table on /payments.
  Year selector scopes the three charts. All charts derive client-side
  from a single fetch (`listPaymentsForAnalytics(year)`).
*/

const CURRENT_YEAR = new Date().getFullYear();

export function PaymentsAnalytics() {
  const { t } = useI18n();
  const [year, setYear] = useState<number | "all">(CURRENT_YEAR);
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    setRows(null);
    listPaymentsForAnalytics(year === "all" ? null : year)
      .then((data) => { if (alive) setRows(data); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [year]);

  const years = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary"
        >
          <BarChart3 className="size-4 text-primary" />
          {t("analytics.title")}
        </button>
        {open && (
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="year-select" className="text-muted-foreground">
              {t("analytics.year")}
            </label>
            <select
              id="year-select"
              value={String(year)}
              onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="all">{t("analytics.allTime")}</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {open && (
        <>
          {rows === null ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
              {t("analytics.empty")}
            </p>
          ) : (
            <div className="grid gap-4">
              <MonthlyCashFlowChart rows={rows} />
              <div className="grid gap-4 lg:grid-cols-2">
                <PaidVsOpenDonut rows={rows} />
                <IncomeCorridor rows={rows} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
