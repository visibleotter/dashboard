import { useMemo } from "react";
import type { Payment } from "@/types/db";
import { useI18n } from "@/lib/i18n";

/*
  Two donut snapshots side-by-side: Income (top), Outcome (bottom).
  Each segment: paid (green), not paid & due in future (amber), overdue (red).
  "Overdue" is computed client-side from status=not_paid + due_date<today,
  matching the user's Google Sheet status formula.
*/
export function PaidVsOpenDonut({ rows }: { rows: Payment[] }) {
  const { t, lang } = useI18n();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => {
    const empty = () => ({ paid: 0, notPaid: 0, overdue: 0, total: 0 });
    const income = empty();
    const outcome = empty();
    for (const r of rows) {
      const amount = Number(r.price_after_vat ?? 0);
      const bucket = r.direction === "income" ? income : outcome;
      bucket.total += amount;
      if (r.status === "paid") {
        bucket.paid += amount;
      } else {
        const isOverdue = r.due_date != null && r.due_date < today;
        if (isOverdue) bucket.overdue += amount;
        else bucket.notPaid += amount;
      }
    }
    return { income, outcome };
  }, [rows, today]);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{t("analytics.paidVsOpen")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Donut
          label={t("payments.income")}
          stats={stats.income}
          accent="emerald"
          lang={lang}
          t={t}
        />
        <Donut
          label={t("payments.outcome")}
          stats={stats.outcome}
          accent="red"
          lang={lang}
          t={t}
        />
      </div>
    </div>
  );
}

function Donut({
  label,
  stats,
  accent,
  lang,
  t,
}: {
  label: string;
  stats: { paid: number; notPaid: number; overdue: number; total: number };
  accent: "emerald" | "red";
  lang: "he" | "en";
  t: (k: string) => string;
}) {
  const size = 140;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  const total = stats.total;
  const slices = total > 0
    ? [
        { value: stats.paid, color: "#10b981" }, // green
        { value: stats.notPaid, color: "#f59e0b" }, // amber
        { value: stats.overdue, color: "#ef4444" }, // red
      ]
    : [];

  let offset = 0;
  const arcs = slices.map((s) => {
    const len = (s.value / (total || 1)) * c;
    const arc = (
      <circle
        key={s.color}
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={stroke}
        strokeDasharray={`${len} ${c - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${center} ${center})`}
        strokeLinecap="butt"
      />
    );
    offset += len;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} role="img" aria-label={label}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {arcs}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
        >
          {label}
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          className={accent === "emerald" ? "fill-emerald-700" : "fill-red-700"}
          fontSize="13"
          fontWeight="600"
        >
          {fmtMoneyShort(total, lang)}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        <Legend color="#10b981" label={t("payments.paid")} value={stats.paid} lang={lang} />
        <Legend color="#f59e0b" label={t("payments.notPaid")} value={stats.notPaid} lang={lang} />
        <Legend color="#ef4444" label={t("analytics.overdue")} value={stats.overdue} lang={lang} />
      </ul>
    </div>
  );
}

function Legend({ color, label, value, lang }: { color: string; label: string; value: number; lang: "he" | "en" }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto font-medium text-foreground" dir="ltr">{fmtMoneyShort(value, lang)}</span>
    </li>
  );
}

function fmtMoneyShort(n: number, lang: "he" | "en"): string {
  if (n === 0) return "₪0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₪${(n / 1_000).toFixed(0)}K`;
  return `₪${n.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 })}`;
}
