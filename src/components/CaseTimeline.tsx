import { useEffect, useState } from "react";
import { listDocuments, listMilestones } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { docTypeLabel } from "@/lib/labels";

/*
  Per-case timeline (brief §6): a chronological view derived from document dates, milestone
  due/paid dates, and the case creation date. Read-only; events come from data already entered.
*/

interface TimelineEvent {
  t: number; // sort key (ms)
  date: string; // display
  label: string;
  dot: string;
}

function fmt(d: string | null, locale: string): { t: number; label: string } {
  if (!d) return { t: 0, label: "—" };
  const ms = Date.parse(d.length <= 10 ? `${d}T00:00:00` : d);
  return { t: ms, label: new Date(ms).toLocaleDateString(locale) };
}

export function CaseTimeline({ caseId, createdAt }: { caseId: string; createdAt: string }) {
  const { t, tl, lang } = useI18n();
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const locale = lang === "he" ? "he-IL" : "en-GB";
    Promise.all([listDocuments(caseId), listMilestones(caseId)])
      .then(([docs, milestones]) => {
        if (!active) return;
        const evs: TimelineEvent[] = [];

        const c = fmt(createdAt, locale);
        evs.push({ t: c.t, date: c.label, label: t("timeline.created"), dot: "bg-neutral-400" });

        for (const d of docs) {
          const when = fmt(d.doc_date ?? d.uploaded_at, locale);
          const typeLabel = tl(docTypeLabel[d.doc_type]);
          evs.push({
            t: when.t,
            date: when.label,
            label:
              t("timeline.document", { type: typeLabel }) +
              (d.original_filename ? ` · ${d.original_filename}` : ""),
            dot: "bg-sky-500",
          });
        }

        for (const m of milestones) {
          if (m.due_date) {
            const when = fmt(m.due_date, locale);
            evs.push({
              t: when.t,
              date: when.label,
              label: t("timeline.paymentPlanned", { label: m.label }),
              dot: "bg-amber-500",
            });
          }
          if (m.paid && m.paid_at) {
            const when = fmt(m.paid_at, locale);
            evs.push({
              t: when.t,
              date: when.label,
              label: t("timeline.paymentDone", { label: m.label }),
              dot: "bg-emerald-500",
            });
          }
        }

        evs.sort((a, b) => a.t - b.t);
        setEvents(evs);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [caseId, createdAt, t, tl, lang]);

  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="text-sm font-medium text-muted-foreground">{t("timeline.title")}</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {events && events.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("timeline.none")}</p>
      )}
      {events && events.length > 0 && (
        <ol className="relative space-y-3 border-s ps-5">
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span
                className={`absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full ${e.dot} ring-2 ring-background`}
              />
              <div className="text-sm">{e.label}</div>
              <div className="text-xs text-muted-foreground">{e.date}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
