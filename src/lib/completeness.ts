import type { CaseStatus, DocType } from "@/types/db";
import type { CaseWithDocs } from "@/lib/data";

/*
  Completeness engine (brief §3). A case's completeness compares the doc_types of its
  attached documents against its case_type.expected_documents. Missing types → incomplete,
  and the UI lists exactly which are absent. A parent case aggregates its own documents plus
  its children's completeness.

  Pure functions, no I/O — fed by listCasesWithDocs(). The cases.status column stays a cache;
  the live truth for complete/incomplete is derived here so the dashboard and list always agree.
*/

// Some expected documents can be satisfied by an equivalent (brief §4: import's
// commercial_invoice may be a proforma_invoice). A requirement is met if the required type
// OR any of its alternatives is present.
export const DOC_ALTERNATIVES: Partial<Record<DocType, DocType[]>> = {
  commercial_invoice: ["proforma_invoice"],
};

export interface Completeness {
  expected: DocType[];
  /** Expected types that are satisfied (directly or via an alternative). */
  satisfied: DocType[];
  /** Expected types still missing. */
  missing: DocType[];
  isComplete: boolean;
}

export function computeCompleteness(
  expected: DocType[],
  presentTypes: DocType[],
): Completeness {
  const present = new Set(presentTypes);
  const satisfied: DocType[] = [];
  const missing: DocType[] = [];
  for (const req of expected) {
    const alts = DOC_ALTERNATIVES[req] ?? [];
    if (present.has(req) || alts.some((a) => present.has(a))) satisfied.push(req);
    else missing.push(req);
  }
  return { expected, satisfied, missing, isComplete: missing.length === 0 };
}

/**
 * Effective status for display: explicit human states (attention / in_transit / closed) win;
 * otherwise complete/incomplete is derived from completeness.
 */
export function effectiveStatus(stored: CaseStatus, isComplete: boolean): CaseStatus {
  if (stored === "attention" || stored === "in_transit" || stored === "closed") return stored;
  return isComplete ? "complete" : "incomplete";
}

export interface CaseView {
  case: CaseWithDocs;
  /** This case's own document completeness (ignores children). */
  own: Completeness;
  /** Direct child cases. */
  children: CaseWithDocs[];
  /** Number of children that are not themselves fully complete (own docs). */
  incompleteChildren: number;
  /** Aggregated: own docs complete AND every child complete (brief §3). */
  isCompleteAggregated: boolean;
  /** Status to show, factoring in aggregation + explicit human states. */
  status: CaseStatus;
}

/** Build per-case views with completeness + parent aggregation from a flat fetch. */
export function buildCaseViews(cases: CaseWithDocs[]): CaseView[] {
  const childrenByParent = new Map<string, CaseWithDocs[]>();
  for (const c of cases) {
    if (c.parent_id) {
      const arr = childrenByParent.get(c.parent_id) ?? [];
      arr.push(c);
      childrenByParent.set(c.parent_id, arr);
    }
  }

  const ownCompleteOf = (c: CaseWithDocs): Completeness =>
    computeCompleteness(
      c.case_type?.expected_documents ?? [],
      c.documents.map((d) => d.doc_type),
    );

  return cases.map((c) => {
    const own = ownCompleteOf(c);
    const children = childrenByParent.get(c.id) ?? [];
    const childOwn = children.map(ownCompleteOf);
    const incompleteChildren = childOwn.filter((cc) => !cc.isComplete).length;
    const isCompleteAggregated = own.isComplete && incompleteChildren === 0;
    return {
      case: c,
      own,
      children,
      incompleteChildren,
      isCompleteAggregated,
      status: effectiveStatus(c.status, isCompleteAggregated),
    };
  });
}
