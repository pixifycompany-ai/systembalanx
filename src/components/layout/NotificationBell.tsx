import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Copy, HeartPulse, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { BellIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type Notification, type DuplicateDetail } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const typeConfig: Record<Notification['type'], { icon: typeof Clock; colorClass: string }> = {
  vencimento: { icon: Clock, colorClass: 'text-destructive' },
  duplicado: { icon: Copy, colorClass: 'text-muted-foreground' },
  saude: { icon: HeartPulse, colorClass: 'text-muted-foreground' },
};

// Chip de ícone por severidade (tint sutil, sem fundo pesado na linha inteira)
const chipTint: Record<Notification['severity'], string> = {
  error: 'bg-[hsl(var(--danger))]/14 text-[hsl(var(--danger))]',
  warning: 'bg-[hsl(var(--warning))]/14 text-[hsl(var(--warning))]',
  info: 'bg-primary/14 text-primary',
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
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide',
                  d.tipo === 'receita' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
                )}
              >
                {d.tipo === 'receita' ? 'Receita' : 'Despesa'}
              </span>
              <p className="font-medium truncate">{d.descricao}</p>
            </div>
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
      <PopoverContent align="end" sideOffset={8} className="w-[22rem] p-0 overflow-hidden rounded-2xl border border-border/60 bg-surface/95 backdrop-blur-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50">
          <div>
            <h4 className="text-[15px] font-semibold text-foreground">Notificações</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalCount > 0 ? `${totalCount} pendente${totalCount > 1 ? 's' : ''}` : 'Tudo em dia'}
            </p>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-muted-foreground/50">
                <BellIcon className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {notifications.map((notif) => {
                const config = typeConfig[notif.type];
                const Icon = config.icon;
                const isExpanded = expandedId === notif.id;
                const hasDupeDetails = !!notif.details?.length;

                return (
                  <div key={notif.id} className="rounded-xl">
                    <div className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]">
                      <button
                        onClick={() => handleClick(notif)}
                        className="flex flex-1 items-start gap-3 text-left min-w-0"
                      >
                        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[11px]', chipTint[notif.severity])}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium leading-snug text-foreground">{notif.title}</p>
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground">{notif.description}</p>
                        </div>
                        {hasDupeDetails && (
                          <span className="mt-0.5 shrink-0 text-muted-foreground/70">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                        aria-label="Dispensar"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground/60 opacity-0 transition hover:bg-white/5 hover:text-foreground group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {hasDupeDetails && isExpanded && (
                      <div className="px-2.5 pb-2">
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
