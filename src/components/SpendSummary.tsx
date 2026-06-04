import { useI18n } from "@/lib/i18n";

/* Budget vs Spent vs Remaining bar for a case. Spent comes from the case's orders. */
export function SpendSummary({
  budget,
  spent,
  currency = "ILS",
}: {
  budget: number | null;
  spent: number;
  currency?: string | null;
}) {
  const { t, lang } = useI18n();
  const fmt = (n: number) =>
    n.toLocaleString(lang === "he" ? "he-IL" : "en-GB", { maximumFractionDigits: 0 });
  const cur = currency ?? "ILS";

  const hasBudget = budget != null && budget > 0;
  const pct = hasBudget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const remaining = hasBudget ? budget - spent : 0;
  const over = hasBudget && spent > budget;

  return (
    <section className="space-y-2 border-t pt-6">
      <h2 className="text-sm font-medium text-muted-foreground">{t("spend.title")}</h2>
      <div className="rounded-2xl border border-white/10 bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{t("spend.budget")}</div>
              <div className="font-semibold">{hasBudget ? `${fmt(budget!)} ${cur}` : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("spend.spent")}</div>
              <div className="font-semibold text-sky-300">{`${fmt(spent)} ${cur}`}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("spend.remaining")}</div>
              <div className={`font-semibold ${over ? "text-red-300" : "text-emerald-300"}`}>
                {hasBudget ? `${fmt(remaining)} ${cur}` : "—"}
              </div>
            </div>
          </div>
          {hasBudget && (
            <div className="text-sm text-muted-foreground">
              {pct}% {t("spend.used")}
            </div>
          )}
        </div>
        {hasBudget && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${over ? "bg-red-500" : "bg-brand-gradient"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
