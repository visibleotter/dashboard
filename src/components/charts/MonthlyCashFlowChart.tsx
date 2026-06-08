import { useMemo } from "react";
import type { Payment } from "@/types/db";
import { useI18n } from "@/lib/i18n";

/*
  Monthly grouped bar chart: income (emerald) + outcome (red) for each month
  along the X axis. Hand-rolled SVG — no chart library dep.

  Grouping matches the user's Google Sheet "Cash Flow" pivot semantics:
    - Group by due_date year-month
    - All rows regardless of status
    - Y axis = ₪ amount, formatted with K/M suffix
*/
export function MonthlyCashFlowChart({ rows }: { rows: Payment[] }) {
  const { t, lang } = useI18n();

  // Aggregate by YYYY-MM
  const monthlyData = useMemo(() => {
    const map = new Map<string, { income: number; outcome: number }>();
    for (const r of rows) {
      if (!r.due_date) continue;
      const key = r.due_date.slice(0, 7); // YYYY-MM
      const cur = map.get(key) ?? { income: 0, outcome: 0 };
      const amount = Number(r.price_after_vat ?? 0);
      if (r.direction === "income") cur.income += amount;
      else cur.outcome += amount;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, ...vals }));
  }, [rows]);

  // Render dimensions
  const W = 720;
  const H = 240;
  const padding = { top: 16, right: 16, bottom: 36, left: 56 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;

  const max = monthlyData.reduce(
    (m, d) => Math.max(m, d.income, d.outcome),
    0,
  );
  const yMax = niceCeil(max);

  // Y axis ticks (4 horizontal lines)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * yMax);

  // Bars
  const groupCount = monthlyData.length || 1;
  const groupW = innerW / groupCount;
  const barW = Math.max(4, Math.min(20, (groupW - 6) / 2));

  if (monthlyData.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{t("analytics.monthlyCashFlow")}</h3>
        <p className="text-sm text-muted-foreground">{t("analytics.empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("analytics.monthlyCashFlow")}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" />
            {t("payments.income")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-red-500" />
            {t("payments.outcome")}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[640px]" preserveAspectRatio="xMidYMid meet" role="img">
          {/* Gridlines + Y labels */}
          {ticks.map((v) => {
            const y = padding.top + innerH - (innerH * v) / yMax;
            return (
              <g key={v}>
                <line x1={padding.left} y1={y} x2={W - padding.right} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
                <text x={padding.left - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">
                  {fmtMoney(v, lang)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {monthlyData.map((d, i) => {
            const x0 = padding.left + i * groupW + (groupW - barW * 2 - 2) / 2;
            const incomeH = (innerH * d.income) / yMax;
            const outcomeH = (innerH * d.outcome) / yMax;
            return (
              <g key={d.month}>
                <rect
                  x={x0}
                  y={padding.top + innerH - incomeH}
                  width={barW}
                  height={incomeH}
                  rx={2}
                  fill="#10b981"
                >
                  <title>{`${d.month} · ${t("payments.income")}: ${fmtMoney(d.income, lang)}`}</title>
                </rect>
                <rect
                  x={x0 + barW + 2}
                  y={padding.top + innerH - outcomeH}
                  width={barW}
                  height={outcomeH}
                  rx={2}
                  fill="#ef4444"
                >
                  <title>{`${d.month} · ${t("payments.outcome")}: ${fmtMoney(d.outcome, lang)}`}</title>
                </rect>
                <text
                  x={x0 + barW}
                  y={H - padding.bottom + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="10"
                >
                  {monthShort(d.month, lang)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function niceCeil(n: number): number {
  if (n <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  const rounded = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return rounded * mag;
}

function fmtMoney(n: number, lang: "he" | "en"): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 });
}

function monthShort(yyyyMm: string, lang: "he" | "en"): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "short", year: "2-digit" });
}
