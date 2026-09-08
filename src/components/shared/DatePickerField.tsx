import { useEffect, useState } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Helper: apply date mask dd/mm/aaaa
function applyDateMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateInput(masked: string): string | null {
  const parts = masked.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy || dd > 31 || mm > 12 || yyyy < 1900) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

interface DatePickerFieldProps {
  /** Label displayed above the field */
  label: string;
  /** ISO date string (yyyy-MM-dd) */
  value: string | undefined;
  /** Callback with ISO date string */
  onChange: (date: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Custom className for the wrapper */
  className?: string;
  /** Show quick date buttons (Hoje/Ontem) */
  showQuickButtons?: boolean;
}

export function DatePickerField({
  label,
  value,
  onChange,
  required,
  className,
  showQuickButtons = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [textValue, setTextValue] = useState(value ? format(parseISO(value), 'dd/MM/yyyy') : '');
  const dateValue = value ? parseISO(value) : undefined;

  // Sincroniza o input quando o `value` muda externamente (Hoje/Ontem, calendário, set programático)
  useEffect(() => {
    setTextValue(value ? format(parseISO(value), 'dd/MM/yyyy') : '');
  }, [value]);

  const handleTextChange = (raw: string) => {
    const masked = applyDateMask(raw);
    setTextValue(masked);
    if (masked.length === 10) {
      const iso = parseDateInput(masked);
      if (iso) onChange(iso);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const iso = format(date, 'yyyy-MM-dd');
      onChange(iso);
      setTextValue(format(date, 'dd/MM/yyyy'));
      setOpen(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}{required && ' *'}</Label>
        {showQuickButtons && (
          <QuickDateButtons onSelect={(d) => onChange(d)} />
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="dd/mm/aaaa"
          value={textValue}
          onChange={(e) => handleTextChange(e.target.value)}
          className="flex-1"
          maxLength={10}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" type="button" className="shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleCalendarSelect}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/** Quick date buttons - Hoje / Ontem */
export function QuickDateButtons({ onSelect }: { onSelect: (date: string) => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => onSelect(today)} className="text-xs h-6 px-2">
        Hoje
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => onSelect(yesterday)} className="text-xs h-6 px-2">
        Ontem
      </Button>
    </div>
  );
}
