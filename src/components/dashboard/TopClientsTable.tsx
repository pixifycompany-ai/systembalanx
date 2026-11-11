import { formatCurrency } from '@/utils/formatters';
import type { TopCliente } from '@/types/finance';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/shared/SectionCard';

interface TopClientsTableProps {
  clients: TopCliente[];
  title?: string;
  onClienteClick?: (c: TopCliente) => void;
}

export function TopClientsTable({ clients, title = 'Top Clientes', onClienteClick }: TopClientsTableProps) {
  const maxValue = Math.max(...clients.map(c => c.receita_total));

  return (
    <SectionCard title={title}>
      <div className="-my-1">
        {clients.map((client, index) => {
          const percentage = (client.receita_total / maxValue) * 100;

          return (
            <button
              type="button"
              key={client.cliente_id}
              disabled={!onClienteClick}
              onClick={() => onClienteClick?.(client)}
              className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-b-0 enabled:hover:opacity-80"
            >
              {/* Posição no ranking */}
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-[13px] font-heading text-sm font-semibold tabular-nums',
                  index === 0 ? 'bg-foreground text-background' : 'bg-surface-2 text-foreground',
                )}
              >
                {index + 1}
              </span>

              {/* Cliente + barra relativa ao 1º */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{client.cliente}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <span className="ml-2 shrink-0 font-heading text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(client.receita_total)}
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
