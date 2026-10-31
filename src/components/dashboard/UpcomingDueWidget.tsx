import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/shared/SectionCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
    if (d < 0) return { label: `Atrasado ${Math.abs(d)}d`, cls: 'bg-danger-bg text-danger-fg' };
    if (d === 0) return { label: 'Hoje', cls: 'bg-warning-bg text-warning-fg' };
    if (d === 1) return { label: 'Amanhã', cls: 'bg-warning-bg text-warning-fg' };
    return { label: `em ${d} dias`, cls: 'bg-surface-2 text-foreground-muted' };
  };

  const dataCurta = (dateStr: string) => {
    const d = diasAte(dateStr);
    if (d === 0) return 'Hoje';
    if (d === 1) return 'Amanhã';
    const [, mm, dd] = dateStr.split('T')[0].split('-');
    return dd && mm ? `${dd}/${mm}` : dateStr;
  };

  const verTodos = (
    <Link
      to="/fluxo-caixa?venc=prox7"
      className="text-[13px] font-medium text-foreground-muted transition-colors hover:text-foreground"
    >
      Ver todos{items.length > 6 ? ` (${items.length})` : ''}
    </Link>
  );

  if (items.length === 0) {
    return (
      <SectionCard title={title}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-[13px] bg-surface-2 text-foreground-muted">
            <Calendar className="h-5 w-5" />
          </div>
          <p className="text-sm text-foreground-muted">Nenhum vencimento nos próximos {days} dias</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard flush title={title} action={verTodos} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 md:pl-6">Lançamento</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="pr-4 text-right md:pr-6">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 6).map((item) => {
            const p = pill(item.data_vencimento);
            const isReceita = item.tipo === 'receita';
            return (
              <TableRow
                key={item.id}
                tabIndex={0}
                className="cursor-pointer border-border"
                onClick={() => onItemClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onItemClick?.(item);
                  }
                }}
              >
                <TableCell className="w-full max-w-0 pl-4 md:pl-6">
                  <span className="block truncate text-sm font-semibold text-foreground">{item.descricao}</span>
                  <span className="block truncate text-[12px] text-foreground-muted">{item.cliente_ou_fornecedor}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground-muted">{dataCurta(item.data_vencimento)}</TableCell>
                <TableCell
                  className={cn(
                    'whitespace-nowrap text-right font-heading font-semibold tabular-nums',
                    isReceita ? 'text-[hsl(var(--success-fg))]' : 'text-foreground',
                  )}
                >
                  {isReceita ? '+' : '−'}{formatCurrency(item.valor)}
                </TableCell>
                <TableCell className="pr-4 text-right md:pr-6">
                  <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none', p.cls)}>
                    {p.label}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SectionCard>
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
