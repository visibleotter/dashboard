import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Calendar, ClipboardList } from "lucide-react";
import {
  listCasesWithDocs,
  listSpendByCase,
  listTasks,
  updateTask,
  updateWorkStatus,
  type CaseWithDocs,
  type TaskWithCase,
} from "@/lib/data";
import { formatDate, relativeDays, urgencyMeta, urgencyOf } from "@/lib/dates";
import { buildCaseViews, type CaseView } from "@/lib/completeness";
import { useI18n } from "@/lib/i18n";
import { CaseWorkPreview } from "@/components/CaseWorkPreview";
import { RecentFiles } from "@/components/RecentFiles";
import {
  ALL_WORK_STATUSES,
  GROUP_ORDER,
  docTypeLabel,
  groupLabel,
  taskPriorityLabel,
  workStatusBadgeClass,
  workStatusLabel,
} from "@/lib/labels";
import type { CaseGroup, WorkStatus } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip, ChipCount } from "@/components/ui/chip";
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

  // Standalone tasks (no case_id)
  const standaloneTasks = useMemo(() =>
    tasks.filter((t) => !t.case_id && !t.done),
    [tasks],
  );

  async function handleStatusChange(caseId: string, newStatus: WorkStatus) {
    // Optimistic update — patches the row in place so the weekly review,
    // status pills and group sections all re-derive immediately.
    setCases((prev) =>
      prev?.map((c) =>
        c.id === caseId ? { ...c, work_status: newStatus } : c,
      ) ?? null,
    );
    await updateWorkStatus(caseId, newStatus);
    // Authoritative refresh — guards against any drift between optimistic state
    // and the DB (e.g. triggers, RLS rewrites, concurrent edits).
    const fresh = await listCasesWithDocs();
    setCases(fresh);
  }

  async function handleToggleTaskDone(taskId: string, done: boolean) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done } : t));
    await updateTask(taskId, { done });
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

          {/* Status filter bar */}
          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              {t("common.all")} <ChipCount n={views.length} />
            </Chip>
            {ALL_WORK_STATUSES.map((ws) => (
              <Chip
                key={ws}
                active={statusFilter === ws}
                onClick={() => setStatusFilter(ws)}
                dotClass={WORK_STATUS_DOTS[ws]}
              >
                {tl(workStatusLabel[ws])} <ChipCount n={countByStatus[ws]} />
              </Chip>
            ))}
          </div>

          {/* Group sub-filter */}
          {statusFilter === "all" && (
            <div className="flex flex-wrap gap-1.5">
              <Chip small active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
                {t("common.all")}
              </Chip>
              {GROUP_ORDER.map((g) => {
                const n = views.filter((v) => v.case.case_type?.group === g).length;
                if (!n) return null;
                return (
                  <Chip key={g} small active={groupFilter === g} onClick={() => setGroupFilter(g)}>
                    {tl(groupLabel[g])}
                  </Chip>
                );
              })}
            </div>
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {standaloneTasks.slice(0, 6).map((task) => {
                  const u = task.due_date ? urgencyOf(task.due_date) : null;
                  return (
                    <div
                      key={task.id}
                      className="group flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="text-sm font-medium text-foreground line-clamp-2">
                        {task.text}
                      </div>
                      {task.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {task.notes}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge className={taskPriorityLabel[task.priority].cls}>
                          {tl(taskPriorityLabel[task.priority])}
                        </Badge>
                        {task.due_date && u && (
                          <Badge className={urgencyMeta[u].cls}>
                            {formatDate(task.due_date, lang)} · {relativeDays(task.due_date, lang)}
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleTaskDone(task.id, true)}
                        className="mt-auto inline-flex items-center gap-1 self-start rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                      >
                        ✓ {t("tasks.markDone")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent files across documents + task/order attachments */}
          <RecentFiles />
        </>
      )}
    </div>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────

/** Color dots for the status-filter chips. */
const WORK_STATUS_DOTS: Record<WorkStatus, string> = {
  planned: "bg-blue-500",
  in_progress: "bg-green-500",
  on_hold: "bg-red-400",
  robot_on_way: "bg-amber-400",
  done: "bg-purple-500",
};

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
      <div className="rounded-2xl border bg-card shadow-card">
        {views.map((v, i) => (
          <CaseRow
            key={v.case.id}
            v={v}
            spent={spend.get(v.case.id) ?? 0}
            lang={lang}
            t={t}
            tl={tl}
            onStatusChange={onStatusChange}
            isFirst={i === 0}
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
  isFirst,
  isLast,
}: {
  v: CaseView;
  spent: number;
  lang: "he" | "en";
  t: (k: string, vars?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
  onStatusChange: (id: string, s: WorkStatus) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const ws = (v.case as CaseWithDocs & { work_status?: WorkStatus }).work_status ?? "in_progress";
  const fmt = (n: number) => Math.round(n).toLocaleString(lang === "he" ? "he-IL" : "en-GB");

  return (
    <div className={cn(!isLast && "border-b", isFirst && "rounded-t-2xl", isLast && !expanded && "rounded-b-2xl")}>
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

