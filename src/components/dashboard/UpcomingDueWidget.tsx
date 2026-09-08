import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const formatDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Atrasado';
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    return `${diffDays} dias`;
  };

  const getDaysRemainingColor = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-destructive';
    if (diffDays <= 2) return 'text-warning';
    return 'text-muted-foreground';
  };

  if (items.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Nenhum vencimento nos próximos {days} dias
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">
          Próximos {days} dias
        </span>
      </div>

      <div className="space-y-2">
        {items.slice(0, 5).map(item => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
            onClick={() => onItemClick?.(item)}
          >
            {/* Icon */}
            <div className={cn(
              "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
              item.tipo === 'receita' ? 'bg-primary/10' : 'bg-destructive/10'
            )}>
              {item.tipo === 'receita' ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-foreground truncate min-w-0">
                  {item.cliente_ou_fornecedor}
                </p>
                <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
                  {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mb-1.5">
                {item.descricao}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className={cn(
                  "text-sm font-semibold tabular-nums",
                  item.tipo === 'receita' ? 'text-primary' : 'text-foreground'
                )}>
                  {formatCurrency(item.valor)}
                </p>
                <p className={cn("text-xs tabular-nums", getDaysRemainingColor(item.data_vencimento))}>
                  {formatDaysRemaining(item.data_vencimento)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 5 && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="ghost" className="w-full gap-2" asChild>
            <Link to="/receitas">
              Ver todos ({items.length})
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
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
