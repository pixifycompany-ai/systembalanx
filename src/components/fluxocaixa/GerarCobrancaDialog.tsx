// Gera cobrança(s) no Asaas a partir de lançamento(s) de receita já existentes.
// Se o lançamento é parcelado (recurrence_group_id), lista as demais parcelas em
// aberto e já deixa marcadas a atual e as próximas.
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Receipt } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Campo, ModalFooter, ModalHeader, ModalShell, Secao } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';

const FORMAS = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

interface Parcela {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  temCobranca: boolean;
}

interface Props {
  transacao: TransacaoUnificada | null;
  contas: { id: string; nome: string; tipo?: string; ativa?: boolean }[];
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const hojeISO = () => format(new Date(), 'yyyy-MM-dd');

export function GerarCobrancaDialog({ transacao: t, contas, onOpenChange, onDone }: Props) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [forma, setForma] = useState('UNDEFINED');
  const [contaId, setContaId] = useState<string>('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const contasRecebimento = useMemo(
    () => contas.filter((c) => c.tipo !== 'cartao_credito' && c.ativa !== false),
    [contas],
  );

  // Carrega o lançamento (e as parcelas irmãs, se for parcelado) + quais já têm cobrança.
  useEffect(() => {
    if (!t) return;
    let cancel = false;
    (async () => {
      setCarregando(true);
      setForma('UNDEFINED');
      setContaId(t.conta_id || '');
      let q = supabase
        .from('receitas')
        .select('id, descricao, valor, data_vencimento, status')
        .in('status', ['pendente', 'atrasado'])
        .order('data_vencimento', { ascending: true });
      q = t.recurrence_group_id ? q.eq('recurrence_group_id', t.recurrence_group_id) : q.eq('id', t.id);
      const { data: recs } = await q;
      const lista = (recs || []) as Omit<Parcela, 'temCobranca'>[];
      const ids = lista.map((r) => r.id);
      // `cobrancas` não está nos tipos gerados do Supabase (mesmo padrão do resto do app).
      const { data: cobs } = ids.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await (supabase as any).from('cobrancas').select('receita_id, status').in('receita_id', ids)
        : { data: [] };
      const comCobranca = new Set(
        ((cobs || []) as { receita_id: string; status: string }[])
          .filter((c) => !['cancelado', 'estornado'].includes(c.status))
          .map((c) => c.receita_id),
      );
      const todas: Parcela[] = lista.map((r) => ({ ...r, valor: Number(r.valor), temCobranca: comCobranca.has(r.id) }));
      // Pré-seleção: a parcela clicada + as próximas, sem cobrança ainda.
      const pre = new Set(
        todas.filter((p) => !p.temCobranca && (p.id === t.id || p.data_vencimento >= t.data_vencimento)).map((p) => p.id),
      );
      if (!cancel) {
        setParcelas(todas);
        setSelecionadas(pre);
        setCarregando(false);
      }
    })();
    return () => { cancel = true; };
  }, [t]);

  if (!t) return null;

  const semCliente = !t.cliente_id;
  const elegiveis = parcelas.filter((p) => !p.temCobranca);
  const escolhidas = parcelas.filter((p) => selecionadas.has(p.id));
  const total = escolhidas.reduce((s, p) => s + p.valor, 0);
  const hoje = hojeISO();
  const ajustadas = escolhidas.filter((p) => p.data_vencimento < hoje).length;
  const parcelado = parcelas.length > 1;

