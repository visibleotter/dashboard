import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCasesWithDocs, type CaseWithDocs } from "@/lib/data";
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
    listCasesWithDocs()
      .then(setCases)
      .catch((e) => setError(e.message));
  }, []);

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
          return <GroupSection key={group} group={group} views={inGroup} t={t} tl={tl} />;
        })}
    </div>
  );
}

function GroupSection({
  group,
  views,
  t,
  tl,
}: {
  group: CaseGroup;
  views: CaseView[];
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
          <li key={v.case.id}>
            <Link
              to={`/cases/${v.case.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{v.case.title}</span>
                  {v.case.parent_id && (
                    <Badge className="bg-white/10 text-neutral-300">{t("cases.child")}</Badge>
                  )}
                  {v.children.length > 0 && (
                    <Badge className="bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/25">
                      {t("cases.children", { n: v.children.length })}
                    </Badge>
                  )}
                  {v.own.missing.length > 0 && (
                    <Badge className="bg-red-500/15 text-red-300 ring-1 ring-red-400/25">
                      {t("cases.missingDocs", { n: v.own.missing.length })}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {v.case.case_type ? tl({ he: v.case.case_type.name_he, en: v.case.case_type.name_en }) : "—"}
                  {v.case.counterparty ? ` · ${v.case.counterparty.name}` : ""}
                </div>
              </div>
              <Badge className={statusBadgeClass[v.status]}>{tl(statusLabel[v.status])}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
