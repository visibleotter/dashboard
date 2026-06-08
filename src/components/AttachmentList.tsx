import { useEffect, useRef, useState } from "react";
import { FileText, FileSpreadsheet, FileType, FileImage, Link as LinkIcon, Paperclip, Plus, Trash2, X } from "lucide-react";
import {
  createAttachmentLink,
  deleteAttachment,
  getAttachmentUrl,
  listAttachments,
  uploadAttachment,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

  // Inline "+ Link" form state
  const [linkForm, setLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  // Confirm-delete dialog state
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteAttachment(pendingDelete);
      setItems((prev) => prev?.filter((x) => x.id !== pendingDelete.id) ?? null);
      setPendingDelete(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleOpen(a: Attachment) {
    try {
      // Link row: open the external URL directly. File row: fetch a signed URL.
      const url = a.external_url ?? (a.storage_path ? await getAttachmentUrl(a.storage_path) : null);
      if (!url) throw new Error("Attachment has no target");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setSavingLink(true);
    setError(null);
    try {
      await createAttachmentLink(entityType, entityId, linkUrl.trim(), linkLabel.trim() || null);
      setLinkUrl(""); setLinkLabel(""); setLinkForm(false);
      setItems(await listAttachments(entityType, entityId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingLink(false);
    }
  }

  const count = items?.length ?? 0;

  // Compact chip — toggles the expanded list
  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("attachments.title")}
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground hover:bg-gray-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Plus /> {uploading ? t("attachments.uploading") : t("attachments.add")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLinkForm((v) => !v)}
          >
            <LinkIcon /> {t("attachments.addLink")}
          </Button>
          {compact && (
            <IconButton
              onClick={() => setOpen(false)}
              size="sm"
              title={t("common.cancel")}
              aria-label={t("common.cancel")}
            >
              <X />
            </IconButton>
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

      {/* Inline + Link form */}
      {linkForm && (
        <form onSubmit={handleAddLink} className="flex flex-wrap items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1.5">
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={t("attachments.linkUrlPlaceholder")}
            dir="ltr"
            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            required
          />
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder={t("attachments.linkLabelPlaceholder")}
            className="w-32 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <Button type="submit" size="sm" disabled={savingLink || !linkUrl.trim()}>
            {savingLink ? "…" : t("common.add")}
          </Button>
          <IconButton
            size="sm"
            onClick={() => { setLinkForm(false); setLinkUrl(""); setLinkLabel(""); }}
            aria-label={t("common.cancel")}
          >
            <X />
          </IconButton>
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {items === null ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("attachments.empty")}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((a) => {
            const isLink = !!a.external_url;
            const display = a.original_filename
              ?? (isLink ? hostOf(a.external_url!) : a.storage_path?.split("/").pop() ?? "—");
            return (
              <li key={a.id} className="group flex items-center gap-2 text-xs">
                {isLink ? (
                  <LinkIcon className="size-3.5 shrink-0 text-blue-500" />
                ) : (
                  <FileIcon mime={a.mime_type} filename={a.original_filename} />
                )}
                <button
                  type="button"
                  onClick={() => handleOpen(a)}
                  className="min-w-0 flex-1 truncate text-start text-primary hover:underline"
                  title={isLink ? (a.external_url ?? "") : (a.original_filename ?? "")}
                >
                  {display}
                </button>
                <span className="shrink-0 text-muted-foreground" dir="ltr">
                  {formatDate(a.uploaded_at, lang)}
                </span>
                <IconButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setPendingDelete(a)}
                  title={t("attachments.deleteConfirm")}
                  aria-label={t("attachments.deleteConfirm")}
                  className="hidden group-hover:inline-flex"
                >
                  <Trash2 />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("attachments.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
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

/** "drive.google.com/…" → "drive.google.com" — short display label for a URL. */
function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); }
  catch { return url; }
}
