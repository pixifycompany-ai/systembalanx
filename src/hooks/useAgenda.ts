// Compromissos e tarefas (tabela agenda_itens). Toda mudança dispara a
// sincronização com o Google em segundo plano, se estiver conectado.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sincronizarGoogleEmSegundoPlano } from '@/lib/googleAgenda';

export interface AgendaItem {
  id: string;
  tipo: 'compromisso' | 'tarefa';
  titulo: string;
  notas: string | null;
  inicio: string | null;
  fim: string | null;
  dia_inteiro: boolean;
  data: string | null;
  lembrete_min: number | null;
  cliente_id: string | null;
  concluida: boolean;
  concluida_em?: string | null;
  origem: 'balanx' | 'google';
  google_event_id: string | null;
  /** Lista do Google Tarefas (vazio = lista padrão). */
  google_tasklist_id?: string | null;
  cliente?: { nome: string } | null;
}
export type NovoAgendaItem = Partial<Omit<AgendaItem, 'id' | 'cliente'>> & Pick<AgendaItem, 'tipo' | 'titulo'>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Dia (yyyy-MM-dd, fuso local) de um item. */
export const diaDoItem = (i: Pick<AgendaItem, 'data' | 'inicio'>) =>
  i.data || (i.inicio ? new Date(i.inicio).toLocaleDateString('en-CA') : null);

export function useAgenda(inicio: string, fim: string) {
  const qc = useQueryClient();
  const chave = ['agenda', inicio, fim];
  const q = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const [comp, tar] = await Promise.all([
        db.from('agenda_itens').select('*, cliente:clientes(nome)').eq('tipo', 'compromisso')
          .or(`and(data.gte.${inicio},data.lte.${fim}),and(inicio.gte.${inicio}T00:00:00-03:00,inicio.lte.${fim}T23:59:59-03:00)`)
          .order('inicio', { ascending: true, nullsFirst: true }),
        // Tarefas: as em aberto (todas) + as concluídas nos últimos 7 dias
        db.from('agenda_itens').select('*, cliente:clientes(nome)').eq('tipo', 'tarefa')
          .or(`concluida.eq.false,concluida_em.gte.${new Date(Date.now() - 30 * 86400000).toISOString()}`)
          .order('concluida').order('data', { ascending: true, nullsFirst: false }),
      ]);
      if (comp.error) throw comp.error;
      if (tar.error) throw tar.error;
      return { compromissos: (comp.data || []) as AgendaItem[], tarefas: (tar.data || []) as AgendaItem[] };
    },
    staleTime: 30_000,
  });

  const depois = () => { qc.invalidateQueries({ queryKey: ['agenda'] }); sincronizarGoogleEmSegundoPlano(); };

  const salvar = async (item: NovoAgendaItem & { id?: string }) => {
    const { id, ...dados } = item;
    const { error } = id
      ? await db.from('agenda_itens').update(dados).eq('id', id)
      : await db.from('agenda_itens').insert(dados);
    if (error) throw error;
    depois();
  };
  const excluir = async (id: string) => {
    const { error } = await db.from('agenda_itens').delete().eq('id', id);
    if (error) throw error;
    depois();
  };
  const alternarConcluida = async (t: AgendaItem) => {
    const { error } = await db.from('agenda_itens').update({ concluida: !t.concluida }).eq('id', t.id);
    if (error) throw error;
    depois();
  };

  return {
    compromissos: q.data?.compromissos ?? [],
    tarefas: q.data?.tarefas ?? [],
    isLoading: q.isLoading,
    salvar, excluir, alternarConcluida,
  };
}
