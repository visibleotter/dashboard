import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { listCasesWithDocs, listSpendByCase, type CaseWithDocs } from "@/lib/data";
import { buildCaseViews, type CaseView } from "@/lib/completeness";
import { useI18n } from "@/lib/i18n";
import { SpendSummary } from "@/components/SpendSummary";
import { CaseWorkPreview } from "@/components/CaseWorkPreview";
import { GROUP_ORDER, docTypeLabel, groupLabel, statusBadgeClass, statusLabel } from "@/lib/labels";
import type { CaseGroup } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpcomingTasks } from "@/components/UpcomingTasks";

export function DashboardPage() {
  const { t, tl, lang } = useI18n();
  const [cases, setCases] = useState<CaseWithDocs[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<CaseGroup | "all">("all");
  const [spendByCase, setSpendByCase] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    listCasesWithDocs()
      .then(setCases)
      .catch((e) => setError(e.message));
    listSpendByCase().then(setSpendByCase).catch(() => setSpendByCase(new Map()));
  }, []);

  const views = useMemo(() => (cases ? buildCaseViews(cases) : []), [cases]);

  // Projects budget vs spent (open project-group cases).
  const finance = useMemo(() => {
    const projects = views.filter((v) => v.case.case_type?.group === "project" && v.status !== "closed");
    const budget = projects.reduce((s, v) => s + (v.case.total_amount ?? 0), 0);
    const spent = projects.reduce((s, v) => s + (spendByCase.get(v.case.id) ?? 0), 0);
    return { budget, spent, count: projects.length };
  }, [views, spendByCase]);

  const stats = useMemo(() => {
    const open = views.filter((v) => v.status !== "closed");
    return {
      incomplete: views.filter((v) => v.status === "incomplete").length,
      attention: views.filter((v) => v.status === "attention").length,
      complete: views.filter((v) => v.status === "complete").length,
      missingDocs: open.reduce((sum, v) => sum + v.own.missing.length, 0),
    };
  }, [views]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/cases/new">+ {t("dashboard.newCase")}</Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {cases === null && !error && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {cases !== null && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("dashboard.statIncomplete")} value={stats.incomplete} tone="amber" />
            <StatCard label={t("dashboard.statMissingDocs")} value={stats.missingDocs} tone="red" />
            <StatCard label={t("dashboard.statAttention")} value={stats.attention} tone="red" />
            <StatCard label={t("dashboard.statComplete")} value={stats.complete} tone="emerald" />
          </div>

          {finance.count > 0 && (
            <SpendSummary budget={finance.budget} spent={finance.spent} currency="ILS" />
          )}

          <UpcomingTasks />

          {views.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
              <Button asChild className="mt-4">
                <Link to="/cases/new">+ {t("dashboard.newCase")}</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Group "ways" filter — arrange cases by the 5 process types */}
              <div className="flex flex-wrap gap-2">
                <GroupTab active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
                  {t("common.all")} ({views.length})
                </GroupTab>
                {GROUP_ORDER.map((group) => {
                  const n = views.filter((v) => v.case.case_type?.group === group).length;
                  if (n === 0) return null;
                  return (
                    <GroupTab key={group} active={groupFilter === group} onClick={() => setGroupFilter(group)}>
                      {tl(groupLabel[group])} ({n})
                    </GroupTab>
                  );
                })}
              </div>

              {GROUP_ORDER.filter((g) => groupFilter === "all" || groupFilter === g).map((group) => {
                const inGroup = views.filter((v) => v.case.case_type?.group === group);
                if (inGroup.length === 0) return null;
                return (
                  <GroupGaps key={group} group={group} views={inGroup} spend={spendByCase} lang={lang} t={t} tl={tl} />
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

const toneClass: Record<string, string> = {
  amber: "text-amber-300",
  red: "text-red-300",
  emerald: "text-emerald-300",
  neutral: "text-foreground",
};
const toneIcon: Record<string, string> = {
  amber: "from-amber-400 to-orange-500",
  red: "from-red-400 to-rose-500",
  emerald: "from-emerald-400 to-teal-500",
  neutral: "from-sky-400 to-blue-600",
};

function GroupTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-brand-gradient text-white shadow-glow" : "border border-white/10 bg-card hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-card p-4">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${toneClass[tone] ?? toneClass.neutral}`}>{value}</div>
      </div>
      <div className={`size-11 shrink-0 rounded-xl bg-gradient-to-br ${toneIcon[tone] ?? toneIcon.neutral} shadow-glow`} />
    </div>
  );
}

function GroupGaps({
  group,
  views,
  spend,
  lang,
  t,
  tl,
}: {
  group: CaseGroup;
  views: CaseView[];
  spend: Map<string, number>;
  lang: "he" | "en";
  t: (k: string, v?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">
        {tl(groupLabel[group])} <span className="text-muted-foreground/70">({views.length})</span>
      </h2>
      <ul className="divide-y rounded-lg border bg-card">
        {views.map((v) => (
          <ProjectRow key={v.case.id} v={v} spent={spend.get(v.case.id) ?? 0} lang={lang} t={t} tl={tl} />
        ))}
      </ul>
    </section>
  );
}

function ProjectRow({
  v,
  spent,
  lang,
  t,
  tl,
}: {
  v: CaseView;
  spent: number;
  lang: "he" | "en";
  t: (k: string, vars?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
}) {
  const [open, setOpen] = useState(false);
  const money = (n: number) => Math.round(n).toLocaleString(lang === "he" ? "he-IL" : "en-GB");
  const Chevron = open ? ChevronDown : ChevronLeft;

  return (
    <li>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/50">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="expand"
        >
          <Chevron className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setOpen((o) => !o)} className="truncate text-start font-medium hover:underline">
              {v.case.title}
            </button>
            {v.case.parent_id && <Badge className="bg-white/10 text-neutral-300">{t("cases.child")}</Badge>}
            {v.incompleteChildren > 0 && (
              <Badge className="bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25">
                {t("dashboard.incompleteChildren", { n: v.incompleteChildren })}
              </Badge>
            )}
            {spent > 0 && (
              <Badge className="bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25">
                {t("spend.spent")} ₪{money(spent)}
                {v.case.total_amount ? ` / ₪${money(v.case.total_amount)}` : ""}
              </Badge>
            )}
          </div>
          {v.own.missing.length === 0 ? (
            <div className="text-sm text-emerald-300">{t("dashboard.allPresent")}</div>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("dashboard.missingLabel", { satisfied: v.own.satisfied.length, total: v.own.expected.length })}
              </span>
              {v.own.missing.map((dt) => (
                <Badge key={dt} className="bg-red-500/15 text-red-300 ring-1 ring-red-400/25">
                  {tl(docTypeLabel[dt])}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Badge className={statusBadgeClass[v.status]}>{tl(statusLabel[v.status])}</Badge>
        <Link to={`/cases/${v.case.id}`} className="text-sm text-primary hover:underline">
          {t("common.open")} ←
        </Link>
      </div>
      {open && <CaseWorkPreview caseId={v.case.id} />}
    </li>
  );
}
