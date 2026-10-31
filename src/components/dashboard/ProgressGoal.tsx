import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercentage } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';

interface ProgressGoalProps {
  title: string;
  current: number;
  target: number;
  subtitle?: string;
  showPercentage?: boolean;
  className?: string;
  editable?: boolean;
  onEditTarget?: (newTarget: number) => void;
}

export function ProgressGoal({
  title,
  current,
  target,
  subtitle,
  showPercentage = true,
  className,
  editable = false,
  onEditTarget,
}: ProgressGoalProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTarget, setNewTarget] = useState(target.toString());

  // Real percentage for display (no limit)
  const displayPercentage = target > 0 ? (current / target) * 100 : 0;
  // Percentage for progress bar (limited to 100%)
  const barPercentage = Math.min(displayPercentage, 100);
  // Goal reached
  const isComplete = displayPercentage >= 100;
  // Goal exceeded
  const isExceeded = displayPercentage > 100;

  const handleSave = () => {
    const value = parseFloat(newTarget.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(value) && value > 0 && onEditTarget) {
      onEditTarget(value);
      setIsDialogOpen(false);
    }
  };

  const handleOpenDialog = () => {
    setNewTarget(target.toString());
    setIsDialogOpen(true);
  };

  return (
    <>
      <section className={cn('rounded-[20px] border border-border bg-surface p-4 md:rounded-3xl md:p-6', className)}>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-foreground-muted">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showPercentage && (
              <span
                className={cn(
                  'font-heading text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums',
                  isExceeded ? 'text-[hsl(var(--success-fg))]' : 'text-foreground',
                )}
              >
                {isExceeded && '+'}
                {formatPercentage(displayPercentage, 0)}
              </span>
            )}
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleOpenDialog}
                aria-label="Editar meta"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              isExceeded ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${barPercentage}%` }}
          />
        </div>

        {/* Values */}
        <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
          <span className="text-foreground-muted">
            Atual: <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(current)}</span>
          </span>
          <span className="text-foreground-muted">
            Meta: <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(target)}</span>
          </span>
        </div>

        {/* Status Message */}
        {isComplete && (
          <div
            className={cn(
              'mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none',
              isExceeded ? 'bg-success-bg text-success-fg' : 'bg-info-bg text-info-fg',
            )}
          >
            {isExceeded
              ? `Meta ultrapassada em ${formatPercentage(displayPercentage - 100, 0)}!`
              : 'Meta atingida!'}
          </div>
        )}
      </section>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Definir Meta</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {subtitle && (
              <p className="mb-4 text-sm text-foreground-muted">
                Período: {subtitle}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="meta-value">Valor da Meta</Label>
              <Input
                id="meta-value"
                type="text"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="Ex: 50000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
