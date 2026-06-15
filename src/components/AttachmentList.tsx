import { useEffect, useRef, useState } from "react";
import { FileText, FileSpreadsheet, FileType, FileImage, Link as LinkIcon, Plus, X } from "lucide-react";
import {
  createAttachmentLink,
  deleteAttachment,
  getAttachmentUrl,
  listAttachments,
  uploadAttachment,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Attachment, AttachmentEntityType } from "@/types/db";

/**
 * Inline files list for tasks / orders. Self-contained: fetches its own list,
 * refreshes after upload/delete.
 *
 * Compact mode (default for inline use): files render as small chips ALWAYS
 * visible — no click-to-expand. Add controls live at the end of the chip row:
 * a primary "+" icon button (file picker) and a link-icon button (URL form).
 *
 * Non-compact: full-width panel with a heading and a vertical list.
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
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Attachment[] | null>(null);
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
      const url = a.external_url ?? (a.storage_path ? await getAttachmentUrl(a.storage_path) : null);
      if (!url) throw new Error("Attachment has no target");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
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

  const items_ = items ?? [];

  if (compact) {
    return (
      <div
        className="inline-flex flex-wrap items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {items_.map((a) => (
          <FileChip key={a.id} a={a} onOpen={handleOpen} onDelete={(x) => setPendingDelete(x)} />
        ))}
        <IconButton
          variant="primary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title={t("attachments.add")}
          aria-label={t("attachments.add")}
        >
          <Plus />
        </IconButton>
        <IconButton
          variant="default"
          size="sm"
          onClick={() => setLinkForm((v) => !v)}
          title={t("attachments.addLink")}
          aria-label={t("attachments.addLink")}
        >
          <LinkIcon />
        </IconButton>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {linkForm && (
          <LinkForm
            url={linkUrl}
            setUrl={setLinkUrl}
            label={linkLabel}
            setLabel={setLinkLabel}
            saving={savingLink}
            onSubmit={handleAddLink}
            onCancel={() => { setLinkForm(false); setLinkUrl(""); setLinkLabel(""); }}
            t={t}
          />
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}

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

  // Full (non-compact) panel
  return (
    <div className="space-y-2 rounded-md border bg-gray-50/60 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t("attachments.title")} {items_.length > 0 && `(${items_.length})`}
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

      {linkForm && (
        <LinkForm
          url={linkUrl}
          setUrl={setLinkUrl}
          label={linkLabel}
          setLabel={setLinkLabel}
          saving={savingLink}
          onSubmit={handleAddLink}
          onCancel={() => { setLinkForm(false); setLinkUrl(""); setLinkLabel(""); }}
          t={t}
        />
      )}

      {items === null ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("attachments.empty")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((a) => (
            <FileChip key={a.id} a={a} onOpen={handleOpen} onDelete={(x) => setPendingDelete(x)} />
          ))}
        </div>
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

// ── File chip (file or link) — always visible ──────────────────────────────

function FileChip({
  a,
  onOpen,
  onDelete,
}: {
  a: Attachment;
  onOpen: (a: Attachment) => void;
  onDelete: (a: Attachment) => void;
}) {
  const isLink = !!a.external_url;
  const display = a.original_filename
    ?? (isLink ? hostOf(a.external_url!) : a.storage_path?.split("/").pop() ?? "—");

  return (
    <span className="group inline-flex max-w-[200px] items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs">
      {isLink ? (
        <LinkIcon className="size-3 shrink-0 text-blue-500" />
      ) : (
        <FileIcon mime={a.mime_type} filename={a.original_filename} />
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(a); }}
        className="min-w-0 truncate text-start text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded"
        title={isLink ? (a.external_url ?? "") : (a.original_filename ?? "")}
      >
        {display}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(a); }}
        className="hidden text-muted-foreground hover:text-red-500 group-hover:inline-flex"
        title="Delete"
        aria-label="Delete"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// ── Inline + Link form ─────────────────────────────────────────────────────

function LinkForm({
  url,
  setUrl,
  label,
  setLabel,
  saving,
  onSubmit,
  onCancel,
  t,
}: {
  url: string;
  setUrl: (v: string) => void;
  label: string;
  setLabel: (v: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1"
    >
      <input
        autoFocus
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("attachments.linkUrlPlaceholder")}
        dir="ltr"
        className="min-w-[12rem] flex-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        required
      />
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("attachments.linkLabelPlaceholder")}
        className="w-28 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
      />
      <Button type="submit" size="sm" disabled={saving || !url.trim()}>
        {saving ? "…" : t("common.add")}
      </Button>
      <IconButton size="sm" onClick={onCancel} aria-label={t("common.cancel")}>
        <X />
      </IconButton>
    </form>
  );
}

// ── shared file-type icon ──────────────────────────────────────────────────

export function FileIcon({ mime, filename }: { mime: string | null; filename: string | null }) {
  const cls = "size-3 shrink-0";
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

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); }
  catch { return url; }
}
