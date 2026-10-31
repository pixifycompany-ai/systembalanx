import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Faixa do intervalo (usada pelo DateRangePicker via modifiers rp-*): a célula
// pinta o fundo; meia faixa nas pontas pra emendar no círculo navy.
const RANGE_CELL =
  "[&:has(.rp-mid)]:bg-surface-2 " +
  "[&:has(.rp-band-start)]:bg-[linear-gradient(to_right,transparent_50%,hsl(var(--surface-2))_50%)] " +
  "[&:has(.rp-band-end)]:bg-[linear-gradient(to_left,transparent_50%,hsl(var(--surface-2))_50%)] " +
  "first:[&:has(.rp-mid)]:rounded-l-full last:[&:has(.rp-mid)]:rounded-r-full";

function Calendar({ className, classNames, showOutsideDays = true, locale = ptBR, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-6 sm:flex-row",
        month: "space-y-3",
        caption: "relative flex h-9 items-center justify-center",
        caption_label: "text-[15px] font-semibold capitalize text-foreground",
        nav: "flex items-center",
        nav_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "w-10 text-[12px] font-medium capitalize text-foreground-muted",
        row: "mt-1 flex w-full",
        cell: cn("relative h-10 w-10 p-0 text-center text-sm focus-within:z-20", RANGE_CELL),
        day: "relative inline-flex h-10 w-10 items-center justify-center rounded-full p-0 text-sm font-medium text-foreground transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100",
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        // Selecionado = navy (claro) / claro com texto navy (escuro), igual aos chips
        day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
        // Hoje: pontinho azul embaixo do número
        day_today:
          "font-semibold after:absolute after:bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
        day_outside: "day-outside text-foreground-subtle opacity-60",
        day_disabled: "text-foreground-subtle opacity-40",
        day_range_middle: "aria-selected:bg-surface-2 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
