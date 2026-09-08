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
      <div className={cn('metric-card animate-fade-in', className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleOpenDialog}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {showPercentage && (
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                isExceeded ? "text-green-500" : "text-foreground"
              )}>
                {isExceeded && '+'}
                {formatPercentage(displayPercentage, 0)}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                isExceeded ? "bg-green-500" : "bg-foreground"
              )}
              style={{ width: `${barPercentage}%` }}
            />
          </div>
        </div>

        {/* Values */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-muted-foreground">
            Atual: <span className="font-medium text-foreground">{formatCurrency(current)}</span>
          </span>
          <span className="text-muted-foreground">
            Meta: <span className="font-medium text-foreground">{formatCurrency(target)}</span>
          </span>
        </div>

        {/* Status Message */}
        {isComplete && (
          <div className={cn(
            "mt-3 text-sm font-medium",
            isExceeded ? "text-green-500" : "text-foreground"
          )}>
            {isExceeded 
              ? `Meta ultrapassada em ${formatPercentage(displayPercentage - 100, 0)}!`
              : 'Meta atingida!'
            }
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Definir Meta</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {subtitle && (
              <p className="text-sm text-muted-foreground mb-4">
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