  const toggle = (id: string) =>
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const gerar = async () => {
    if (!escolhidas.length) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-cobranca', {
        body: {
          action: 'criar-de-receitas',
          receita_ids: escolhidas.map((p) => p.id),
          forma_pagamento: forma,
          conta_id: contaId || null,
        },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          const b = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
          if (b?.error) msg = b.error;
        } catch { /* mantém msg */ }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const n = (data as { criadas?: number })?.criadas ?? escolhidas.length;
      toast.success(n > 1 ? `${n} cobranças criadas no Asaas!` : 'Cobrança criada no Asaas!', {
        description: 'Já aparecem em Cobranças, prontas para enviar.',
      });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar cobrança');
    } finally {
      setEnviando(false);
    }
  };

  const formaLabel = FORMAS.find((f) => f.value === forma)?.label ?? '';
  const contaLabel = contaId ? (contasRecebimento.find((c) => c.id === contaId)?.nome ?? '—') : 'a do lançamento';

  return (
    <Sheet open={!!t} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[860px]')}>
        <SheetTitle className="sr-only">Gerar cobrança no Asaas</SheetTitle>
        <ModalShell>
          <ModalHeader
            eyebrow={t.cliente?.nome ? `Para ${t.cliente.nome} · a partir deste lançamento` : 'A partir deste lançamento'}
            title="Gerar cobrança no Asaas"
            onClose={() => onOpenChange(false)}
          />

          {semCliente ? (
            <div className="p-4 md:p-5">
              <p className="rounded-2xl bg-warning-bg p-4 text-[13.5px] text-warning-fg">
                Este lançamento não tem cliente. Edite o lançamento e vincule um cliente para gerar a cobrança.
              </p>
            </div>
          ) : carregando ? (
            <div className="flex items-center justify-center py-16 text-[13.5px] text-foreground-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando lançamentos…
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3 p-4 md:p-5">
                <Secao
                  n={1}
                  title={parcelado ? 'Parcelas em aberto' : 'Lançamento'}
                  extra={parcelado && elegiveis.length > 1 ? (
                    <button
                      type="button"
                      className="text-[12px] text-foreground-muted hover:text-foreground"
                      onClick={() => setSelecionadas(selecionadas.size === elegiveis.length ? new Set() : new Set(elegiveis.map((p) => p.id)))}
                    >
                      {selecionadas.size === elegiveis.length ? 'Desmarcar todas' : 'Marcar todas'}
                    </button>
                  ) : undefined}
                >
                  <div className="max-h-[280px] divide-y divide-border overflow-y-auto rounded-2xl border border-border">
                    {parcelas.map((p) => (
                      <label key={p.id} className={cn('flex items-center gap-3 px-3.5 py-3', p.temCobranca ? 'opacity-55' : 'cursor-pointer hover:bg-surface-2/60')}>
                        <Checkbox checked={selecionadas.has(p.id)} disabled={p.temCobranca} onCheckedChange={() => toggle(p.id)} aria-label={`Selecionar ${p.descricao}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-foreground">{p.descricao}</span>
                          <span className="block text-[12px] text-foreground-muted">
                            vence {format(parseISO(p.data_vencimento), 'dd/MM/yyyy')}
                            {p.temCobranca ? ' · já tem cobrança' : p.data_vencimento < hoje ? ' · vencido (vai para hoje)' : ''}
                          </span>
                        </span>
                        <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(p.valor)}</span>
                      </label>
                    ))}
                    {parcelas.length === 0 && <p className="p-3.5 text-[13.5px] text-foreground-muted">Nenhum lançamento em aberto para cobrar.</p>}
                  </div>
                </Secao>

                <Secao n={2} title="Pagamento">
                  <Campo label="Forma de pagamento">
                    <div className="flex flex-wrap gap-1.5">
                      {FORMAS.map((f) => (
                        <button key={f.value} type="button" onClick={() => setForma(f.value)} aria-pressed={forma === f.value}
                          className={cn('h-8 rounded-full border px-3 text-[12.5px] transition-colors', forma === f.value ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-surface-2')}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </Campo>
                  <Campo label="Recebe na conta">
                    <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={campoCls}>
                      <option value="">Manter a do lançamento</option>
                      {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Campo>
                  {ajustadas > 0 && (
                    <p className="text-[12px] text-foreground-muted">
                      {ajustadas === 1 ? '1 lançamento vencido terá' : `${ajustadas} lançamentos vencidos terão`} vencimento hoje — o Asaas não aceita data retroativa.
                    </p>
                  )}
                </Secao>
              </div>

              <aside className="border-t border-border bg-surface p-5 md:border-l md:border-t-0">
                <div className="space-y-4 md:sticky md:top-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">Resumo</p>
                  <div>
                    <p className="font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(total)}</p>
                    <p className="text-[13px] text-foreground-muted">{escolhidas.length === 1 ? '1 cobrança' : `${escolhidas.length} cobranças`}</p>
                  </div>
                  <dl className="space-y-2.5 text-[13px]">
                    <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Forma</dt><dd className="text-right text-foreground">{formaLabel}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Conta</dt><dd className="truncate text-right text-foreground">{contaLabel}</dd></div>
                  </dl>
                  <div className="rounded-2xl bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground-muted">
                    <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Receipt className="h-3.5 w-3.5 text-primary" /> O que acontece</p>
                    O Asaas gera o link de pagamento de cada lançamento, ele aparece em Cobranças pronto para enviar e, quando o cliente pagar, a baixa é automática.
                  </div>
                </div>
              </aside>
            </div>
          )}

          <ModalFooter left={<Link to="/cobrancas" className="text-[13px] text-foreground-muted hover:text-foreground">Ver cobranças</Link>}>
            <button type="button" onClick={() => onOpenChange(false)} className={btn.outline}>Cancelar</button>
            <button type="button" onClick={gerar} disabled={semCliente || carregando || enviando || escolhidas.length === 0} className={btn.primary}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              {escolhidas.length > 1 ? `Gerar ${escolhidas.length} cobranças` : 'Gerar cobrança'}
            </button>
          </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}
