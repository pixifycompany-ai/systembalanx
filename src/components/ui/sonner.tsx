import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:rounded-lg group-[.toaster]:max-w-[380px]",
          description: "group-[.toast]:text-foreground-muted",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-surface-2 group-[.toast]:text-foreground-muted",
          success: "group-[.toaster]:!bg-success-bg group-[.toaster]:!text-success-fg group-[.toaster]:!border-success/20",
          error: "group-[.toaster]:!bg-danger-bg group-[.toaster]:!text-danger-fg group-[.toaster]:!border-danger/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
