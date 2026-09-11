import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Copy, HeartPulse, AlertTriangle, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { BellIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNotifications, type Notification, type DuplicateDetail } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const typeConfig: Record<Notification['type'], { icon: typeof Clock; colorClass: string }> = {
  vencimento: { icon: Clock, colorClass: 'text-destructive' },
  duplicado: { icon: Copy, colorClass: 'text-muted-foreground' },
  saude: { icon: HeartPulse, colorClass: 'text-muted-foreground' },
};

const severityBg: Record<Notification['severity'], string> = {
  error: 'bg-destructive/10',
  warning: 'bg-muted',
  info: 'bg-secondary',
};

function DuplicateDetailsList({ details }: { details: DuplicateDetail[] }) {
  const navigate = useNavigate();
  return (
    <div className="border-t border-border mt-1 pt-1 space-y-1">
      {details.map((d) => (
        <button
          key={d.id}
          onClick={(e) => {
            e.stopPropagation();
            navigate(d.tipo === 'receita' ? '/receitas' : '/despesas');
          }}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-accent/50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{d.descricao}</p>
            <p className="text-muted-foreground">
              {d.fornecedor_cliente} · {format(parseISO(d.data_vencimento), 'dd/MM/yy', { locale: ptBR })}
            </p>
          </div>
          <span className={cn("shrink-0 font-medium", d.tipo === 'receita' ? 'text-primary' : 'text-destructive')}>
            R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </button>
      ))}
    </div>
  );
}

export function NotificationBell() {
  const { notifications, totalCount, isLoading, dismissNotification, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleClick = (notif: Notification) => {
    // Qualquer notificação com itens (atrasados, vencem hoje, duplicados…) expande
    // a lista em vez de navegar direto — assim o usuário vê nome + valor de cada um.
    if (notif.details?.length) {
      setExpandedId(prev => prev === notif.id ? null : notif.id);
      return;
    }
    if (notif.href) navigate(notif.href);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-surface/70 backdrop-blur-xl text-foreground transition-colors hover:bg-surface-2"
        >
          <BellIcon className="h-5 w-5" />
          {totalCount > 0 && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[hsl(var(--warning))] ring-2 ring-background" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden rounded-2xl border-border/60 bg-surface/95 backdrop-blur-xl shadow-2xl">
        <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Notificações</h4>
            {totalCount > 0 && (
              <p className="text-xs text-muted-foreground">{totalCount} pendente{totalCount > 1 ? 's' : ''}</p>
            )}
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <BellIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const config = typeConfig[notif.type];
                const Icon = config.icon;
                const isExpanded = expandedId === notif.id;
                const hasDupeDetails = !!notif.details?.length;

                return (
                  <div key={notif.id} className={cn(severityBg[notif.severity])}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <button
                        onClick={() => handleClick(notif)}
                        className="flex items-start gap-3 flex-1 text-left min-w-0"
                      >
                        <div className={cn("mt-0.5 shrink-0", config.colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{notif.description}</p>
                        </div>
                        {hasDupeDetails && (
                          <div className="shrink-0 mt-0.5 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        )}
                        {notif.severity === 'error' && !hasDupeDetails && (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {hasDupeDetails && isExpanded && (
                      <div className="px-4 pb-3">
                        <DuplicateDetailsList details={notif.details!} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
