import { useEffect, useRef, useState } from "react";
import {
  deleteDocument,
  getDocumentUrl,
  listDocuments,
  updateDocumentFields,
  updateDocumentType,
  uploadDocument,
  type DocumentFields,
} from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { ALL_DOC_TYPES, docTypeLabel } from "@/lib/labels";
import { DOC_ALTERNATIVES } from "@/lib/completeness";
import type { DocType, DocumentRow, ExtractionStatus } from "@/types/db";
import { Check, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const CURRENCIES = ["ILS", "USD", "CNY", "EUR"];

const statusBadgeCls: Record<ExtractionStatus, string> = {
  pending: "bg-white/10 text-neutral-300 ring-1 ring-white/15",
  extracted: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25",
  confirmed: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25",
};
const statusKey: Record<ExtractionStatus, string> = {
  pending: "documents.statusPending",
  extracted: "documents.statusExtracted",
  confirmed: "documents.statusConfirmed",
};

/** A required doc-type slot is satisfied if a doc of that type — or an accepted alternative — exists. */
function findForSlot(docs: DocumentRow[], dt: DocType): DocumentRow | undefined {
  const alts = DOC_ALTERNATIVES[dt] ?? [];
  return docs.find((d) => d.doc_type === dt || alts.includes(d.doc_type));
}

/* Attach files to a case: required-doc slots + upload into the private bucket + per-document fields. */
export function DocumentsSection({
  caseId,
  expectedDocs = [],
}: {
  caseId: string;
  expectedDocs?: DocType[];
}) {
  const { t, tl } = useI18n();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [docType, setDocType] = useState<DocType>("tax_invoice");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const pendingSlotType = useRef<DocType | null>(null);

  useEffect(() => {
    listDocuments(caseId).then(setDocs).catch((e) => setError(e.message));
  }, [caseId]);

  async function handleUpload() {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await uploadDocument(caseId, file, docType);
      setDocs(await listDocuments(caseId));
      setFiles(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function pickForSlot(dt: DocType) {
    pendingSlotType.current = dt;
    slotInput.current?.click();
  }

  async function onSlotFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    const dt = pendingSlotType.current;
    if (!picked || picked.length === 0 || !dt) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(picked)) await uploadDocument(caseId, file, dt);
      setDocs(await listDocuments(caseId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      pendingSlotType.current = null;
      if (slotInput.current) slotInput.current.value = "";
    }
  }

  const presentCount = expectedDocs.filter((dt) => findForSlot(docs, dt)).length;

  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t("documents.title")} ({docs.length})
      </h2>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* hidden input shared by all slot upload buttons */}
      <input
        ref={slotInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onSlotFile}
      />

      {/* Required-document slots (checklist for this case type) */}
      {expectedDocs.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {t("documents.required")} · {presentCount}/{expectedDocs.length}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {expectedDocs.map((dt) => {
              const present = findForSlot(docs, dt);
              return (
                <div
                  key={dt}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                    present
                      ? "border-emerald-400/25 bg-emerald-500/10"
                      : "border-dashed border-white/15 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full ${
                        present ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-muted-foreground"
                      }`}
                    >
                      {present ? <Check className="size-3.5" /> : <span className="text-xs">?</span>}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{tl(docTypeLabel[dt])}</div>
                      {present && (
                        <div className="truncate text-xs text-muted-foreground" dir="ltr">
                          {present.original_filename ?? ""}
                          {present.doc_type !== dt ? ` (${tl(docTypeLabel[present.doc_type])})` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  {present ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          window.open(await getDocumentUrl(present.storage_path), "_blank", "noopener,noreferrer");
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      {t("common.view")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => pickForSlot(dt)}
                    >
                      <UploadIcon className="size-4" />
                      {t("documents.upload")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="doc-files">{t("documents.files")}</Label>
          <input
            id="doc-files"
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setFiles(e.target.files)}
            className="text-sm file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="doc-type">{t("documents.type")}</Label>
          <Select
            id="doc-type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
            className="sm:w-52"
          >
            {ALL_DOC_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {tl(docTypeLabel[dt])}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" onClick={handleUpload} disabled={uploading || !files?.length}>
          {uploading ? t("documents.uploading") : t("documents.upload")}
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("documents.none")}</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <DocumentItem
              key={d.id}
              doc={d}
              onChanged={(u) => setDocs((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={(id) => setDocs((prev) => prev.filter((x) => x.id !== id))}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentItem({
  doc,
  onChanged,
  onDeleted,
  onError,
}: {
  doc: DocumentRow;
  onChanged: (d: DocumentRow) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const { t, tl, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<DocumentFields>(() => fieldsOf(doc));

  useEffect(() => setF(fieldsOf(doc)), [doc]);

  function set<K extends keyof DocumentFields>(key: K, value: DocumentFields[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRetype(next: DocType) {
    onChanged({ ...doc, doc_type: next });
    try {
      await updateDocumentType(doc.id, next);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function handleView() {
    try {
      window.open(await getDocumentUrl(doc.storage_path), "_blank", "noopener,noreferrer");
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("documents.deleteConfirm", { name: doc.original_filename ?? t("documents.theDocument") })))
      return;
    try {
      await deleteDocument(doc);
      onDeleted(doc.id);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function handleSave() {
    setSaving(true);
    onError("");
    try {
      const updated = await updateDocumentFields(doc.id, normalize(f));
      onChanged(updated);
      setOpen(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" dir="ltr">
            {doc.original_filename ?? doc.storage_path}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(doc.uploaded_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB")}</span>
            <Badge className={statusBadgeCls[doc.extraction_status]}>{t(statusKey[doc.extraction_status])}</Badge>
          </div>
        </div>
        <Select
          value={doc.doc_type}
          onChange={(e) => handleRetype(e.target.value as DocType)}
          className="w-44"
        >
          {ALL_DOC_TYPES.map((dt) => (
            <option key={dt} value={dt}>
              {tl(docTypeLabel[dt])}
            </option>
          ))}
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? t("documents.close") : t("documents.fields")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleView}>
          {t("common.view")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleDelete}>
          {t("common.delete")}
        </Button>
      </div>

      {open && (
        <div className="border-t px-4 py-4">
          <p className="mb-3 text-xs text-muted-foreground">{t("documents.fieldsHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label={t("documents.docNumber")}>
              <Input dir="ltr" value={f.doc_number ?? ""} onChange={(e) => set("doc_number", e.target.value || null)} />
            </FieldRow>
            <FieldRow label={t("documents.date")}>
              <Input type="date" value={f.doc_date ?? ""} onChange={(e) => set("doc_date", e.target.value || null)} />
            </FieldRow>
            <FieldRow label={t("documents.tracking")}>
              <Input dir="ltr" value={f.tracking_number ?? ""} onChange={(e) => set("tracking_number", e.target.value || null)} />
            </FieldRow>
            <FieldRow label={t("documents.rashimon")}>
              <Input dir="ltr" value={f.rashimon_number ?? ""} onChange={(e) => set("rashimon_number", e.target.value || null)} />
            </FieldRow>
            <FieldRow label={t("documents.amount")}>
              <Input
                type="number"
                step="0.01"
                dir="ltr"
                value={f.amount ?? ""}
                onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
              />
            </FieldRow>
            <FieldRow label={t("documents.currency")}>
              <Select value={f.currency ?? ""} onChange={(e) => set("currency", e.target.value || null)}>
                <option value="">—</option>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FieldRow>
            <FieldRow label={t("documents.counterpartyName")} className="sm:col-span-2">
              <Input value={f.counterparty_name ?? ""} onChange={(e) => set("counterparty_name", e.target.value || null)} />
            </FieldRow>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setF(fieldsOf(doc));
                setOpen(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function fieldsOf(d: DocumentRow): DocumentFields {
  return {
    doc_number: d.doc_number,
    tracking_number: d.tracking_number,
    rashimon_number: d.rashimon_number,
    amount: d.amount,
    currency: d.currency,
    doc_date: d.doc_date,
    counterparty_name: d.counterparty_name,
  };
}

/** Trim empty strings to null so blanks stay blank rather than guessed (brief §5). */
function normalize(f: DocumentFields): DocumentFields {
  const tr = (s: string | null) => (s && s.trim() !== "" ? s.trim() : null);
  return {
    doc_number: tr(f.doc_number),
    tracking_number: tr(f.tracking_number),
    rashimon_number: tr(f.rashimon_number),
    amount: f.amount,
    currency: tr(f.currency),
    doc_date: tr(f.doc_date),
    counterparty_name: tr(f.counterparty_name),
  };
}
