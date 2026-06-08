/*
  Hand-written TypeScript types mirroring the Postgres schema
  (supabase/migrations/0001_schema.sql). Keep this file in sync with the schema as it
  evolves; once the project is provisioned it can be regenerated with the Supabase CLI
  (`supabase gen types typescript`) to replace these by hand.
*/

// ---- Enums (mirror the Postgres enum types) ----

export type CaseGroup =
  | "import"
  | "sale_service"
  | "procurement"
  | "project"
  | "tax";

export type CaseStatus =
  | "complete"
  | "incomplete"
  | "attention"
  | "in_transit"
  | "closed";

export type DocType =
  | "commercial_invoice"
  | "proforma_invoice"
  | "packing_list"
  | "rashimon"
  | "carrier_receipt"
  | "customs_voucher_184"
  | "delivery_note"
  | "tax_invoice"
  | "receipt"
  | "credit_note"
  | "quote"
  | "purchase_order"
  | "vendor_onboarding"
  | "tax_withholding_cert"
  | "form_101"
  | "work_report";

export type ExtractionStatus = "pending" | "extracted" | "confirmed";

export type WorkStatus =
  | "planned"
  | "in_progress"
  | "on_hold"
  | "robot_on_way"
  | "done";

export type TaskPriority = "high" | "med" | "low";

export type CounterpartyKind = "supplier" | "carrier" | "client" | "authority";

// ---- Row shapes ----
// NB: these are `type` aliases, not `interface`s, on purpose. The Supabase typed client
// requires each table's Row/Insert/Update to satisfy `Record<string, unknown>`; an
// `interface` has no implicit index signature and would fail that constraint, silently
// degrading the client's schema to `never` (insert/update args become `never[]`).

