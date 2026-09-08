import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface FluxoCaixaKPIRowProps {
  entradas: number;
  saidas: number;
  saldo: number;
  itemCount: number;
}

export function FluxoCaixaKPIRow({ entradas, saidas, saldo, itemCount }: FluxoCaixaKPIRowProps) {
  const items = [
    {
      key: 'entradas',
      label: 'Total Entradas',
      value: entradas,
      Icon: TrendingUp,
      accent: 'bg-emerald-500',
      iconCls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      valueCls: 'text-foreground',
    },
    {
      key: 'saidas',
      label: 'Total Saídas',
      value: saidas,
      Icon: TrendingDown,
      accent: 'bg-rose-500',
      iconCls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
      valueCls: 'text-foreground',
    },
    {
      key: 'saldo',
      label: 'Saldo do Período',
      value: saldo,
      Icon: Wallet,
      accent: saldo >= 0 ? 'bg-sky-500' : 'bg-rose-500',
      iconCls: saldo >= 0
        ? 'text-sky-600 dark:text-sky-400 bg-sky-500/10'
        : 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
      valueCls: saldo >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="mb-6 relative rounded-xl border bg-card shadow-sm overflow-hidden">
      <span className="absolute top-3 right-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 px-2 py-0.5 rounded-full bg-muted/50">
        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
        {items.map(({ key, label, value, Icon, accent, iconCls, valueCls }) => (
          <div key={key} className="relative px-5 py-4">
            <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r', accent)} />
            <div className="flex items-center gap-3">
              <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg', iconCls)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <span className={cn('text-2xl font-bold tabular-nums leading-tight', valueCls)}>
                  {formatCurrency(value)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
