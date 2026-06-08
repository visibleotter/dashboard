import { useEffect, useRef, useState } from "react";
import { FileText, FileSpreadsheet, FileType, FileImage, Paperclip, Plus, Trash2, X } from "lucide-react";
import {
  deleteAttachment,
  getAttachmentUrl,
  listAttachments,
  uploadAttachment,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import type { Attachment, AttachmentEntityType } from "@/types/db";

/**
 * Reusable file list for tasks/orders. Self-contained: fetches its own list,
 * refreshes after upload/delete. Drops into any row.
 *
 * Compact mode shows just a paperclip + count chip that expands on click.
 * Non-compact (default) renders the full list inline.
 */
export function AttachmentList({
  entityType,
  entityId,
  compact = false,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Attachment[] | null>(null);
  const [open, setOpen] = useState(!compact);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAttachments(entityType, entityId).then(setItems).catch((e) => setError(e.message));
  }, [entityType, entityId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        await uploadAttachment(entityType, entityId, f);
      }
      setItems(await listAttachments(entityType, entityId));
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(a: Attachment) {
    if (!confirm(t("attachments.deleteConfirm"))) return;
    try {
      await deleteAttachment(a);
      setItems((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleOpen(a: Attachment) {
    try {
      const url = await getAttachmentUrl(a.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const count = items?.length ?? 0;

  // Compact chip — toggles the expanded list
  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground hover:bg-gray-200 hover:text-foreground"
        title={t("attachments.title")}
      >
        <Paperclip className="size-3" />
        {count > 0 ? count : "+"}
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border bg-gray-50/60 px-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          <Paperclip className="me-1 inline-block size-3" />
          {t("attachments.title")} {count > 0 && `(${count})`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="size-3" /> {uploading ? t("attachments.uploading") : t("attachments.add")}
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title={t("common.cancel")}
            >
              <X className="size-3.5" />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {items === null ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("attachments.empty")}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((a) => (
            <li key={a.id} className="group flex items-center gap-2 text-xs">
              <FileIcon mime={a.mime_type} filename={a.original_filename} />
              <button
                type="button"
                onClick={() => handleOpen(a)}
                className="min-w-0 flex-1 truncate text-start text-primary hover:underline"
                title={a.original_filename ?? ""}
              >
                {a.original_filename ?? a.storage_path.split("/").pop()}
              </button>
              <span className="shrink-0 text-muted-foreground" dir="ltr">
                {formatDate(a.uploaded_at, lang)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(a)}
                className="hidden text-muted-foreground hover:text-red-500 group-hover:inline-flex"
                title={t("attachments.deleteConfirm")}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── shared file-type icon (also used by RecentFiles) ────────────────────────

export function FileIcon({ mime, filename }: { mime: string | null; filename: string | null }) {
  const cls = "size-3.5 shrink-0";
  const ext = (filename?.split(".").pop() ?? "").toLowerCase();
  if (mime?.startsWith("image/")) return <FileImage className={`${cls} text-emerald-500`} />;
  if (mime === "application/pdf" || ext === "pdf") return <FileText className={`${cls} text-red-500`} />;
  if (
    mime?.includes("spreadsheet") ||
    mime?.includes("excel") ||
    ext === "xlsx" || ext === "xls" || ext === "csv"
  ) {
    return <FileSpreadsheet className={`${cls} text-green-600`} />;
  }
  if (
    mime?.includes("word") ||
    ext === "docx" || ext === "doc"
  ) {
    return <FileText className={`${cls} text-blue-500`} />;
  }
  return <FileType className={`${cls} text-muted-foreground`} />;
}
