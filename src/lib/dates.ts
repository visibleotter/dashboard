/*
  Date + urgency helpers for the calendar, milestones, tasks, and timeline (Phase 7).
  All dates are stored as `YYYY-MM-DD` (Postgres `date`); compared at local midnight so
  "today" matches the user's calendar day.
*/

export type Urgency = "overdue" | "today" | "soon" | "upcoming" | "later";

function atLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today to `dateStr` (negative = past). */
export function daysUntil(dateStr: string, now = new Date()): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const ms = atLocalMidnight(target).getTime() - atLocalMidnight(now).getTime();
  return Math.round(ms / 86_400_000);
}

export function urgencyOf(dateStr: string, now = new Date()): Urgency {
  const n = daysUntil(dateStr, now);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n <= 7) return "soon";
  if (n <= 30) return "upcoming";
  return "later";
}

export const URGENCY_ORDER: Urgency[] = ["overdue", "today", "soon", "upcoming", "later"];

export const urgencyMeta: Record<Urgency, { he: string; en: string; cls: string; dot: string }> = {
  overdue: { he: "באיחור", en: "Overdue", cls: "bg-red-50 text-red-700 ring-1 ring-red-200", dot: "bg-red-500" },
  today: { he: "היום", en: "Today", cls: "bg-orange-50 text-orange-700 ring-1 ring-orange-200", dot: "bg-orange-500" },
  soon: { he: "השבוע", en: "This week", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-500" },
  upcoming: { he: "החודש", en: "This month", cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200", dot: "bg-sky-500" },
  later: { he: "בהמשך", en: "Later", cls: "bg-gray-100 text-gray-600 ring-1 ring-gray-200", dot: "bg-gray-400" },
};

export type Lang = "he" | "en";

export function formatDate(dateStr: string | null, lang: Lang = "he"): string {
  if (!dateStr) return "—";
  // Accept both YYYY-MM-DD and full ISO timestamps (e.g. uploaded_at).
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString(
    lang === "he" ? "he-IL" : "en-GB",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}

/** Relative phrase, e.g. "overdue by 3 days" / "in 5 days" / "today". */
export function relativeDays(dateStr: string, lang: Lang = "he", now = new Date()): string {
  const n = daysUntil(dateStr, now);
  const he = () => {
    if (n === 0) return "היום";
    if (n === 1) return "מחר";
    if (n === -1) return "אתמול";
    if (n < 0) return `באיחור ${Math.abs(n)} ימים`;
    return `בעוד ${n} ימים`;
  };
  const en = () => {
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    if (n === -1) return "yesterday";
    if (n < 0) return `overdue by ${Math.abs(n)} days`;
    return `in ${n} days`;
  };
  return lang === "he" ? he() : en();
}
