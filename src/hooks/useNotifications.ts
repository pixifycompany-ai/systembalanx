import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, isBefore, isToday, addDays, startOfDay, format } from 'date-fns';

export interface DuplicateDetail {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  tipo: 'receita' | 'despesa';
  fornecedor_cliente: string;
}

export interface Notification {
  id: string;
  type: 'vencimento' | 'duplicado' | 'saude';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  href?: string;
  count?: number;
  details?: DuplicateDetail[];
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const dismissNotification = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  }, []);

  const clearAll = useCallback(() => {
    setDismissedIds(new Set(notifications.map(n => n.id)));
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const today = startOfDay(new Date());
      const threeDaysFromNow = addDays(today, 3);

      const [
        { data: receitas },
        { data: despesas },
      ] = await Promise.all([
        supabase
          .from('receitas')
          .select('id, descricao, valor, data_vencimento, status, cliente_id, clientes(nome)')
          .in('status', ['pendente', 'atrasado']),
        supabase
          .from('despesas')
          .select('id, descricao, valor, data_vencimento, status, fornecedor, fatura_id')
          .in('status', ['pendente', 'atrasado']),
      ]);

      const receitaItems = (receitas || []).map(r => ({
        id: r.id,
        descricao: r.descricao,
        valor: Number(r.valor),
        data_vencimento: r.data_vencimento,
        status: r.status,
        tipo: 'receita' as const,
        fornecedor_cliente: (r as any).clientes?.nome || 'Sem cliente',
        cliente_id: r.cliente_id,
      }));

      const despesaItems = (despesas || [])
        // Excluir lançamentos vinculados a uma fatura de cartão (o vencimento real
        // é o da fatura, representada pela despesa-sombra "[fatura]") e os
        // registros internos de pagamento de fatura.
        .filter((d: any) => !d.fatura_id && d.fornecedor !== '[pagamento-fatura]')
        .map(d => ({
          id: d.id,
          descricao: d.descricao,
          valor: Number(d.valor),
          data_vencimento: d.data_vencimento,
          status: d.status,
          tipo: 'despesa' as const,
          fornecedor_cliente: d.fornecedor || 'Sem fornecedor',
          cliente_id: null as string | null,
        }));

      const allPending = [...receitaItems, ...despesaItems];
      const notifs: Notification[] = [];

      // 1. Overdue
      const overdue = allPending.filter(item => {
        if (!item.data_vencimento) return false;
        const venc = parseISO(item.data_vencimento);
        return isBefore(venc, today) && !isToday(venc);
      });
      if (overdue.length > 0) {
        const totalOverdue = overdue.reduce((s, i) => s + i.valor, 0);
        notifs.push({
          id: 'overdue',
          type: 'vencimento',
          severity: 'error',
          title: `${overdue.length} lançamento${overdue.length > 1 ? 's' : ''} atrasado${overdue.length > 1 ? 's' : ''}`,
          description: `R$ ${totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso`,
          href: '/fluxo-caixa?status=atrasado',
          count: overdue.length,
        });
      }

      // 2. Due today
      const dueToday = allPending.filter(item => item.data_vencimento && isToday(parseISO(item.data_vencimento)));
      if (dueToday.length > 0) {
        notifs.push({
          id: 'due-today',
          type: 'vencimento',
          severity: 'warning',
          title: `${dueToday.length} vence${dueToday.length > 1 ? 'm' : ''} hoje`,
          description: `R$ ${dueToday.reduce((s, i) => s + i.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          href: '/fluxo-caixa?status=pendente',
          count: dueToday.length,
        });
      }

      // 3. Due in next 3 days
      const dueNext3 = allPending.filter(item => {
        if (!item.data_vencimento) return false;
        const venc = parseISO(item.data_vencimento);
        return !isBefore(venc, today) && !isToday(venc) && isBefore(venc, threeDaysFromNow);
      });
      if (dueNext3.length > 0) {
        notifs.push({
          id: 'due-soon',
          type: 'vencimento',
          severity: 'info',
          title: `${dueNext3.length} vence${dueNext3.length > 1 ? 'm' : ''} em 3 dias`,
          description: `R$ ${dueNext3.reduce((s, i) => s + i.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          href: '/fluxo-caixa?status=pendente',
          count: dueNext3.length,
        });
      }

      // 4. Duplicates: group by valor + fornecedor/cliente + month
      const dupeMap = new Map<string, typeof allPending>();
      for (const item of allPending) {
        if (!item.data_vencimento) continue;
        const month = format(parseISO(item.data_vencimento), 'yyyy-MM');
        const key = `${item.valor}-${item.fornecedor_cliente.toLowerCase().trim()}-${month}`;
        const group = dupeMap.get(key) || [];
        group.push(item);
        dupeMap.set(key, group);
      }

      const allDuplicates: DuplicateDetail[] = [];
      dupeMap.forEach((group) => {
        if (group.length > 1) {
          group.forEach(item => {
            allDuplicates.push({
              id: item.id,
              descricao: item.descricao,
              valor: item.valor,
              data_vencimento: item.data_vencimento,
              tipo: item.tipo,
              fornecedor_cliente: item.fornecedor_cliente,
            });
          });
        }
      });

      if (allDuplicates.length > 0) {
        notifs.push({
          id: 'duplicates',
          type: 'duplicado',
          severity: 'warning',
          title: `${allDuplicates.length} possíveis duplicados`,
          description: 'Mesmo valor, fornecedor/cliente e mês',
          count: allDuplicates.length,
          details: allDuplicates,
        });
      }

      // 5. Financial health
      const totalReceitas = receitaItems.reduce((s, r) => s + r.valor, 0);
      const totalDespesas = despesaItems.reduce((s, d) => s + d.valor, 0);
      if (totalReceitas > 0) {
        const margin = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
        const score = Math.min(100, Math.max(0, margin));
        if (score < 50) {
          notifs.push({
            id: 'health-score',
            type: 'saude',
            severity: 'warning',
            title: 'Saúde financeira em alerta',
            description: `Score: ${Math.round(score)}% — margem baixa`,
            href: '/analises',
          });
        }
      }

      setNotifications(notifs);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const visibleNotifications = useMemo(
    () => notifications.filter(n => !dismissedIds.has(n.id)),
    [notifications, dismissedIds]
  );

  const totalCount = useMemo(
    () => visibleNotifications.reduce((sum, n) => sum + (n.count || 1), 0),
    [visibleNotifications]
  );

  return {
    notifications: visibleNotifications,
    totalCount,
    isLoading,
    refetch: fetchNotifications,
    dismissNotification,
    clearAll,
  };
}
