import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-2", className)}
      style={{ animationDuration: "1.5s" }}
      {...props}
    />
  );
}

export { Skeleton };
