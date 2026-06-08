import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
  Standard icon-only button. Use everywhere a trash / pencil / X / paperclip /
  chevron / external-link button is rendered. Replaces the ad-hoc
  `<button className="text-muted-foreground hover:text-red-500 …">` pattern
  that was duplicated 20+ times across the codebase.

  Variants:
    default     — neutral hover (gray bg, foreground text)
    primary     — primary-tinted hover
    destructive — red-tinted hover (use for trash etc.)

  Sizes are square hit areas to keep optical alignment with adjacent text.
*/
const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-gray-100 hover:text-foreground",
        primary:
          "text-primary hover:bg-primary/10",
        destructive:
          "text-muted-foreground hover:bg-red-50 hover:text-red-600",
      },
      size: {
        sm: "size-6 [&_svg]:size-3.5",
        default: "size-7 [&_svg]:size-4",
        lg: "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible label — required when the icon alone isn't descriptive. */
  "aria-label"?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";

export { IconButton, iconButtonVariants };
