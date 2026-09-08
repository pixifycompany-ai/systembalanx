import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Desktop: centralizado, cantos arredondados
        // Mobile (<md): bottom sheet com handle, slide de baixo p/ cima
        "fixed z-50 grid gap-4 border border-border bg-surface shadow-xl duration-200 overflow-y-auto",
        // Mobile bottom sheet
        "inset-x-0 bottom-0 w-full max-h-[92vh] rounded-t-3xl pt-5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // Desktop overrides
        "md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] md:w-[calc(100vw-1.5rem)] md:max-w-[760px] md:rounded-xl md:p-6 md:max-h-[calc(100vh-2rem)] md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-top-[48%] md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    >
      {/* Handle visual estilo iOS — só no mobile */}
      <div className="md:hidden absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border" aria-hidden />
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 md:right-4 md:top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 md:bg-transparent text-foreground-muted opacity-80 transition-opacity hover:opacity-100 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-h3 leading-none", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-foreground-muted", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
