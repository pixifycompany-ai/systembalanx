import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusOption {
  value: string;
  label: string;
}

interface MultiStatusFilterProps {
  options: StatusOption[];
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiStatusFilter({
  options,
  selectedStatuses,
  onChange,
  placeholder = 'Status',
  className,
}: MultiStatusFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (value: string) => {
    if (selectedStatuses.includes(value)) {
      onChange(selectedStatuses.filter(s => s !== value));
    } else {
      onChange([...selectedStatuses, value]);
    }
  };

  const handleSelectAll = () => {
    if (selectedStatuses.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const displayText = selectedStatuses.length === 0
    ? placeholder
    : selectedStatuses.length === options.length
    ? 'Todos os status'
    : `${placeholder} (${selectedStatuses.length})`;

  const hasSelection = selectedStatuses.length > 0 && selectedStatuses.length < options.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between min-w-[160px]",
            hasSelection && "border-primary",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {hasSelection && <Filter className="h-3.5 w-3.5 text-primary" />}
            <span className={cn(hasSelection && "text-primary font-medium")}>
              {displayText}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2 space-y-1">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
              onClick={() => handleToggle(option.value)}
            >
              <Checkbox
                id={option.value}
                checked={selectedStatuses.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <label
                htmlFor={option.value}
                className="text-sm font-medium leading-none cursor-pointer flex-1"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
        <div className="border-t p-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleSelectAll}
          >
            {selectedStatuses.length === options.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
          {selectedStatuses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={handleClear}
            >
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
