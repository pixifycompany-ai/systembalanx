import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-2 text-foreground-muted",
        secondary: "border-border bg-surface-2 text-foreground-muted",
        success: "border-transparent bg-success-bg text-success-fg",
        danger: "border-transparent bg-danger-bg text-danger-fg",
        destructive: "border-transparent bg-danger-bg text-danger-fg",
        warning: "border-transparent bg-warning-bg text-warning-fg",
        info: "border-transparent bg-info-bg text-info-fg",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Show a leading colored dot */
  dot?: boolean;
}

const dotColorMap: Record<string, string> = {
  success: "bg-success",
  danger: "bg-danger",
  destructive: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  default: "bg-foreground-subtle",
  secondary: "bg-foreground-subtle",
  outline: "bg-foreground-subtle",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => {
    const dotClass = dotColorMap[variant ?? "default"] ?? "bg-foreground-subtle";
    return (
      <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
        {dot && <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden />}
        {children}
      </div>
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
