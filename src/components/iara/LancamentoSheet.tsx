// Janela de lançamento DENTRO da IARA (mesmas peças do Fluxo de caixa), sem sair da conversa.
// Dois usos:
//  - existente: abre um lançamento do banco pelo id, edita e salva na hora;
//  - proposta: ajusta um lançamento que a IARA preparou (ainda não salvo) e devolve para o card.
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { Chips, ContasPick, QuickDatas, ValorInput } from '@/components/fluxocaixa/formPecas';
import { FORMA_LABEL } from '@/components/fluxocaixa/lancamento';
import { Campo, ModalFooter, ModalHeader, Secao } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { fetchCategoriasByTipo } from '@/api/categorias';
import { useContas } from '@/hooks/useContas';
import { recalcularFatura } from '@/hooks/useFaturas';
import type { PropostaLancamento } from '@/hooks/useFinancialAdvisor';

type Tipo = 'receita' | 'despesa';
export type AlvoSheet =
  | { modo: 'existente'; id: string; tipo: Tipo }
  | { modo: 'proposta'; item: PropostaLancamento; onSalvar: (novo: PropostaLancamento) => void };

interface Form {
  tipo: Tipo; valor: number; descricao: string; venc: string; comp: string;
  categoria_id?: string; conta_id?: string; fornecedor: string; cliente_id?: string;
  forma?: string; efetivado: boolean; data_efetivo: string;
  fatura_id?: string | null; com_cobranca: boolean;
}

