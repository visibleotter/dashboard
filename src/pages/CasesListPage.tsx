import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { deleteCase, listCasesWithDocs, type CaseWithDocs } from "@/lib/data";
import { buildCaseViews, type CaseView } from "@/lib/completeness";
import { useI18n } from "@/lib/i18n";
import { GROUP_ORDER, groupLabel, statusBadgeClass, statusLabel } from "@/lib/labels";
import type { CaseGroup } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CasesListPage() {
  const { t, tl } = useI18n();
  const [cases, setCases] = useState<CaseWithDocs[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCasesWithDocs().then(setCases).catch((e) => setError(e.message));
  }, []);

  async function handleDelete(v: CaseView, e: React.MouseEvent) {
    e.preventDefault();
    const msg = v.children.length > 0
      ? t("caseForm.deleteConfirmChildren", { n: v.children.length })
      : t("caseForm.deleteConfirm");
    if (!confirm(msg)) return;
    await deleteCase(v.case.id);
    setCases((prev) => prev?.filter((c) => c.id !== v.case.id) ?? null);
  }

  const views = useMemo(() => (cases ? buildCaseViews(cases) : []), [cases]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("cases.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("cases.subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/cases/new">+ {t("cases.newCase")}</Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {cases === null && !error && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {cases !== null && views.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("cases.empty")}</p>
          <Button asChild className="mt-4">
            <Link to="/cases/new">+ {t("cases.newCase")}</Link>
          </Button>
        </div>
      )}

      {cases !== null &&
        views.length > 0 &&
        GROUP_ORDER.map((group) => {
          const inGroup = views.filter((v) => v.case.case_type?.group === group);
          if (inGroup.length === 0) return null;
          return <GroupSection key={group} group={group} views={inGroup} t={t} tl={tl} onDelete={handleDelete} />;
        })}
    </div>
  );
}

function GroupSection({
  group,
  views,
  t,
  tl,
  onDelete,
}: {
  group: CaseGroup;
  views: CaseView[];
  t: (k: string, v?: Record<string, string | number>) => string;
  tl: (l: { he: string; en: string }) => string;
  onDelete: (v: CaseView, e: React.MouseEvent) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        {tl(groupLabel[group])}{" "}
        <span className="rounded-full bg-gray-100 px-2 py-0 text-xs font-normal text-muted-foreground">
          {views.length}
        </span>
      </h2>
      <ul className="divide-y rounded-2xl border bg-card shadow-card overflow-hidden">
        {views.map((v) => (
          <li key={v.case.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Link to={`/cases/${v.case.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-foreground group-hover:text-primary">
                  {v.case.title}
                </span>
                {v.case.parent_id && (
                  <Badge className="bg-gray-100 text-gray-500 ring-1 ring-gray-200">{t("cases.child")}</Badge>
                )}
                {v.children.length > 0 && (
                  <Badge className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                    {t("cases.children", { n: v.children.length })}
                  </Badge>
                )}
                {v.showMissingDocs && v.own.missing.length > 0 && (
                  <Badge className="bg-red-50 text-red-600 ring-1 ring-red-200">
                    {t("cases.missingDocs", { n: v.own.missing.length })}
                  </Badge>
                )}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {v.case.case_type ? tl({ he: v.case.case_type.name_he, en: v.case.case_type.name_en }) : "—"}
                {v.case.counterparty ? ` · ${v.case.counterparty.name}` : ""}
              </div>
            </Link>
            <Badge className={statusBadgeClass[v.status]}>{tl(statusLabel[v.status])}</Badge>
            <button
              type="button"
              onClick={(e) => onDelete(v, e)}
              className="hidden shrink-0 text-muted-foreground hover:text-red-500 group-hover:inline-flex"
              title={t("caseForm.deleteConfirm")}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
