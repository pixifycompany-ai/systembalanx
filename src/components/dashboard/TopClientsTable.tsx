import { formatCurrency } from '@/utils/formatters';
import type { TopCliente } from '@/types/finance';
import { cn } from '@/lib/utils';

interface TopClientsTableProps {
  clients: TopCliente[];
  title?: string;
}

export function TopClientsTable({ clients, title = 'Top Clientes' }: TopClientsTableProps) {
  const maxValue = Math.max(...clients.map(c => c.receita_total));

  return (
    <div className="metric-card animate-fade-in">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      
      <div className="space-y-3">
        {clients.map((client, index) => {
          const percentage = (client.receita_total / maxValue) * 100;
          
          return (
            <div 
              key={client.cliente_id} 
              className="group relative overflow-hidden rounded-lg border border-border/50 bg-secondary/30 p-3 transition-all hover:border-primary/30 hover:bg-secondary/50"
            >
              {/* Rank Badge */}
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                index === 0 && "bg-primary",
                index === 1 && "bg-primary/70",
                index === 2 && "bg-primary/50",
                index > 2 && "bg-primary/30"
              )} />
              
              <div className="flex items-center justify-between pl-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Rank Number */}
                  <span className={cn(
                    "text-lg font-semibold tabular-nums w-6 text-center",
                    index === 0 && "text-primary",
                    index === 1 && "text-primary/80",
                    index === 2 && "text-primary/60",
                    index > 2 && "text-muted-foreground"
                  )}>
                    {index + 1}
                  </span>
                  
                  {/* Client Name */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {client.cliente}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-background overflow-hidden">
                      <div 
                        className="h-full bg-primary/50 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Value */}
                <span className="text-sm font-semibold text-primary tabular-nums ml-4">
                  {formatCurrency(client.receita_total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