// Mesmas formas do Fluxo de caixa (cartão de crédito só pela conta do cartão).
const FORMAS = [
  { value: 'pix', label: 'PIX' }, { value: 'boleto', label: 'Boleto' }, { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'transferencia', label: 'Transferência' }, { value: 'dinheiro', label: 'Dinheiro' },
];

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function LancamentoSheet({ alvo, onClose }: { alvo: AlvoSheet | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { contas } = useContas();
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const tipo: Tipo = alvo ? (alvo.modo === 'existente' ? alvo.tipo : alvo.item.tipo) : 'despesa';

  const { data: categorias = [] } = useQuery({ queryKey: ['categorias-tipo', tipo], queryFn: () => fetchCategoriasByTipo(tipo), enabled: !!alvo });
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-nomes'], enabled: !!alvo,
    queryFn: async () => ((await supabase.from('clientes').select('id, nome, status').order('nome')).data || []) as { id: string; nome: string; status: string }[],
  });

  // Carrega o formulário.
  useEffect(() => {
    if (!alvo) { setForm(null); return; }
    if (alvo.modo === 'proposta') {
      const it = alvo.item;
      setForm({ tipo: it.tipo, valor: it.valor, descricao: it.descricao, venc: it.data, comp: it.data, categoria_id: it.categoria_id || undefined,
        conta_id: it.conta_id || undefined, fornecedor: it.fornecedor || '', forma: it.forma_pagamento || undefined,
        efetivado: !!it.quitado, data_efetivo: it.data, com_cobranca: false });
      return;
    }
    let vivo = true;
    (async () => {
      const ehRec = alvo.tipo === 'receita';
      const { data, error } = ehRec
        ? await supabase.from('receitas').select('*').eq('id', alvo.id).maybeSingle()
        : await supabase.from('despesas').select('*').eq('id', alvo.id).maybeSingle();
      if (!vivo) return;
      if (error || !data) { toast.error('Não achei esse lançamento.'); onClose(); return; }
      // deno-lint-ignore no-explicit-any
      const r = data as any;
      let comCobranca = false;
      if (ehRec) {
        const { data: cob } = await supabase.from('cobrancas').select('id').eq('receita_id', alvo.id).in('status', ['pendente', 'vencido']).limit(1);
        comCobranca = !!cob?.length;
      }
      if (!vivo) return;
      setForm({ tipo: alvo.tipo, valor: Number(r.valor), descricao: r.descricao || '', venc: r.data_vencimento, comp: r.data_competencia || r.data_vencimento,
        categoria_id: r.categoria_id || undefined, conta_id: r.conta_id || undefined, fornecedor: r.fornecedor || '', cliente_id: r.cliente_id || undefined,
        forma: r.forma_pagamento || undefined, efetivado: r.status === (ehRec ? 'recebido' : 'pago'),
        data_efetivo: (ehRec ? r.data_recebimento : r.data_pagamento) || hoje(), fatura_id: r.fatura_id ?? null, com_cobranca: comCobranca });
    })();
    return () => { vivo = false; };
  }, [alvo, onClose]);

  const contasPick = useMemo(() => (contas || []).filter((c) => c.ativa || c.id === form?.conta_id), [contas, form?.conta_id]);
  const ehCartao = !!form?.fatura_id || (contas || []).some((c) => c.id === form?.conta_id && c.tipo === 'cartao_credito');
  const rec = tipo === 'receita';
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  const salvar = async () => {
    if (!form || !alvo) return;
    if (!(form.valor > 0) || !form.descricao.trim()) { toast.error('Preencha valor e descrição.'); return; }
    if (alvo.modo === 'proposta') {
      const cat = categorias.find((c) => c.id === form.categoria_id);
      alvo.onSalvar({ ...alvo.item, valor: form.valor, descricao: form.descricao.trim(), data: form.venc, categoria_id: form.categoria_id || null,
        categoria_nome: cat?.nome || null, conta_id: form.conta_id || null, fornecedor: form.fornecedor.trim() || null,
        forma_pagamento: ehCartao ? 'cartao_credito' : form.forma || null, quitado: ehCartao ? false : form.efetivado });
      onClose();
      return;
    }
    setSalvando(true);
    try {
      const patch: Record<string, unknown> = { descricao: form.descricao.trim(), categoria_id: form.categoria_id || null, cliente_id: form.cliente_id || null };
      if (!rec) patch.fornecedor = form.fornecedor.trim() || null;
      if (!form.fatura_id) {
        patch.conta_id = form.conta_id || null;
        patch.forma_pagamento = form.forma || null;
        patch.data_competencia = form.comp;
      }
      // Cobrança aberta no Asaas: valor, vencimento e baixa vão pela cobrança (senão os dois ficam diferentes).
      if (!form.com_cobranca) {
        patch.valor = form.valor;
        if (!form.fatura_id) {
          patch.data_vencimento = form.venc;
          const colEf = rec ? 'data_recebimento' : 'data_pagamento';
          if (form.efetivado) { patch.status = rec ? 'recebido' : 'pago'; patch[colEf] = form.data_efetivo; }
          else { patch.status = form.venc < hoje() ? 'atrasado' : 'pendente'; patch[colEf] = null; }
        }
      }
      const { error } = rec
        ? await supabase.from('receitas').update(patch as never).eq('id', alvo.id)
        : await supabase.from('despesas').update(patch as never).eq('id', alvo.id);
      if (error) throw error;
      if (form.fatura_id) await recalcularFatura(form.fatura_id);
      toast.success('Lançamento salvo.');
      void qc.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error(`Não consegui salvar: ${e instanceof Error ? e.message : 'erro'}`);
    }
    setSalvando(false);
  };

  return (
    <Sheet open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[680px]')}>
        <SheetTitle className="sr-only">Editar lançamento</SheetTitle>
        <div className="flex max-h-[92dvh] flex-col md:max-h-[88dvh]">
          <ModalHeader
            eyebrow={<span className={`flex items-center gap-1.5 ${rec ? 'text-success-fg' : 'text-danger-fg'}`}><span className={`h-2 w-2 rounded-full ${rec ? 'bg-success-fg' : 'bg-danger-fg'}`} />{rec ? 'Receita' : 'Despesa'}</span>}
            title={alvo?.modo === 'proposta' ? 'Ajustar antes de lançar' : 'Editar lançamento'}
            onClose={onClose}
          />
          {!form ? (
            <div className="grid flex-1 place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-foreground-muted" /></div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              <Secao n={1} title="O quê">
                <Campo label="Valor" hint={form.com_cobranca ? 'Tem cobrança no Asaas: o valor muda pela cobrança (ou peça à IARA).' : undefined}>
                  {form.com_cobranca
                    ? <p className="flex h-14 items-center rounded-2xl bg-surface-2 px-4 font-heading text-[22px] font-semibold tabular-nums text-foreground-muted">R$ {form.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    : <ValorInput valor={form.valor} onChange={(n) => set({ valor: n })} tom={rec ? 'entrada' : 'saida'} />}
                </Campo>
                <Campo label="Descrição"><Input value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Campo>
              </Secao>

              {!form.fatura_id && (
                <Secao n={2} title="Quando">
                  <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                    {form.com_cobranca
                      ? <Campo label="Vencimento"><p className="flex h-11 items-center text-[14px] text-foreground-muted">{form.venc.split('-').reverse().join('/')}</p></Campo>
                      : <DatePickerField label="Vencimento" value={form.venc} onChange={(d) => set({ venc: d })} />}
                    {alvo?.modo === 'existente' && <DatePickerField label="Competência (mês do DRE)" value={form.comp} onChange={(d) => set({ comp: d })} />}
                  </div>
                  {!form.com_cobranca && <QuickDatas onSelect={(d) => set({ venc: d, comp: d })} />}
                </Secao>
              )}

              <Secao n={form.fatura_id ? 2 : 3} title="Quem e onde">
                {rec ? (
                  <Campo label="Cliente">
                    <select value={form.cliente_id || ''} onChange={(e) => set({ cliente_id: e.target.value || undefined })}
                      className="h-11 w-full rounded-xl border border-input bg-surface-2 px-3 text-[14px] text-foreground">
                      <option value="">Nenhum</option>
                      {clientes.filter((c) => c.status === 'ativo' || c.id === form.cliente_id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Campo>
                ) : (
                  <Campo label="Fornecedor"><Input value={form.fornecedor} onChange={(e) => set({ fornecedor: e.target.value })} /></Campo>
                )}
                <div>
                  <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Categoria</span>
                  <Chips opcoes={categorias.map((c) => ({ value: c.id, label: c.nome, color: c.cor }))} valor={form.categoria_id} onChange={(v) => set({ categoria_id: v })} />
                </div>
                {form.fatura_id ? (
                  <p className="flex gap-2 rounded-2xl bg-primary/[0.06] p-3 text-[12.5px] leading-snug text-foreground">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Item da fatura do cartão: conta e baixa seguem a fatura.
                  </p>
                ) : (
                  <>
                    <div>
                      <span className="mb-1.5 block text-[12.5px] text-foreground-muted">{rec ? 'Entra na conta' : 'Sai da conta'}</span>
                      <ContasPick contas={contasPick} valor={form.conta_id} onChange={(id) => set({ conta_id: id })} />
                    </div>
                    {!ehCartao && (
                      <div>
                        <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Forma de pagamento</span>
                        <Chips opcoes={FORMAS.map((o) => ({ value: o.value, label: FORMA_LABEL[o.value] ?? o.label }))}
                          valor={form.forma} onChange={(v) => set({ forma: v })} />
                      </div>
                    )}
                    {!ehCartao && !form.com_cobranca && (
                      <div className="space-y-2 rounded-2xl bg-surface-2/60 p-3">
                        <label className="flex items-center justify-between gap-3 text-[13.5px] text-foreground">
                          {rec ? 'Já recebido' : 'Já pago'}
                          <input type="checkbox" checked={form.efetivado} onChange={(e) => set({ efetivado: e.target.checked })} className="h-5 w-5 accent-[hsl(var(--primary))]" />
                        </label>
                        {form.efetivado && alvo?.modo === 'existente' && (
                          <DatePickerField label={rec ? 'Recebido em' : 'Pago em'} value={form.data_efetivo} onChange={(d) => set({ data_efetivo: d })} />
                        )}
                      </div>
                    )}
                  </>
                )}
              </Secao>
            </div>
          )}
          <ModalFooter>
            <button type="button" className={btn.outline} onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="button" className={btn.primary} onClick={salvar} disabled={salvando || !form}>
              {salvando ? 'Salvando…' : alvo?.modo === 'proposta' ? 'Usar estes dados' : 'Salvar'}
            </button>
          </ModalFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
