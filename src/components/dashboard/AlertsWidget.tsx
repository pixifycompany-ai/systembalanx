import { AlertTriangle, Clock, ChevronRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/shared/SectionCard';

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

const ALERT_TONE: Record<Alert['type'], string> = {
  overdue: 'bg-danger-bg text-danger-fg',
  due_soon: 'bg-warning-bg text-warning-fg',
  warning: 'bg-surface-2 text-foreground-muted',
};

export function AlertsWidget({ alerts, title = 'Alertas' }: AlertsWidgetProps) {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-[18px] w-[18px]" />;
      case 'due_soon':
        return <Clock className="h-[18px] w-[18px]" />;
      case 'warning':
        return <Bell className="h-[18px] w-[18px]" />;
    }
  };

  if (alerts.length === 0) {
    return (
      <SectionCard title={title}>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-[13px] bg-surface-2 text-foreground-muted">
            <Bell className="h-5 w-5" />
          </div>
          <p className="text-sm text-foreground-muted">Nenhum alerta no momento</p>
          <p className="mt-1 text-xs text-foreground-muted">Tudo em dia!</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={title}
      action={
        <span className="inline-flex items-center rounded-full bg-danger-bg px-2.5 py-1 text-[12px] font-semibold leading-none text-danger-fg">
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </span>
      }
    >
      <div className="-my-1">
        {alerts.map((alert) => {
          const body = (
            <>
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[13px]', ALERT_TONE[alert.type])}>
                {getAlertIcon(alert.type)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{alert.title}</span>
                  {alert.count && alert.count > 1 && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                      {alert.count}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12px] text-foreground-muted">{alert.description}</span>
              </span>
              {alert.link && <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />}
            </>
          );
          const rowCls = 'flex items-center gap-3 border-b border-border py-3 last:border-b-0';
          return alert.link ? (
            <Link key={alert.id} to={alert.link} className={cn(rowCls, 'transition-opacity hover:opacity-80')}>
              {body}
            </Link>
          ) : (
            <div key={alert.id} className={rowCls}>
              {body}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// Mock alerts for development
export const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    type: 'overdue',
    title: 'Receitas atrasadas',
    description: '3 receitas passaram do vencimento',
    link: '/fluxo-caixa?tipo=entrada&status=atrasado',
    count: 3,
  },
  {
    id: '2',
    type: 'due_soon',
    title: 'Vencem hoje',
    description: '2 contas vencem hoje',
    link: '/fluxo-caixa?tipo=saida&venc=hoje',
    count: 2,
  },
  {
    id: '3',
    type: 'due_soon',
    title: 'Próximos 3 dias',
    description: '5 receitas vencem em breve',
    link: '/fluxo-caixa?tipo=entrada&venc=prox7',
    count: 5,
  },
];
