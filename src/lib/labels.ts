import type {
  CaseGroup,
  CaseStatus,
  CounterpartyKind,
  DocType,
  TaskPriority,
} from "@/types/db";

/*
  Lightweight bilingual display labels. This is NOT the i18n layer (that's Phase 8 with
  he.json/en.json + a language toggle) — it's a minimal HE/EN label map so Phase 3 screens
  read clearly. Hebrew is primary. case_type names come from the DB (name_he/name_en), not here.
*/

export const GROUP_ORDER: CaseGroup[] = [
  "import",
  "sale_service",
  "procurement",
  "project",
  "tax",
];

export const groupLabel: Record<CaseGroup, { he: string; en: string }> = {
  import: { he: "ייבוא", en: "Import" },
  sale_service: { he: "מכירות ושירות", en: "Sales & Service" },
  procurement: { he: "רכש מקומי", en: "Procurement" },
  project: { he: "פרויקטים", en: "Projects" },
  tax: { he: "מסים ורגולציה", en: "Tax & Regulatory" },
};

export const statusLabel: Record<CaseStatus, { he: string; en: string }> = {
  complete: { he: "שלם", en: "Complete" },
  incomplete: { he: "חסר", en: "Incomplete" },
  attention: { he: "דורש טיפול", en: "Attention" },
  in_transit: { he: "בהעברה", en: "In transit" },
  closed: { he: "סגור", en: "Closed" },
};

/** Tailwind classes for the status badge, by status (dark glass theme). */
export const statusBadgeClass: Record<CaseStatus, string> = {
  complete: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25",
  incomplete: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25",
  attention: "bg-red-500/15 text-red-300 ring-1 ring-red-400/25",
  in_transit: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/25",
  closed: "bg-white/10 text-neutral-300 ring-1 ring-white/15",
};

export const counterpartyKindLabel: Record<CounterpartyKind, { he: string; en: string }> = {
  supplier: { he: "ספק", en: "Supplier" },
  carrier: { he: "מוביל", en: "Carrier" },
  client: { he: "לקוח", en: "Client" },
  authority: { he: "רשות", en: "Authority" },
};

export const ALL_STATUSES: CaseStatus[] = [
  "incomplete",
  "complete",
  "attention",
  "in_transit",
  "closed",
];

export const ALL_COUNTERPARTY_KINDS: CounterpartyKind[] = [
  "supplier",
  "carrier",
  "client",
  "authority",
];

// Document types (brief §3/§4). Order roughly follows the document lifecycle.
export const docTypeLabel: Record<DocType, { he: string; en: string }> = {
  commercial_invoice: { he: "חשבונית מסחרית", en: "Commercial invoice" },
  proforma_invoice: { he: "חשבונית פרופורמה", en: "Proforma invoice" },
  packing_list: { he: "רשימת אריזה", en: "Packing list" },
  rashimon: { he: "רשימון יבוא", en: "Rashimon (import decl.)" },
  carrier_receipt: { he: "קבלת מוביל", en: "Carrier receipt" },
  customs_voucher_184: { he: "שובר 184", en: "Customs voucher 184" },
  delivery_note: { he: "תעודת משלוח", en: "Delivery note" },
  tax_invoice: { he: "חשבונית מס", en: "Tax invoice" },
  receipt: { he: "קבלה", en: "Receipt" },
  credit_note: { he: "חשבונית זיכוי", en: "Credit note" },
  quote: { he: "הצעת מחיר", en: "Quote" },
  purchase_order: { he: "הזמנת רכש", en: "Purchase order" },
  vendor_onboarding: { he: "פתיחת ספק", en: "Vendor onboarding" },
  tax_withholding_cert: { he: "אישור ניכוי מס במקור", en: "Tax withholding cert." },
  form_101: { he: "טופס 101", en: "Form 101" },
};

export const taskPriorityLabel: Record<TaskPriority, { he: string; en: string; cls: string }> = {
  high: { he: "גבוהה", en: "High", cls: "bg-red-500/15 text-red-300 ring-1 ring-red-400/25" },
  med: { he: "בינונית", en: "Medium", cls: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25" },
  low: { he: "נמוכה", en: "Low", cls: "bg-white/10 text-neutral-300 ring-1 ring-white/15" },
};

export const ALL_TASK_PRIORITIES: TaskPriority[] = ["high", "med", "low"];

export const ALL_DOC_TYPES: DocType[] = [
  "commercial_invoice",
  "proforma_invoice",
  "packing_list",
  "rashimon",
  "carrier_receipt",
  "customs_voucher_184",
  "delivery_note",
  "tax_invoice",
  "receipt",
  "credit_note",
  "quote",
  "purchase_order",
  "vendor_onboarding",
  "tax_withholding_cert",
  "form_101",
];
