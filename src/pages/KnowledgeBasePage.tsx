import { useI18n } from "@/lib/i18n";
import { KB_PROCESSES, type KbProcess } from "@/lib/knowledgeBase";
import { groupLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";

export function KnowledgeBasePage() {
  const { t, tl } = useI18n();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("kb.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("kb.subtitle")}</p>
      </div>

      {/* quick jump */}
      <nav className="flex flex-wrap gap-2">
        {KB_PROCESSES.map((p) => (
          <a
            key={p.id}
            href={`#kb-${p.id}`}
            className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            {tl(p.title)}
          </a>
        ))}
      </nav>

      {KB_PROCESSES.map((p) => (
        <Process key={p.id} process={p} />
      ))}
    </div>
  );
}

function Process({ process: p }: { process: KbProcess }) {
  const { t, tl } = useI18n();
  return (
    <section id={`kb-${p.id}`} className="scroll-mt-20 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{tl(p.title)}</h2>
        <Badge className="bg-secondary text-secondary-foreground">{tl(groupLabel[p.group])}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{tl(p.intro)}</p>

      {p.steps.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">{t("kb.logic")}</div>
          <table className="w-full text-start text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t("kb.step")}</th>
                <th className="px-4 py-2 text-start font-medium">{t("kb.stage")}</th>
                <th className="px-4 py-2 text-start font-medium">{t("kb.stageDocs")}</th>
              </tr>
            </thead>
            <tbody>
              {p.steps.map((s, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2">{tl(s.stage)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{tl(s.docs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.documents.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">{t("kb.documents")}</div>
          <table className="w-full text-start text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t("kb.docName")}</th>
                <th className="px-4 py-2 text-start font-medium">{t("kb.issuedBy")}</th>
                <th className="px-4 py-2 text-start font-medium">{t("kb.issuedTo")}</th>
                <th className="px-4 py-2 text-start font-medium">{t("kb.example")}</th>
              </tr>
            </thead>
            <tbody>
              {p.documents.map((d, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="px-4 py-2 font-medium">{tl(d.name)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{tl(d.issuedBy)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{tl(d.issuedTo)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{tl(d.example)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.notes.map((n, i) => (
        <div key={i} className="rounded-lg border-s-4 border-s-primary bg-muted/30 px-4 py-3">
          <div className="text-sm font-medium">{tl(n.title)}</div>
          <p className="mt-1 text-sm text-muted-foreground">{tl(n.body)}</p>
        </div>
      ))}
    </section>
  );
}
