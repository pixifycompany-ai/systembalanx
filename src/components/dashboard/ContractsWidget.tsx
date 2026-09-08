import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/utils/formatters';

export interface ContractsWidgetData {
  contratosAtivos: number;
  clientesAtivos: number;
  mrrTotal: number;
  proximoVencimento?: {
    cliente: string;
    data: string;
    valor: number;
  };
}

interface ContractsWidgetProps {
  data: ContractsWidgetData;
}

export function ContractsWidget({ data }: ContractsWidgetProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Contratos Card */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Contratos Ativos</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to="/contratos">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
              {data.contratosAtivos}
            </p>
            <p className="text-xs text-muted-foreground">contratos em vigor</p>
          </div>

          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">MRR:</span>
              <span className="font-semibold text-primary">
                {formatCurrency(data.mrrTotal)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Clientes Card */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
              <Users className="h-4 w-4 text-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Clientes Ativos</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to="/clientes">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
              {data.clientesAtivos}
            </p>
            <p className="text-xs text-muted-foreground">clientes na base</p>
          </div>

          {data.proximoVencimento && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Próximo vencimento:</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {data.proximoVencimento.cliente}
                </span>
                <span className="text-xs text-muted-foreground">
                  {data.proximoVencimento.data}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// Mock data for development
export const MOCK_CONTRACTS_DATA: ContractsWidgetData = {
  contratosAtivos: 12,
  clientesAtivos: 8,
  mrrTotal: 15800,
  proximoVencimento: {
    cliente: 'Tech Solutions',
    data: '15/02/2025',
    valor: 2700,
  },
};
