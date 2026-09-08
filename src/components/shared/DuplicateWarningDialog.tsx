import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { DuplicateMatch } from '@/hooks/useDuplicateDetection';

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateMatch: DuplicateMatch | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicateMatch,
  onConfirm,
  onCancel,
}: DuplicateWarningDialogProps) {
  if (!duplicateMatch) return null;

  const statusLabels: Record<string, string> = {
    pendente: 'Pendente',
    recebido: 'Recebido',
    pago: 'Pago',
    atrasado: 'Atrasado',
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Possível lançamento duplicado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              O sistema encontrou um lançamento similar já cadastrado:
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-1">
              <p className="font-medium text-foreground">
                {formatDate(duplicateMatch.data)}
              </p>
              <p className="text-foreground">{duplicateMatch.descricao}</p>
              <p className="text-sm">
                <span className={duplicateMatch.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(duplicateMatch.valor)}
                </span>
                {' • '}
                <span>{statusLabels[duplicateMatch.status] || duplicateMatch.status}</span>
              </p>
            </div>
            <p>
              Deseja criar mesmo assim?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Criar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