export type CaseType = {
  id: string;
  key: string;
  group: CaseGroup;
  name_he: string;
  name_en: string;
  /** Array of DocType keys that make a "complete" case. */
  expected_documents: DocType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Counterparty = {
  id: string;
  name: string;
  kind: CounterpartyKind;
  country: string | null;
  tax_id: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Case = {
  id: string;
  case_type_id: string;
  parent_id: string | null;
  title: string;
  counterparty_id: string | null;
  status: CaseStatus;
  work_status: WorkStatus;
  currency: string | null;
  total_amount: number | null;
  start_date: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentRow = {
  id: string;
  case_id: string;
  doc_type: DocType;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  uploaded_at: string;
  // Extracted fields — all nullable, populated by AI, confirmed by a human.
  doc_number: string | null;
  tracking_number: string | null;
  rashimon_number: string | null;
  amount: number | null;
  currency: string | null;
  doc_date: string | null;
  counterparty_name: string | null;
  extraction_status: ExtractionStatus;
  /** The model's full structured output, kept for audit. */
  extraction_raw: Record<string, unknown> | null;
}

export type PaymentMilestone = {
  id: string;
  case_id: string;
  label: string;
  percent: number | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  paid: boolean;
  paid_at: string | null;
}

export type TaskRow = {
  id: string;
  case_id: string | null;
  text: string;
  priority: TaskPriority;
  due_date: string | null;
  done: boolean;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Project spend chain (0005): people, work_items, orders ----

export type Person = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  active: boolean;
  is_employee: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ---- Accounting (0006): payslips, tax certs, expenses, operating costs ----

export type Payslip = {
  id: string;
  person_id: string;
  year: number;
  month: number;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  received: boolean;
  amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxCert = {
  id: string;
  kind: string;
  year: number | null;
  valid_from: string | null;
  valid_to: string | null;
  rate: number | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  expense_date: string | null;
  category: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  rivhit_uploaded: boolean;
  rivhit_uploaded_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpCostCategory = {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  created_at: string;
};

// ---- Attachments (0011): polymorphic file storage for tasks and orders ----

export type AttachmentEntityType = "task" | "order";

export type Attachment = {
  id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  /** Set when the attachment is an uploaded file. Mutually exclusive with external_url (XOR enforced by DB). */
  storage_path: string | null;
  /** Set when the attachment is an external link (Google Drive, etc.). Mutually exclusive with storage_path. */
  external_url: string | null;
  /** For files: the original filename. For links: a human-friendly label (falls back to the URL). */
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
};

// ---- Payments (0010): cash-flow mirror from owner's Google Sheet ----

export type PaymentDirection = "income" | "outcome";
export type PaymentStatus = "paid" | "not_paid";

export type Payment = {
  id: string;
  sheet_row_hash: string;
  sheet_row_num: number | null;
  date_opened: string | null;
  due_date: string | null;
  payment_received: string | null;
  invoice_number: string | null;
  direction: PaymentDirection;
  price_before_vat: number | null;
  price_after_vat: number | null;
  remain: number | null;
  currency: string | null;
  status: PaymentStatus | null;
  info: string | null;
  client_raw: string | null;
  counterparty_id: string | null;
  case_id: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type OpCostEntry = {
  id: string;
  year: number;
  month: number;
  category_id: string;
  amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkItem = {
  id: string;
  case_id: string;
  name: string;
  stage: string | null;
  status: string | null;
  cost: number | null;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  case_id: string;
  work_item_id: string | null;
  supplier_id: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  order_date: string | null;
  status: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ---- Database generic for the typed Supabase client ----
// Minimal shape: Row for selects, Insert (with DB-defaulted fields optional),
// Update (all optional). Expand as needed in later phases.

// Keys whose type includes null — these are nullable columns, optional on insert.
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

// Insert shape: every column optional EXCEPT the NOT-NULL columns without a DB default.
// `Optional` lists the NOT-NULL columns that DO have a default (so they're optional too);
// nullable columns are detected automatically.
type Insertable<T, Optional extends keyof T> = Omit<T, Optional | NullableKeys<T>> &
  Partial<Pick<T, (Optional & keyof T) | NullableKeys<T>>>;

type DefaultCols = "id" | "created_at" | "updated_at";

export interface Database {
  public: {
    Tables: {
      case_types: {
        Row: CaseType;
        Insert: Insertable<CaseType, DefaultCols | "is_active">;
        Update: Partial<CaseType>;
        Relationships: [];
      };
      counterparties: {
        Row: Counterparty;
        Insert: Insertable<Counterparty, DefaultCols>;
        Update: Partial<Counterparty>;
        Relationships: [];
      };
      cases: {
        Row: Case;
        Insert: Insertable<Case, DefaultCols | "status" | "work_status">;
        Update: Partial<Case>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: Insertable<DocumentRow, "id" | "uploaded_at" | "extraction_status">;
        Update: Partial<DocumentRow>;
        Relationships: [];
      };
      payment_milestones: {
        Row: PaymentMilestone;
        Insert: Insertable<PaymentMilestone, "id" | "paid">;
        Update: Partial<PaymentMilestone>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: Insertable<TaskRow, DefaultCols | "priority" | "done">;
        Update: Partial<TaskRow>;
        Relationships: [];
      };
      people: {
        Row: Person;
        Insert: Insertable<Person, DefaultCols | "active" | "is_employee">;
        Update: Partial<Person>;
        Relationships: [];
      };
      work_items: {
        Row: WorkItem;
        Insert: Insertable<WorkItem, DefaultCols>;
        Update: Partial<WorkItem>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Insertable<OrderRow, DefaultCols | "currency">;
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      payslips: {
        Row: Payslip;
        Insert: Insertable<Payslip, DefaultCols | "received">;
        Update: Partial<Payslip>;
        Relationships: [];
      };
      tax_certs: {
        Row: TaxCert;
        Insert: Insertable<TaxCert, DefaultCols | "kind">;
        Update: Partial<TaxCert>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: Insertable<Expense, DefaultCols | "currency" | "rivhit_uploaded">;
        Update: Partial<Expense>;
        Relationships: [];
      };
      op_cost_categories: {
        Row: OpCostCategory;
        Insert: Insertable<OpCostCategory, "id" | "created_at" | "sort" | "active">;
        Update: Partial<OpCostCategory>;
        Relationships: [];
      };
      op_cost_entries: {
        Row: OpCostEntry;
        Insert: Insertable<OpCostEntry, DefaultCols>;
        Update: Partial<OpCostEntry>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Insertable<Payment, DefaultCols | "synced_at" | "currency">;
        Update: Partial<Payment>;
        Relationships: [];
      };
      attachments: {
        Row: Attachment;
        Insert: Insertable<Attachment, "id" | "uploaded_at" | "uploaded_by">;
        Update: Partial<Attachment>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      case_group: CaseGroup;
      case_status: CaseStatus;
      work_status: WorkStatus;
      doc_type: DocType;
      extraction_status: ExtractionStatus;
      task_priority: TaskPriority;
      counterparty_kind: CounterpartyKind;
    };
  };
}
