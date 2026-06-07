import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Calendar, ClipboardList } from "lucide-react";
import {
  listCasesWithDocs,
  listSpendByCase,
  listTasks,
  updateWorkStatus,
  type CaseWithDocs,
  type TaskWithCase,
} from "@/lib/data";
import { buildCaseViews, type CaseView } from "@/lib/completeness";
import { useI18n } from "@/lib/i18n";
import { CaseWorkPreview } from "@/components/CaseWorkPreview";
import {
  ALL_WORK_STATUSES,
  GROUP_ORDER,
  docTypeLabel,
  groupLabel,
  workStatusBadgeClass,
  workStatusLabel,
} from "@/lib/labels";
import type { CaseGroup, WorkStatus } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── WorkStatus inline picker ───────────────────────────────────────────────

function StatusPicker({
  current,
  onChange,
}: {
  current: WorkStatus;
  onChange: (s: WorkStatus) => void;
}) {
  const { tl } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-opacity hover:opacity-80",
          workStatusBadgeClass[current],
        )}
      >
        {tl(workStatusLabel[current])}
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-30 mt-1 w-44 rounded-xl border bg-card shadow-lg shadow-gray-200/60 py-1">
          {ALL_WORK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50",
                s === current && "bg-gray-50",
              )}
            >
              <span className={cn("size-2 rounded-full", {
                "bg-blue-500": s === "planned",
                "bg-green-500": s === "in_progress",
                "bg-red-400": s === "on_hold",
                "bg-amber-400": s === "robot_on_way",
                "bg-purple-500": s === "done",
              })} />
              {tl(workStatusLabel[s])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t, tl, lang } = useI18n();
  const [cases, setCases] = useState<CaseWithDocs[] | null>(null);
  const [tasks, setTasks] = useState<TaskWithCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState<CaseGroup | "all">("all");
  const [spendByCase, setSpendByCase] = useState<Map<string, number>>(new Map());
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [reviewOpen, setReviewOpen] = useState(() => new Date().getDay() === 0);

  useEffect(() => {
    listCasesWithDocs().then(setCases).catch((e) => setError(e.message));
    listSpendByCase().then(setSpendByCase).catch(() => {});
    listTasks().then(setTasks).catch(() => {});
  }, []);

  const views = useMemo(() => (cases ? buildCaseViews(cases) : []), [cases]);

  // Apply work_status + group filters
  const filtered = useMemo(() => {
    return views.filter((v) => {
      const ws = (v.case as CaseWithDocs & { work_status?: WorkStatus }).work_status ?? "in_progress";
      if (statusFilter !== "all" && ws !== statusFilter) return false;
      if (groupFilter !== "all" && v.case.case_type?.group !== groupFilter) return false;
      return true;
    });
  }, [views, statusFilter, groupFilter]);

  // Cases for weekly review (in_progress + robot_on_way)
  const reviewCases = useMemo(() =>
    views.filter((v) => {
      const ws = (v.case as CaseWithDocs & { work_status?: WorkStatus }).work_status ?? "in_progress";
      return ws === "in_progress" || ws === "robot_on_way";
    }),
    [views],
  );

  // Project cases for budget picker
  const projectCases = useMemo(() =>
    views.filter((v) => v.case.case_type?.group === "project"),
    [views],
  );
  const selectedProject = useMemo(() =>
    projectCases.find((v) => v.case.id === selectedProjectId) ?? projectCases[0] ?? null,
    [projectCases, selectedProjectId],
  );

  // Standalone tasks (no case_id)
  const standaloneTasks = useMemo(() =>
    tasks.filter((t) => !t.case_id && !t.done),
    [tasks],
  );

  async function handleStatusChange(caseId: string, newStatus: WorkStatus) {
    setCases((prev) =>
      prev?.map((c) =>
        c.id === caseId ? { ...c, work_status: newStatus } : c,
      ) ?? null,
    );
    await updateWorkStatus(caseId, newStatus);
  }

  // Status filter counts
  const countByStatus = useMemo(() => {
    const m: Record<WorkStatus, number> = { planned: 0, in_progress: 0, on_hold: 0, robot_on_way: 0, done: 0 };
    for (const v of views) {
      const ws = (v.case as CaseWithDocs & { work_status?: WorkStatus }).work_status ?? "in_progress";
      m[ws] = (m[ws] ?? 0) + 1;
    }
    return m;
  }, [views]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button asChild className="bg-brand-gradient text-white shadow-glow hover:opacity-90">
          <Link to="/cases/new">+ {t("dashboard.newCase")}</Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}
      {cases === null && !error && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {cases !== null && (
        <>
          {/* Status filter bar */}
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              {t("common.all")} <CountBubble n={views.length} />
            </FilterPill>
            {ALL_WORK_STATUSES.map((ws) => (
              <FilterPill key={ws} active={statusFilter === ws} onClick={() => setStatusFilter(ws)} status={ws}>
                {tl(workStatusLabel[ws])} <CountBubble n={countByStatus[ws]} />
              </FilterPill>
            ))}
          </div>

          {/* Group sub-filter */}
          {statusFilter === "all" && (
            <div className="flex flex-wrap gap-1.5">
              <FilterPill small active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
                {t("common.all")}
              </FilterPill>
              {GROUP_ORDER.map((g) => {
                const n = views.filter((v) => v.case.case_type?.group === g).length;
                if (!n) return null;
                return (
                  <FilterPill key={g} small active={groupFilter === g} onClick={() => setGroupFilter(g)}>
                    {tl(groupLabel[g])}
                  </FilterPill>
                );
              })}
            </div>
          )}

          {/* Weekly Review panel */}
          {reviewCases.length > 0 && (
            <section className="rounded-2xl border bg-card shadow-card">
              <button
                type="button"
                onClick={() => setReviewOpen((o) => !o)}
                className="flex w-full items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Calendar className="size-4 text-primary" />
                  {t("dashboard.weeklyReview")} — {reviewCases.length} {t("dashboard.activeCases")}
                </div>
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", reviewOpen && "rotate-180")} />
              </button>
              {reviewOpen && (
                <div className="border-t px-5 pb-4 pt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {reviewCases.map((v) => {
                    const ws = (v.case as CaseWithDocs & { work_status?: WorkStatus }).work_status ?? "in_progress";
                    const nextMissing = v.own.missing[0];
                    return (
                      <Link
                        key={v.case.id}
                        to={`/cases/${v.case.id}`}
                        className="group rounded-xl border p-3 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        <div className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">
                          {v.case.title}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1", workStatusBadgeClass[ws])}>
                            {tl(workStatusLabel[ws])}
                          </span>
                          {nextMissing ? (
                            <span className="text-xs text-amber-600">
                              ← {tl(docTypeLabel[nextMissing])}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600">{t("dashboard.allPresent")}</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Cases grouped by type */}
          {views.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
              <Button asChild className="mt-4 bg-brand-gradient text-white shadow-glow hover:opacity-90">
                <Link to="/cases/new">+ {t("dashboard.newCase")}</Link>
              </Button>
            </div>
          ) : (
            GROUP_ORDER.filter((g) => groupFilter === "all" || groupFilter === g).map((group) => {
              const inGroup = filtered.filter((v) => v.case.case_type?.group === group);
              if (inGroup.length === 0) return null;
              return (
                <GroupSection
                  key={group}
                  group={group}
                  views={inGroup}
                  spend={spendByCase}
                  lang={lang}
                  t={t}
                  tl={tl}
                  onStatusChange={handleStatusChange}
                />
              );
            })
          )}

          {/* Project budget picker */}
          {projectCases.length > 0 && (
            <section className="rounded-2xl border bg-card shadow-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-foreground">{t("dashboard.projectBudget")}</h2>
                <select
                  value={selectedProjectId || selectedProject?.case.id || ""}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {projectCases.map((v) => (
                    <option key={v.case.id} value={v.case.id}>{v.case.title}</option>
                  ))}
                </select>
              </div>
              {selectedProject && (
                <ProjectBudgetBar
                  budget={selectedProject.case.total_amount ?? 0}
                  spent={spendByCase.get(selectedProject.case.id) ?? 0}
                  currency={selectedProject.case.currency ?? "ILS"}
                  t={t}
                  lang={lang}
                />
              )}
            </section>
          )}

          {/* Standalone tasks */}
          {standaloneTasks.length > 0 && (
            <section className="rounded-2xl border bg-card shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList className="size-4 text-primary" />
                  {t("dashboard.standaloneTasks")}
                </h2>
                <Link to="/tasks" className="text-xs text-primary hover:underline">
                  {t("upcoming.all")}
                </Link>
              </div>
              <ul className="space-y-1.5">
                {standaloneTasks.slice(0, 6).map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-sm">
                    <span className="size-1.5 shrink-0 rounded-full bg-primary/40" />
                    <span className="text-foreground">{task.text}</span>
                    {task.due_date && (
                      <span className="ms-auto text-xs text-muted-foreground">{task.due_date}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
  small,
  status,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
  status?: WorkStatus;
}) {
  const statusDot = status ? {
    planned: "bg-blue-500",
    in_progress: "bg-green-500",
    on_hold: "bg-red-400",
    robot_on_way: "bg-amber-400",
    done: "bg-purple-500",
  }[status] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-all",
        small ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        active
          ? "border-primary/30 bg-primary/10 font-semibold text-primary"
          : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground",
      )}
    >
      {statusDot && (
        <span className={cn("size-2 rounded-full", statusDot)} />
      )}
      {children}
    </button>
  );
}

function CountBubble({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ms-0.5 rounded-full bg-gray-100 px-1.5 py-0 text-xs font-normal text-muted-foreground">
      {n}
    </span>
  );
}

// ── Group section ──────────────────────────────────────────────────────────

function GroupSection({
  group,
  views,
  spend,
  lang,
  t,
  tl,
  onStatusChange,
}: {
  group: CaseGroup;
  views: CaseView[];
  spend: Map<string, number>;
  lang: "he" | "en";
  t: (k: string, v?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
  onStatusChange: (id: string, s: WorkStatus) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        {tl(groupLabel[group])}
        <span className="rounded-full bg-gray-100 px-2 py-0 text-xs font-normal text-muted-foreground">
          {views.length}
        </span>
      </h2>
      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        {views.map((v, i) => (
          <CaseRow
            key={v.case.id}
            v={v}
            spent={spend.get(v.case.id) ?? 0}
            lang={lang}
            t={t}
            tl={tl}
            onStatusChange={onStatusChange}
            isLast={i === views.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function CaseRow({
  v,
  spent,
  lang,
  t,
  tl,
  onStatusChange,
  isLast,
}: {
  v: CaseView;
  spent: number;
  lang: "he" | "en";
  t: (k: string, vars?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
  onStatusChange: (id: string, s: WorkStatus) => void;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const ws = (v.case as CaseWithDocs & { work_status?: WorkStatus }).work_status ?? "in_progress";
  const fmt = (n: number) => Math.round(n).toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  return (
    <div className={cn(!isLast && "border-b")}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50/80">
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="expand"
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((o) => !o)}
              className="truncate text-start text-sm font-semibold text-foreground hover:text-primary"
            >
              {v.case.title}
            </button>
            {v.case.counterparty && (
              <span className="text-xs text-muted-foreground">{(v.case as CaseWithDocs & { counterparty?: { name: string } }).counterparty?.name}</span>
            )}
            {v.case.parent_id && (
              <Badge className="bg-gray-100 text-gray-500 ring-1 ring-gray-200 text-xs">
                {t("cases.child")}
              </Badge>
            )}
            {v.incompleteChildren > 0 && (
              <Badge className="bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-xs">
                {t("dashboard.incompleteChildren", { n: v.incompleteChildren })}
              </Badge>
            )}
          </div>

          {/* Missing docs — only for active statuses */}
          {v.showMissingDocs && (
            v.own.missing.length === 0 ? (
              <div className="mt-0.5 text-xs text-emerald-600">{t("dashboard.allPresent")}</div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {t("dashboard.missingLabel", { satisfied: v.own.satisfied.length, total: v.own.expected.length })}
                </span>
                {v.own.missing.map((dt) => (
                  <Badge key={dt} className="bg-red-50 text-red-600 ring-1 ring-red-200 text-xs">
                    {tl(docTypeLabel[dt])}
                  </Badge>
                ))}
              </div>
            )
          )}
        </div>

        {/* Spend badge */}
        {spent > 0 && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            ₪{fmt(spent)}{v.case.total_amount ? ` / ₪${fmt(v.case.total_amount)}` : ""}
          </span>
        )}

        {/* Inline status picker */}
        <StatusPicker
          current={ws}
          onChange={(s) => onStatusChange(v.case.id, s)}
        />

        <Link
          to={`/cases/${v.case.id}`}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          {t("common.open")} →
        </Link>
      </div>

      {expanded && <CaseWorkPreview caseId={v.case.id} />}
    </div>
  );
}

// ── Project budget bar ─────────────────────────────────────────────────────

function ProjectBudgetBar({
  budget,
  spent,
  currency,
  t,
  lang,
}: {
  budget: number;
  spent: number;
  currency: string;
  t: (k: string) => string;
  lang: "he" | "en";
}) {
  const fmt = (n: number) => Math.round(n).toLocaleString(lang === "he" ? "he-IL" : "en-GB");
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const remaining = budget - spent;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("spend.spent")} — <strong className="text-foreground">{currency} {fmt(spent)}</strong></span>
        <span className="text-muted-foreground">{t("spend.budget")} — <strong className="text-foreground">{currency} {fmt(budget)}</strong></span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-green-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{Math.round(pct)}% {t("spend.used")}</span>
        {remaining > 0 && (
          <span>{t("spend.remaining")} {currency} {fmt(remaining)}</span>
        )}
      </div>
    </div>
  );
}
