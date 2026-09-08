import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        // Backwards-compatible alias for shadcn defaults
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-surface-2 text-foreground hover:bg-surface-3 border border-border",
        ghost: "text-foreground-muted hover:bg-surface-2 hover:text-foreground",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-2",
        danger: "bg-danger text-white hover:bg-danger/90",
        destructive: "bg-danger text-white hover:bg-danger/90",
        "danger-ghost": "text-danger hover:bg-danger-bg",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-sm",
        md: "h-9 px-3.5",
        default: "h-9 px-3.5",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
