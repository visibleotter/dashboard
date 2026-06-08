import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/*
  Lightweight confirmation modal — replaces `window.confirm()` everywhere.
  Controlled by an `open` boolean from the parent. ESC and scrim click close.
  Focus is moved to the destructive button on open.
*/
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Whether the confirm action is destructive (red button). Default: true. */
  destructive?: boolean;
  /** Disable controls (e.g. while the action is in-flight). */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => !busy && onCancel()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-5 shadow-card"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-foreground">{title}</h2>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
