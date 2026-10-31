import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        // Backwards-compatible alias for shadcn defaults
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-surface text-foreground hover:bg-surface-2 border border-border",
        ghost: "text-foreground-muted hover:bg-surface-2 hover:text-foreground",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-2",
        // No escuro o vermelho é claro: texto navy pra manter contraste
        danger: "bg-danger text-white hover:bg-danger/90 dark:text-[hsl(224_55%_10%)]",
        destructive: "bg-danger text-white hover:bg-danger/90 dark:text-[hsl(224_55%_10%)]",
        "danger-ghost": "text-danger hover:bg-danger-bg",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-4",
        default: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
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
