import { formatCurrency } from '@/utils/formatters';
import { Progress } from '@/components/ui/progress';
import { CreditCard } from 'lucide-react';

export interface CreditCardData {
  id: string;
  nome: string;
  usado: number;
  limite: number;
}

interface CreditCardsWidgetProps {
  cards: CreditCardData[];
}

export function CreditCardsWidget({ cards }: CreditCardsWidgetProps) {
  if (cards.length === 0) {
    return (
      <div className="metric-card animate-fade-in flex flex-col items-center justify-center min-h-[200px] text-center">
        <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum cartão de crédito cadastrado</p>
        <p className="text-xs text-muted-foreground mt-1">Adicione uma conta do tipo cartão</p>
      </div>
    );
  }

  return (
    <div className="metric-card animate-fade-in">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Cartões de Crédito
      </h3>
      <div className="space-y-4">
        {cards.map((card) => {
          const percentUsed = card.limite > 0 ? (card.usado / card.limite) * 100 : 0;
          const disponivel = card.limite - card.usado;
          return (
            <div key={card.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{card.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {percentUsed.toFixed(0)}% usado
                </span>
              </div>
              <Progress value={Math.min(percentUsed, 100)} className="h-2 mb-1" />
              <p className="text-xs text-muted-foreground">
                Disponível: <span className="font-medium text-foreground">{formatCurrency(disponivel)}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
