import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Files, Link as LinkIcon } from "lucide-react";
import {
  getAttachmentUrl,
  getDocumentUrl,
  listRecentFiles,
  type RecentFile,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { FileIcon } from "@/components/AttachmentList";

/**
 * Dashboard widget: the 12 most recently-uploaded files across documents
 * (case-level), task attachments, and order attachments. Images render as
 * actual thumbnails (signed URL), other types as colour-coded icons. Click
 * → open in a new tab via a fresh signed URL.
 */
export function RecentFiles() {
  const { t, lang } = useI18n();
  const [files, setFiles] = useState<RecentFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    listRecentFiles(12)
      .then(async (rows) => {
        if (!alive) return;
        setFiles(rows);

        // Pre-fetch signed URLs for image thumbnails only (file rows, not links).
        const imageRows = rows.filter((r) => r.storage_path && r.mime_type?.startsWith("image/"));
        const urls = await Promise.all(
          imageRows.map(async (r) => {
            try {
              const url = r.source === "document"
                ? await getDocumentUrl(r.storage_path!, 1800)
                : await getAttachmentUrl(r.storage_path!, 1800);
              return [r.id, url] as const;
            } catch {
              return [r.id, ""] as const;
            }
          }),
        );
        if (!alive) return;
        setThumbUrls(Object.fromEntries(urls));
      })
      .catch((e) => setError(e.message));
    return () => { alive = false; };
  }, []);

  async function open(r: RecentFile) {
    try {
      // Link row: open the external URL directly. File row: fetch a signed URL.
      const url = r.external_url
        ?? (r.storage_path
              ? (r.source === "document"
                  ? await getDocumentUrl(r.storage_path)
                  : await getAttachmentUrl(r.storage_path))
              : null);
      if (!url) throw new Error("Attachment has no target");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) {
    return (
      <section className="rounded-2xl border bg-card shadow-card p-5">
        <p className="text-sm text-destructive">{error}</p>
      </section>
    );
  }
  if (files === null) {
    return (
      <section className="rounded-2xl border bg-card shadow-card p-5">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </section>
    );
  }
  if (files.length === 0) return null; // hide on empty rather than show empty state

  const sourceLabel: Record<RecentFile["source"], string> = {
    document: t("recentFiles.sourceDocument"),
    task: t("recentFiles.sourceTask"),
    order: t("recentFiles.sourceOrder"),
  };

  return (
    <section className="rounded-2xl border bg-card shadow-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Files className="size-4 text-primary" />
        {t("recentFiles.title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.map((r) => {
          const isLink = !!r.external_url;
          const isImage = !isLink && !!r.mime_type?.startsWith("image/");
          const thumb = thumbUrls[r.id];
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => open(r)}
              className="group flex flex-col gap-1.5 overflow-hidden rounded-xl border bg-card text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gray-50">
                {isImage && thumb ? (
                  <img src={thumb} alt={r.original_filename ?? ""} className="size-full object-cover" loading="lazy" />
                ) : isLink ? (
                  <LinkIcon className="size-10 text-blue-500" />
                ) : (
                  <div className="scale-[2]">
                    <FileIcon mime={r.mime_type} filename={r.original_filename} />
                  </div>
                )}
              </div>
              <div className="px-2.5 pb-2 pt-0.5">
                <div className="truncate text-xs font-medium text-foreground" title={isLink ? (r.external_url ?? "") : (r.original_filename ?? "")}>
                  {r.original_filename ?? (isLink ? hostOf(r.external_url!) : "—")}
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate">
                    {sourceLabel[r.source]}: {r.source_title}
                  </span>
                  <span dir="ltr" className="shrink-0 ms-1">{formatDate(r.uploaded_at, lang)}</span>
                </div>
                {r.case_id && (
                  <Link
                    to={`/cases/${r.case_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {r.case_title}
                  </Link>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); }
  catch { return url; }
}
