import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import { VISION_CHAPTERS, type VisionChapter, type VisionSubsection } from "@/lib/visionGuide";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/*
  AI Vision Systems guide. Russian content, Russian UI. Sticky TOC on the left,
  collapsible chapters on the right. Section IDs become URL anchors so deep
  links work (e.g. /vision#calibration-handeye).
*/

export function VisionGuidePage() {
  // The page renders its own Russian copy regardless of the app's HE/EN toggle —
  // this is a separate documentation domain.
  const { lang } = useI18n();
  const isRtl = lang === "he";

  // Track which chapter's sections are expanded (default: first chapter open).
  const [openChapters, setOpenChapters] = useState<Set<string>>(
    () => new Set([VISION_CHAPTERS[0]?.id]),
  );
  // Active TOC entry — based on scroll position.
  const [activeId, setActiveId] = useState<string>(VISION_CHAPTERS[0]?.id ?? "");

  // Light scrollspy. We watch each chapter card top against the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    for (const ch of VISION_CHAPTERS) {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function toggleChapter(id: string) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenChapters(new Set(VISION_CHAPTERS.map((c) => c.id)));
  }
  function collapseAll() {
    setOpenChapters(new Set());
  }

  return (
    <div className="space-y-6" dir="ltr">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Eye className="size-5 text-primary" />
            AI Vision Systems
          </h1>
          <p className="text-sm text-muted-foreground">
            Интерактивный гид по системам технического зрения: оборудование, калибровка,
            обработка облака точек, интеграция с роботом.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={expandAll}>Раскрыть все</Button>
          <Button size="sm" variant="ghost" onClick={collapseAll}>Свернуть все</Button>
        </div>
      </header>

      <div className={`grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] ${isRtl ? "lg:[direction:ltr]" : ""}`}>
        {/* Sticky TOC */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav
            aria-label="Содержание"
            className="rounded-2xl border bg-card p-3 shadow-card"
          >
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Содержание
            </p>
            <ul className="space-y-0.5">
              {VISION_CHAPTERS.map((ch) => (
                <li key={ch.id}>
                  <a
                    href={`#${ch.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenChapters((prev) => new Set(prev).add(ch.id));
                      document.getElementById(ch.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeId === ch.id
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
                    }`}
                  >
                    {ch.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Chapters */}
        <div className="space-y-4">
          {VISION_CHAPTERS.map((ch) => (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              open={openChapters.has(ch.id)}
              onToggle={() => toggleChapter(ch.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chapter ─────────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  open,
  onToggle,
}: {
  chapter: VisionChapter;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      id={chapter.id}
      className="overflow-hidden rounded-2xl border bg-card shadow-card scroll-mt-20"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-start hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-expanded={open}
        aria-controls={`${chapter.id}-body`}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{chapter.title}</h2>
          {chapter.intro && (
            <p className="mt-1 text-sm text-muted-foreground">{chapter.intro}</p>
          )}
        </div>
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
      </button>

      {open && (
        <div id={`${chapter.id}-body`} className="border-t bg-gray-50/40 p-4 space-y-2">
          {chapter.sections.map((s) => (
            <Subsection key={s.id} section={s} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Subsection (collapsible) ────────────────────────────────────────────────

function Subsection({ section }: { section: VisionSubsection }) {
  const [open, setOpen] = useState(false);

  return (
    <div id={section.id} className="rounded-lg border bg-card shadow-sm scroll-mt-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-gray-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-lg"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">{section.title}</span>
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
      </button>
      {open && (
        <div className="border-t px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          <FormattedBody text={section.body} />
        </div>
      )}
    </div>
  );
}

/** Render plain text with paragraph splits on \n\n and bullet lines on "- ". */
function FormattedBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        const lines = para.split("\n");
        const isBullet = lines.every((l) => l.trim().startsWith("- "));
        if (isBullet) {
          return (
            <ul key={i} className="list-disc ps-5 space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{l.trim().replace(/^-\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-wrap">{para}</p>;
      })}
    </div>
  );
}
