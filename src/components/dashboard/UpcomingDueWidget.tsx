import { Calendar, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export interface UpcomingItem {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  data_vencimento: string;
  cliente_ou_fornecedor: string;
  /** Destino ao clicar (ex.: fatura de cartão → /contas). Se ausente, usa o padrão. */
  href?: string;
}

interface UpcomingDueWidgetProps {
  items: UpcomingItem[];
  title?: string;
  days?: number;
  onItemClick?: (item: UpcomingItem) => void;
}

export function UpcomingDueWidget({ 
  items, 
  title = 'Próximos Vencimentos',
  days = 7,
  onItemClick,
}: UpcomingDueWidgetProps) {
  // Dias até o vencimento (negativo = atrasado)
  const diasAte = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const pill = (dateStr: string) => {
    const d = diasAte(dateStr);
    if (d < 0) return { label: `Atrasado ${Math.abs(d)}d`, cls: 'border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]' };
    if (d === 0) return { label: 'Hoje', cls: 'border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' };
    if (d === 1) return { label: 'Amanhã', cls: 'border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' };
    return { label: `em ${d} dias`, cls: 'border-border/70 bg-foreground/[0.04] text-foreground-muted' };
  };

  const cardCls = 'auro-card rounded-2xl border border-border/60 bg-surface/70 p-5 backdrop-blur-xl';

  if (items.length === 0) {
    return (
      <div className={cardCls}>
        <h3 className="text-[15px] font-semibold text-foreground mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum vencimento nos próximos {days} dias</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        <Link to="/fluxo-caixa?venc=prox7" className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground">
          Ver todos{items.length > 6 ? ` (${items.length})` : ''} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-border/50">
        {items.slice(0, 6).map((item) => {
          const p = pill(item.data_vencimento);
          return (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.03] -mx-2 px-2 rounded-lg"
              onClick={() => onItemClick?.(item)}
            >
              <span className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                item.tipo === 'receita' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]',
              )}>
                {item.tipo === 'receita' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">{item.cliente_ou_fornecedor}</span>
                <span className="block truncate text-[11.5px] text-foreground-muted">
                  {item.descricao} · {formatDate(item.data_vencimento)}
                </span>
              </span>
              <span className={cn(
                'shrink-0 text-[13px] font-semibold tabular-nums',
                item.tipo === 'receita' ? 'text-[hsl(var(--success))]' : 'text-foreground',
              )}>
                {item.tipo === 'receita' ? '+' : '−'}{formatCurrency(item.valor)}
              </span>
              <span className={cn('inline-flex h-6 w-[92px] shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', p.cls)}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Mock data for development
export const MOCK_UPCOMING_ITEMS: UpcomingItem[] = [
  {
    id: '1',
    tipo: 'receita',
    descricao: 'Gestão de Redes Sociais',
    valor: 2700,
    data_vencimento: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    cliente_ou_fornecedor: 'Tech Solutions',
  },
  {
    id: '2',
    tipo: 'despesa',
    descricao: 'Assinatura Adobe',
    valor: 299,
    data_vencimento: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    cliente_ou_fornecedor: 'Adobe',
  },
  {
    id: '3',
    tipo: 'receita',
    descricao: 'Projeto Website',
    valor: 5500,
    data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    cliente_ou_fornecedor: 'Marketing Pro',
  },
  {
    id: '4',
    tipo: 'despesa',
    descricao: 'Servidor Cloud',
    valor: 850,
    data_vencimento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    cliente_ou_fornecedor: 'AWS',
  },
];
