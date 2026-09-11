import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ArrowRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface Alert {
  id: string;
  type: 'overdue' | 'due_soon' | 'warning';
  title: string;
  description: string;
  link?: string;
  count?: number;
}

interface AlertsWidgetProps {
  alerts: Alert[];
  title?: string;
}

export function AlertsWidget({ alerts, title = 'Alertas' }: AlertsWidgetProps) {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'due_soon':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'warning':
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
        return 'bg-destructive/10 border-destructive/20';
      case 'due_soon':
        return 'bg-warning/10 border-warning/20';
      case 'warning':
        return 'bg-muted border-muted';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Nenhum alerta no momento
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tudo em dia!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              getAlertStyles(alert.type)
            )}
          >
            <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {alert.title}
                </p>
                {alert.count && alert.count > 1 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-foreground/10 text-foreground font-medium">
                    {alert.count}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alert.description}
              </p>
            </div>
            {alert.link && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link to={alert.link}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// Mock alerts for development
export const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    type: 'overdue',
    title: 'Receitas atrasadas',
    description: '3 receitas passaram do vencimento',
    link: '/receitas?status=atrasado',
    count: 3,
  },
  {
    id: '2',
    type: 'due_soon',
    title: 'Vencem hoje',
    description: '2 contas vencem hoje',
    link: '/despesas',
    count: 2,
  },
  {
    id: '3',
    type: 'due_soon',
    title: 'Próximos 3 dias',
    description: '5 receitas vencem em breve',
    link: '/receitas',
    count: 5,
  },
];
