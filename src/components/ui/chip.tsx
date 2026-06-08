import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Standard pill / chip button. Used for filter bars (status, direction, group)
  across DashboardPage, PaymentsPage, CalendarPage. Promotes the inline
  "FilterPill" component that was duplicated in those files.
*/
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Small color dot rendered before the label (e.g. status color). */
  dotClass?: string;
  /** Compact density. */
  small?: boolean;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, dotClass, small, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-active={active ? "" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        small ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        active
          ? "border-primary/30 bg-primary/10 font-semibold text-primary"
          : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {dotClass && <span className={cn("size-2 rounded-full", dotClass)} />}
      {children}
    </button>
  ),
);
Chip.displayName = "Chip";

/** Small count bubble after a chip's label — used by the Dashboard status bar. */
export function ChipCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ms-0.5 rounded-full bg-gray-100 px-1.5 py-0 text-xs font-normal text-muted-foreground">
      {n}
    </span>
  );
}
