// Números pequenos do menu (sidebar, menu do celular e bolinha da barra):
// - Cobranças: quantas estão vencidas (mesma regra da tela Cobranças: status "vencido";
//   cobranças agrupadas numa fatura do Asaas contam uma vez só).
// - Calendário: quanto vence hoje e ainda está em aberto (receitas e despesas pendentes
//   ou atrasadas com vencimento hoje + compromissos/tarefas de hoje não concluídos).
// Consultas leves (count/head ou só ids), com cache: não recarregam a cada navegação.
// As chaves começam com 'dashboard' e 'agenda' para atualizar sozinhas quando um
// lançamento ou item da agenda muda (essas chaves já são invalidadas nessas mudanças).
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// Tabelas fora dos tipos gerados (cobrancas, agenda_itens)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const CINCO_MIN = 5 * 60_000;

export function useContadoresMenu() {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  const fin = useQuery({
    queryKey: ['dashboard', 'menu-contadores', hoje],
    queryFn: async () => {
      const [cobs, rec, desp] = await Promise.all([
        db.from('cobrancas').select('id, asaas_payment_id').eq('status', 'vencido'),
        supabase.from('receitas').select('id', { count: 'exact', head: true })
          .in('status', ['pendente', 'atrasado']).eq('data_vencimento', hoje),
        supabase.from('despesas').select('id', { count: 'exact', head: true })
          .in('status', ['pendente', 'atrasado']).is('fatura_id', null).eq('data_vencimento', hoje),
      ]);
      const faturas = new Set(((cobs.data || []) as { id: string; asaas_payment_id: string | null }[]).map((c) => c.asaas_payment_id || c.id));
      return { cobrancasVencidas: faturas.size, lancamentosHoje: (rec.count || 0) + (desp.count || 0) };
    },
    staleTime: CINCO_MIN,
    refetchOnWindowFocus: false,
  });

  const agenda = useQuery({
    queryKey: ['agenda', 'menu-hoje', hoje],
    queryFn: async () => {
      const { count } = await db.from('agenda_itens').select('id', { count: 'exact', head: true })
        .eq('concluida', false)
        .or(`data.eq.${hoje},and(inicio.gte.${hoje}T00:00:00-03:00,inicio.lte.${hoje}T23:59:59-03:00)`);
      return (count as number | null) || 0;
    },
    staleTime: CINCO_MIN,
    refetchOnWindowFocus: false,
  });

  const cobrancasVencidas = fin.data?.cobrancasVencidas ?? 0;
  const calendarioHoje = (fin.data?.lancamentosHoje ?? 0) + (agenda.data ?? 0);
  return { cobrancasVencidas, calendarioHoje };
}
