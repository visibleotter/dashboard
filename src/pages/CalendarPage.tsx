import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCalendarItems, type CalendarItem, type CalendarKind } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { URGENCY_ORDER, formatDate, relativeDays, urgencyMeta, urgencyOf } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";

const kindCls: Record<CalendarKind, string> = {
  case: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  milestone: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  task: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  income: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  outcome: "bg-red-50 text-red-700 ring-1 ring-red-200",
};
const kindKey: Record<CalendarKind, string> = {
  case: "calendar.kindCase",
  milestone: "calendar.kindMilestone",
  task: "calendar.kindTask",
  income: "payments.income",
  outcome: "payments.outcome",
};

const FILTERS: { key: CalendarKind | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "calendar.filterAll" },
  { key: "case", labelKey: "calendar.filterCases" },
  { key: "milestone", labelKey: "calendar.filterMilestones" },
  { key: "task", labelKey: "calendar.filterTasks" },
  { key: "income", labelKey: "payments.income" },
  { key: "outcome", labelKey: "payments.outcome" },
];

export function CalendarPage() {
  const { t, tl, lang } = useI18n();
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarKind | "all">("all");
  const [hideResolved, setHideResolved] = useState(true);

  useEffect(() => {
    listCalendarItems().then(setItems).catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    return (items ?? []).filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (hideResolved && it.resolved) return false;
      return true;
    });
  }, [items, filter, hideResolved]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("calendar.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((fl) => (
            <button
              key={fl.key}
              type="button"
              onClick={() => setFilter(fl.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === fl.key ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
              }`}
            >
              {t(fl.labelKey)}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={hideResolved}
              onChange={(e) => setHideResolved(e.target.checked)}
              className="size-4"
            />
            {t("calendar.hideResolved")}
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {items === null && !error && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {items !== null && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("calendar.empty")}</p>
      )}

      {URGENCY_ORDER.map((u) => {
        const group = visible.filter((it) => urgencyOf(it.date) === u);
        if (group.length === 0) return null;
        return (
          <section key={u} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <span className={`inline-block size-2.5 rounded-full ${urgencyMeta[u].dot}`} />
              {tl(urgencyMeta[u])}
              <span className="text-muted-foreground/70">({group.length})</span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {group.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Badge className={kindCls[it.kind]}>{t(kindKey[it.kind])}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${it.resolved ? "text-muted-foreground line-through" : ""}`}>
                      {it.title}
                    </div>
                    {it.caseId && it.kind !== "case" && (
                      <Link to={`/cases/${it.caseId}`} className="text-xs text-primary hover:underline">
                        {it.caseTitle}
                      </Link>
                    )}
                  </div>
                  {(it.kind === "income" || it.kind === "outcome") && it.amount != null && (
                    <span
                      className={`text-sm font-medium ${
                        it.kind === "income" ? "text-emerald-700" : "text-red-700"
                      }`}
                      dir="ltr"
                    >
                      {it.kind === "income" ? "+" : "−"}
                      {Math.round(it.amount).toLocaleString(lang === "he" ? "he-IL" : "en-GB")} {it.currency ?? "ILS"}
                    </span>
                  )}
                  <div className="text-end text-sm">
                    <div>{formatDate(it.date, lang)}</div>
                    <div className="text-xs text-muted-foreground">{relativeDays(it.date, lang)}</div>
                  </div>
                  {it.caseId && (
                    <Link to={`/cases/${it.caseId}`} className="text-sm text-primary hover:underline">
                      {t("common.open")} ←
                    </Link>
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
