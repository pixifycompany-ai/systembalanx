import { AlertTriangle, Edit2, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { DuplicateMatch } from '@/hooks/useDuplicateDetection';

export interface ParsedTransaction {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  conta_pagamento: string;
  categoria_sugerida: string;
  ignorar: boolean;
  motivo_ignorar?: string;
  selected: boolean;
  is_transfer?: boolean;
  transfer_type?: 'enviada' | 'recebida';
  transfer_match_key?: string;
  isDuplicate?: boolean;
  duplicateMatch?: DuplicateMatch;
  categoria_id?: string;
  conta_id?: string;
  fornecedor?: string;
  cliente?: string;
  cliente_id?: string;
  source_file?: string;
  status?: 'pendente' | 'recebido' | 'pago' | 'atrasado';
  forma_pagamento?: string;
  tipo_despesa?: 'fixa' | 'variavel';
  data_vencimento?: string;
  data_competencia?: string;
  data_recebimento?: string;
  data_pagamento?: string;
  reviewed?: boolean;
}

export interface PairedTransfer {
  enviada: ParsedTransaction;
  recebida: ParsedTransaction;
  selected: boolean;
  id: string;
}

export interface Conta {
  id: string;
  nome: string;
  banco?: string | null;
}

export interface ClienteOption {
  id: string;
  nome: string;
}

interface TransactionPreviewTableProps {
  transactions: ParsedTransaction[];
  pairedTransfers: PairedTransfer[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleTransfer: (id: string) => void;
  onToggleAllTransfers: () => void;
  isAllSelected: boolean;
  isAllTransfersSelected: boolean;
  onEdit: (transaction: ParsedTransaction) => void;
}

export function TransactionPreviewTable({
  transactions,
  pairedTransfers,
  onToggleSelect,
  onToggleSelectAll,
  onToggleTransfer,
  onToggleAllTransfers,
  isAllSelected,
  isAllTransfersSelected,
  onEdit,
}: TransactionPreviewTableProps) {
  const selectableTransactions = transactions.filter(t => !t.ignorar);
  const hasSourceFile = transactions.some(t => t.source_file);
  
  return (
    <div className="space-y-4">
      {/* Transactions Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">Data</th>
                <th className="px-3 py-2.5 text-left font-medium min-w-[180px]">Descrição</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-center font-medium w-16">Status</th>
                {hasSourceFile && (
                  <th className="px-3 py-2.5 text-left font-medium max-w-[100px]">Arquivo</th>
                )}
                <th className="px-3 py-2.5 text-right font-medium w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.filter(t => !t.is_transfer).map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  hasSourceFile={hasSourceFile}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {selectableTransactions.filter(t => t.selected && !t.is_transfer).length} de {selectableTransactions.filter(t => !t.is_transfer).length} transações selecionadas
        </div>
      </div>

      {/* Paired Transfers Section */}
      {pairedTransfers.length > 0 && (
        <div className="border rounded-lg overflow-hidden border-blue-200 dark:border-blue-800">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700 dark:text-blue-300">
                Transferências Detectadas ({pairedTransfers.length})
              </span>
              <Checkbox
                checked={isAllTransfersSelected}
                onCheckedChange={onToggleAllTransfers}
                aria-label="Selecionar todas transferências"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Conta Origem</th>
                  <th className="px-3 py-2 text-center font-medium">→</th>
                  <th className="px-3 py-2 text-left font-medium">Conta Destino</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pairedTransfers.map((transfer) => (
                  <tr 
                    key={transfer.id}
                    className={cn(transfer.selected && 'bg-blue-50/50 dark:bg-blue-900/10')}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={transfer.selected}
                        onCheckedChange={() => onToggleTransfer(transfer.id)}
                        aria-label="Selecionar transferência"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(transfer.enviada.data)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-red-600">
                      {transfer.enviada.conta_pagamento || 'Conta não identificada'}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">→</td>
                    <td className="px-3 py-2 whitespace-nowrap text-emerald-600">
                      {transfer.recebida.conta_pagamento || 'Conta não identificada'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium text-blue-600">
                      {formatCurrency(transfer.enviada.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {pairedTransfers.filter(t => t.selected).length} de {pairedTransfers.length} transferências selecionadas
          </div>
        </div>
      )}
    </div>
  );
}

// Extracted row component
function TransactionRow({
  transaction,
  hasSourceFile,
  onToggleSelect,
  onEdit,
}: {
  transaction: ParsedTransaction;
  hasSourceFile: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (transaction: ParsedTransaction) => void;
}) {
  const isReceita = transaction.tipo === 'receita';

  return (
    <tr
      className={cn(
        transaction.ignorar && 'opacity-50 bg-muted/30',
        transaction.isDuplicate && !transaction.ignorar && 'bg-amber-50 dark:bg-amber-950/20',
        transaction.selected && !transaction.ignorar && !transaction.isDuplicate && 'bg-primary/5'
      )}
    >
      <td className="px-3 py-2.5">
        <Checkbox
          checked={transaction.selected}
          onCheckedChange={() => onToggleSelect(transaction.id)}
          disabled={transaction.ignorar}
          aria-label={`Selecionar ${transaction.descricao}`}
        />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-sm">
        {formatDate(transaction.data)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[200px] text-sm" title={transaction.descricao}>
            {transaction.descricao}
          </span>
          {transaction.ignorar && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              ({transaction.motivo_ignorar})
            </span>
          )}
          {transaction.isDuplicate && transaction.duplicateMatch && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p className="font-medium">Possível duplicado:</p>
                  <p className="text-xs">
                    {formatDate(transaction.duplicateMatch.data)} - {transaction.duplicateMatch.descricao}
                  </p>
                  <p className="text-xs">
                    {formatCurrency(transaction.duplicateMatch.valor)} • {transaction.duplicateMatch.status}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className={cn(
          "tabular-nums whitespace-nowrap font-medium text-sm",
          isReceita ? 'text-emerald-600' : 'text-red-600'
        )}>
          {transaction.tipo === 'despesa' ? '-' : '+'}
          {formatCurrency(transaction.valor)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          isReceita
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {isReceita ? 'Receita' : 'Despesa'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {transaction.reviewed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Revisado</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">Pendente</span>
        )}
      </td>
      {hasSourceFile && (
        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[100px] truncate" title={transaction.source_file}>
          {transaction.source_file || '-'}
        </td>
      )}
      <td className="px-3 py-2.5 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(transaction)}
          disabled={transaction.ignorar}
          className="h-7 px-2"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
