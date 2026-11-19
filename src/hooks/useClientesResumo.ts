import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getValorMensalEquivalente, isContratoAtivoHoje, type ContratoBase } from '@/utils/contractUtils';

/** Contrato resumido para a ficha do cliente. */
export interface ContratoResumo {
  id: string;
  descricao: string;
  valor: number;
  valorMensal: number;
  recorrencia: string;
  dia_vencimento: number | null;
}

/** Lançamento a receber resumido (ficha do cliente). */
export interface ReceitaResumo {
  id: string;
  descricao: string;
  valor: number;
  status: 'pendente' | 'recebido' | 'atrasado';
  data_vencimento: string;
  data_recebimento: string | null;
}

/** Números de um cliente usados nos cartões e na ficha. */
export interface ClienteNumeros {
  mrr: number;
  aberto: number;
  atrasado: number;
  recebidoAno: number;
  ultimoPagamento: string | null;
  contratos: ContratoResumo[];
  recentes: ReceitaResumo[];
}

const VAZIO: ClienteNumeros = { mrr: 0, aberto: 0, atrasado: 0, recebidoAno: 0, ultimoPagamento: null, contratos: [], recentes: [] };

/**
 * MRR (contratos ativos hoje, valor mensal equivalente), em aberto, atrasado,
 * recebido no ano e último pagamento de cada cliente. RLS já limita ao tenant.
 */
export function useClientesResumo() {
  const query = useQuery({
    queryKey: ['clientes-resumo'],
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: contratos }, { data: receitas }] = await Promise.all([
        supabase.from('contratos').select('*'),
        supabase.from('receitas').select('id, cliente_id, descricao, valor, status, data_vencimento, data_recebimento').not('cliente_id', 'is', null),
      ]);
      const anoAtual = String(new Date().getFullYear());
      const mapa = new Map<string, ClienteNumeros>();
      const pegar = (id: string) => {
        let n = mapa.get(id);
        if (!n) { n = { ...VAZIO, contratos: [], recentes: [] }; mapa.set(id, n); }
        return n;
      };

      for (const c of (contratos || []) as (ContratoBase & { cliente_id: string; descricao: string; valor: number; recorrencia: string; dia_vencimento: number | null })[]) {
        if (!c.cliente_id || !isContratoAtivoHoje(c)) continue;
        const valorMensal = getValorMensalEquivalente(Number(c.valor), c.recorrencia);
        const n = pegar(c.cliente_id);
        n.mrr += valorMensal;
        n.contratos.push({ id: c.id, descricao: c.descricao, valor: Number(c.valor), valorMensal, recorrencia: c.recorrencia, dia_vencimento: c.dia_vencimento });
      }

      const porCliente = new Map<string, ReceitaResumo[]>();
      for (const r of (receitas || []) as (ReceitaResumo & { cliente_id: string })[]) {
        const n = pegar(r.cliente_id);
        const v = Number(r.valor) || 0;
        if (r.status === 'pendente') n.aberto += v;
        else if (r.status === 'atrasado') n.atrasado += v;
        else if (r.status === 'recebido') {
          if (r.data_recebimento?.startsWith(anoAtual)) n.recebidoAno += v;
          if (r.data_recebimento && (!n.ultimoPagamento || r.data_recebimento > n.ultimoPagamento)) n.ultimoPagamento = r.data_recebimento;
        }
        const l = porCliente.get(r.cliente_id) || [];
        l.push({ ...r, valor: v });
        porCliente.set(r.cliente_id, l);
      }
      porCliente.forEach((l, id) => {
        pegar(id).recentes = l.sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento)).slice(0, 6);
      });
      return mapa;
    },
  });

  const dados = query.data;
  const numeros = useCallback((id: string): ClienteNumeros => dados?.get(id) ?? VAZIO, [dados]);
  return { numeros, isLoading: query.isLoading };
}
