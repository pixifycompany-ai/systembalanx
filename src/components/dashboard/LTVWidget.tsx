import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/formatters';
import { Users, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface LTVData {
  ltvMedio: number;
  ticketMedio: number;
  tempoMedioMeses: number;
  totalClientes: number;
  receitaTotal: number;
  clientesComReceita: number;
}

interface LTVWidgetProps {
  data: LTVData;
}

export function LTVWidget({ data }: LTVWidgetProps) {
  const {
    ltvMedio,
    ticketMedio,
    tempoMedioMeses,
    totalClientes,
    receitaTotal,
    clientesComReceita,
  } = data;

  const formatMeses = (meses: number) => {
    if (meses < 1) return 'Menos de 1 mês';
    if (meses === 1) return '1 mês';
    if (meses < 12) return `${Math.round(meses)} meses`;
    const anos = Math.floor(meses / 12);
    const mesesRestantes = Math.round(meses % 12);
    if (mesesRestantes === 0) return `${anos} ano${anos > 1 ? 's' : ''}`;
    return `${anos} ano${anos > 1 ? 's' : ''} e ${mesesRestantes} mês${mesesRestantes > 1 ? 'es' : ''}`;
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Lifetime Value (LTV)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Main LTV Value */}
          <div className="mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {formatCurrency(ltvMedio)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ticket mensal contratado × tempo de relacionamento
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-sm">
                  LTV = Valor Mensal Contratado × Meses de Relacionamento
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">Ticket Mensal</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(ticketMedio)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">Tempo Médio</span>
              </div>
              <p className="text-lg font-semibold">
                {formatMeses(tempoMedioMeses)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Clientes Ativos</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">
                {clientesComReceita} / {totalClientes}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-xs">Valor Total Contratado</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(receitaTotal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export type { LTVData };
