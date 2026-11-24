import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, parseISO } from 'date-fns';
import {
  AlertTriangle, Archive, ArchiveRestore, ArrowDownRight, ArrowUpRight, Check, ChevronDown, CreditCard, Landmark, MoreHorizontal,
  Pencil, PiggyBank, Plus, Scale, Trash2, TrendingUp,
} from 'lucide-react';
import { useActionParam } from '@/hooks/useActionParam';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Campo, ModalFooter, ModalHeader, ModalShell, PageHeader, Secao, Segmented } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { supabase } from '@/integrations/supabase/client';
import { useContas, type ContaDB, type ContaFormData } from '@/hooks/useContas';
import { useFaturas, type FaturaDB } from '@/hooks/useFaturas';
import { formatCurrency } from '@/utils/formatters';
import { CartaoCard } from '@/components/cartoes/CartaoCard';
import { CartaoFormDialog } from '@/components/cartoes/CartaoFormDialog';
import { FaturaDetailDialog } from '@/components/cartoes/FaturaDetailDialog';
import { PagarFaturaDialog } from '@/components/cartoes/PagarFaturaDialog';
import { CartaoCsvImportDialog } from '@/components/cartoes/CartaoCsvImportDialog';
import { getFaturaAtual } from '@/utils/faturaCalculator';
import { ConferirSaldoSheet } from '@/components/contas/ConferirSaldoSheet';
import { cn } from '@/lib/utils';
import { digitarMoeda, mostrarMoeda } from '@/lib/moeda';

const CONTA_TIPOS = [
  { value: 'corrente', label: 'Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
] as const;
type ContaTipoForm = (typeof CONTA_TIPOS)[number]['value'];

const CORES = ['#0B1226', '#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#EF4444', '#EC4899', '#06B6D4', '#F59E0B', '#64748B'];

const defaultFormData: ContaFormData = {
  nome: '',
  banco: '',
  tipo: 'corrente',
  saldo_inicial: 0,
  cor: '#3B82F6',
  ativa: true,
};

const tipoLabel = (t: string) => CONTA_TIPOS.find((x) => x.value === t)?.label ?? 'Conta';
const IconeConta = ({ tipo, className }: { tipo: string; className?: string }) =>
  tipo === 'investimento' ? <TrendingUp className={className} /> : tipo === 'poupanca' ? <PiggyBank className={className} /> : <Landmark className={className} />;

/** Entradas/saídas efetivadas no mês por conta + última conferência com o banco. */
function useMovimentoContas() {
  return useQuery({
    queryKey: ['contas-movimento-mes'],
    staleTime: 30_000,
    queryFn: async () => {
      const ini = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fim = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      const [rec, desp, conf] = await Promise.all([
        supabase.from('receitas').select('conta_id, valor').eq('status', 'recebido').gte('data_recebimento', ini).lte('data_recebimento', fim).not('conta_id', 'is', null),
        supabase.from('despesas').select('conta_id, valor').eq('status', 'pago').gte('data_pagamento', ini).lte('data_pagamento', fim).not('conta_id', 'is', null),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('conferencias_saldo').select('conta_id, created_at, diferenca').order('created_at', { ascending: false }).limit(200),
      ]);
      const mov = new Map<string, { entrou: number; saiu: number }>();
      const pegar = (id: string) => { const m = mov.get(id) || { entrou: 0, saiu: 0 }; mov.set(id, m); return m; };
      for (const r of (rec.data || []) as { conta_id: string; valor: number }[]) pegar(r.conta_id).entrou += Number(r.valor) || 0;
      for (const d of (desp.data || []) as { conta_id: string; valor: number }[]) pegar(d.conta_id).saiu += Number(d.valor) || 0;
      const ultima = new Map<string, { quando: string; bateu: boolean }>();
      for (const c of ((conf?.data || []) as { conta_id: string; created_at: string; diferenca: number }[])) {
        if (!ultima.has(c.conta_id)) ultima.set(c.conta_id, { quando: c.created_at, bateu: Math.abs(Number(c.diferenca)) < 0.01 });
      }
      return { mov, ultima };
    },
  });
}

export default function Contas() {
  const { contas, isLoading, createConta, updateConta, deleteConta, setContaArquivada, deleteCartao, countContaLinks, getBankAccounts, getCreditCards, refetch } = useContas();
  const { faturas, pagamentos, refetch: refetchFaturas } = useFaturas();
  const { data: movimento, refetch: refetchMovimento } = useMovimentoContas();

  const todasContasBancarias = getBankAccounts();
  // Arquivada = inativa: sai das listas e do saldo total, mas o histórico fica.
  const bankAccounts = todasContasBancarias.filter((c) => c.ativa);
  const contasArquivadas = todasContasBancarias.filter((c) => !c.ativa);
  const saldoContasAtivas = bankAccounts.reduce((s, c) => s + (c.saldo_atual || 0), 0);
  const creditCards = getCreditCards();

  const [tab, setTab] = useState<'contas' | 'cartoes'>('contas');
  // FAB "+" adaptativo à aba: em Cartões cria um cartão; em Contas, uma conta.
  useActionParam('novo', () => {
    if (tab === 'cartoes') { setEditingCartao(null); setIsCartaoFormOpen(true); }
    else handleOpenForm();
  });

  // Conta bancária state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaDB | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; conta: ContaDB | null; links: { receitas: number; despesas: number; transferencias: number } | null }>({ open: false, conta: null, links: null });
  const [formData, setFormData] = useState<ContaFormData>(defaultFormData);
  const [archiveConfirm, setArchiveConfirm] = useState<ContaDB | null>(null);
  const [verArquivadas, setVerArquivadas] = useState(false);
  // Conferir saldo com o banco (null = fechado; '' = sem conta escolhida)
  const [conferirConta, setConferirConta] = useState<string | null>(null);

  // Cartão state
  const [isCartaoFormOpen, setIsCartaoFormOpen] = useState(false);
  const [editingCartao, setEditingCartao] = useState<ContaDB | null>(null);
  const [detailCartao, setDetailCartao] = useState<ContaDB | null>(null);
  const [detailStartCreate, setDetailStartCreate] = useState(false);
  const [pagarState, setPagarState] = useState<{ cartao: ContaDB; fatura: FaturaDB } | null>(null);
  const [deleteCartaoConfirm, setDeleteCartaoConfirm] = useState<{ open: boolean; cartao: ContaDB | null }>({ open: false, cartao: null });
  const [csvImportCartao, setCsvImportCartao] = useState<ContaDB | null>(null);

  // Mapa de fatura atual por cartão
  const faturaAtualPorCartao = useMemo(() => {
    const map = new Map<string, FaturaDB | null>();
    creditCards.forEach(c => {
      map.set(c.id, getFaturaAtual(c, faturas));
    });
    return map;
  }, [creditCards, faturas]);

  // Limite USADO por cartão = soma do que está em aberto em TODAS as faturas
  // não pagas (parcelas futuras também ocupam limite).
  const usadoPorCartao = useMemo(() => {
    const map = new Map<string, number>();
    faturas.forEach((f) => {
      if (f.status === 'paga') return;
      const restante = Number(f.valor_total) - Number(f.valor_pago);
      map.set(f.cartao_id, (map.get(f.cartao_id) || 0) + Math.max(restante, 0));
    });
    return map;
  }, [faturas]);

  const handleOpenForm = (conta?: ContaDB) => {
    if (conta) {
      setEditingConta(conta);
      setFormData({
        nome: conta.nome,
        banco: conta.banco || '',
        tipo: conta.tipo,
        saldo_inicial: conta.saldo_inicial,
        cor: conta.cor,
        ativa: conta.ativa,
      });
    } else {
      setEditingConta(null);
      setFormData(defaultFormData);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) return;
    if (editingConta) await updateConta(editingConta.id, formData);
    else await createConta(formData);
    setIsFormOpen(false);
    setEditingConta(null);
    setFormData(defaultFormData);
    refetch();
  };

  const handleSubmitCartao = async (data: ContaFormData) => {
    if (editingCartao) await updateConta(editingCartao.id, data);
    else await createConta(data);
    setEditingCartao(null);
    refetch();
  };

  const handleArchive = async () => {
    if (!archiveConfirm) return;
    await setContaArquivada(archiveConfirm.id, true);
    setArchiveConfirm(null);
  };

  const handleAskDelete = async (conta: ContaDB) => {
    const links = await countContaLinks(conta.id);
    setDeleteConfirm({ open: true, conta, links });
  };

  const handleDelete = async () => {
    const conta = deleteConfirm.conta;
    const l = deleteConfirm.links;
    if (!conta) return;
    const temLancamentos = !!l && (l.receitas + l.despesas + l.transferencias) > 0;
    if (temLancamentos) {
      // Não exclui (há lançamentos): arquiva pra manter o histórico.
      await setContaArquivada(conta.id, true);
    } else {
      await deleteConta(conta.id);
    }
    setDeleteConfirm({ open: false, conta: null, links: null });
  };

  if (isLoading) {
    return (
      <main className="container py-6">
        <LoadingSpinner />
      </main>
    );
  }

  const totalCartoes = creditCards.reduce((sum, c) => {
    const f = faturaAtualPorCartao.get(c.id);
    return sum + (f ? Math.max(Number(f.valor_total) - Number(f.valor_pago), 0) : 0);
  }, 0);
  const livreCartoes = creditCards.reduce((s, c) => s + Math.max(Number(c.limite || 0) - (usadoPorCartao.get(c.id) || 0), 0), 0);

  const novoCartao = () => { setEditingCartao(null); setIsCartaoFormOpen(true); };
  const temLinks = !!deleteConfirm.links && (deleteConfirm.links.receitas + deleteConfirm.links.despesas + deleteConfirm.links.transferencias) > 0;

  return (
    <main className="container py-4 md:py-6">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <PageHeader
          eyebrow="Dinheiro"
          title="Contas e cartões"
          mobileAction={tab === 'contas' && bankAccounts.length > 0 ? (
            <button type="button" onClick={() => setConferirConta('')} aria-label="Conferir saldo com o banco" title="Conferir com o banco" className={btn.icon}><Scale className="h-4 w-4" /></button>
          ) : undefined}
        >
          {tab === 'contas' && bankAccounts.length > 0 && (
            <button type="button" onClick={() => setConferirConta('')} aria-label="Conferir saldo com o banco" className={cn(btn.outline, 'max-sm:hidden')}>
              <Scale className="h-4 w-4" /><span className="hidden sm:inline">Conferir com o banco</span>
            </button>
          )}
          <button type="button" onClick={() => (tab === 'contas' ? handleOpenForm() : novoCartao())} className={cn(btn.primary, 'max-sm:hidden')}>
            <Plus className="h-4 w-4" />{tab === 'contas' ? 'Nova conta' : 'Novo cartão'}
          </button>
        </PageHeader>

        {/* resumo = abas */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="tablist">
          {([
            ['contas', <PiggyBank key="p" className="h-4 w-4" />, `Contas · ${bankAccounts.length}`, saldoContasAtivas, 'saldo somado de hoje'],
            ['cartoes', <CreditCard key="c" className="h-4 w-4" />, `Cartões · ${creditCards.length}`, totalCartoes, creditCards.length ? `em faturas abertas · ${formatCurrency(livreCartoes)} de limite livre` : 'nenhum cartão cadastrado'],
          ] as const).map(([v, ic, rot, valor, sub]) => {
            const on = tab === v;
            return (
              <button key={v} type="button" role="tab" aria-selected={on} onClick={() => setTab(v)} className={cn('rounded-[22px] border p-4 text-left transition-colors', on ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface hover:border-border-strong')}>
                <span className={cn('flex items-center gap-2 text-[13px]', on ? 'text-background/70' : 'text-foreground-muted')}>{ic}{rot}</span>
                <span className="mt-1 block font-heading text-[26px] font-semibold tabular-nums tracking-[-0.02em]">{formatCurrency(valor)}</span>
                <span className={cn('text-[12px]', on ? 'text-background/60' : 'text-foreground-muted')}>{sub}</span>
              </button>
            );
          })}
        </div>

        {tab === 'contas' ? (
          <>
            {bankAccounts.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
                <p className="text-[15px] text-foreground">Nenhuma conta cadastrada</p>
                <p className="mt-1 text-[13px] text-foreground-muted">Cadastre a conta do banco com o saldo de hoje para começar.</p>
                <button type="button" onClick={() => handleOpenForm()} className={cn(btn.primary, 'mt-4')}><Plus className="h-4 w-4" />Nova conta</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {bankAccounts.map((c) => {
                  const m = movimento?.mov.get(c.id);
                  const conf = movimento?.ultima.get(c.id);
                  const dias = conf ? differenceInCalendarDays(new Date(), parseISO(conf.quando)) : null;
                  return (
                    <div key={c.id} className="rounded-[24px] border border-border bg-surface p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: c.cor }}><IconeConta tipo={c.tipo} className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[15.5px] font-semibold text-foreground">{c.nome}</span><span className="block truncate text-[12.5px] text-foreground-muted">{[c.banco, tipoLabel(c.tipo)].filter(Boolean).join(' · ')}</span></span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" aria-label={`Opções de ${c.nome}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><MoreHorizontal className="h-4 w-4" /></button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-52 rounded-2xl border border-border bg-surface p-1.5">
                            <button type="button" onClick={() => handleOpenForm(c)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><Pencil className="h-4 w-4 text-foreground-muted" />Editar conta</button>
                            <button type="button" onClick={() => setConferirConta(c.id)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><Scale className="h-4 w-4 text-foreground-muted" />Conferir com o banco</button>
                            <button type="button" onClick={() => setArchiveConfirm(c)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><Archive className="h-4 w-4 text-foreground-muted" />Arquivar</button>
                            <div className="my-1 h-px bg-border" />
                            <button type="button" onClick={() => handleAskDelete(c)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-danger-fg hover:bg-danger-bg"><Trash2 className="h-4 w-4" />Excluir</button>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="mt-4 text-[12px] text-foreground-muted">Saldo hoje</p>
                      <p className={cn('font-heading text-[28px] font-semibold tabular-nums tracking-[-0.03em]', (c.saldo_atual || 0) < 0 ? 'text-danger-fg' : 'text-foreground')}>{formatCurrency(c.saldo_atual || 0)}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                        <span className="flex items-center gap-1 text-success-fg"><ArrowUpRight className="h-3.5 w-3.5" />{formatCurrency(m?.entrou || 0)}</span>
                        <span className="flex items-center gap-1 text-danger-fg"><ArrowDownRight className="h-3.5 w-3.5" />{formatCurrency(m?.saiu || 0)}</span>
                        <span className="text-foreground-subtle">no mês</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                        {dias === null
                          ? <span className="flex items-center gap-1.5 text-[12px] text-warning-fg"><AlertTriangle className="h-3.5 w-3.5" />nunca conferida</span>
                          : !conf?.bateu || dias > 7
                            ? <span className="flex items-center gap-1.5 text-[12px] text-warning-fg"><AlertTriangle className="h-3.5 w-3.5" />{conf?.bateu ? `conferida há ${dias} dias` : `diferença na conferência de ${format(parseISO(conf!.quando), 'dd/MM')}`}</span>
                            : <span className="flex items-center gap-1.5 text-[12px] text-success-fg"><Check className="h-3.5 w-3.5" />{dias === 0 ? 'conferida hoje' : `conferida há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</span>}
                        <button type="button" onClick={() => setConferirConta(c.id)} className={btn.mini}>Conferir</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contas arquivadas: fora das seleções e do saldo total; histórico preservado */}
            {contasArquivadas.length > 0 && (
              <div className="space-y-2">
                <button type="button" onClick={() => setVerArquivadas((v) => !v)} className="flex items-center gap-1.5 text-[13px] text-foreground-muted hover:text-foreground">
                  <Archive className="h-4 w-4" />Contas arquivadas ({contasArquivadas.length}) <ChevronDown className={cn('h-4 w-4 transition-transform', verArquivadas && 'rotate-180')} />
                </button>
                {verArquivadas && (
                  <>
                    <p className="text-[12px] text-foreground-muted">Não aparecem na seleção de conta dos lançamentos nem no saldo total. Os lançamentos antigos continuam nos relatórios.</p>
                    {contasArquivadas.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white opacity-70" style={{ background: c.cor }}><IconeConta tipo={c.tipo} className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] text-foreground">{c.nome}</span><span className="block truncate text-[12px] text-foreground-muted">{[c.banco, `saldo ${formatCurrency(c.saldo_atual || 0)}`].filter(Boolean).join(' · ')}</span></span>
                        <button type="button" onClick={() => setContaArquivada(c.id, false)} className={cn(btn.mini, 'inline-flex items-center gap-1.5')}><ArchiveRestore className="h-3.5 w-3.5" />Reativar</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        ) : creditCards.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
            <p className="text-[15px] text-foreground">Nenhum cartão cadastrado</p>
            <p className="mt-1 text-[13px] text-foreground-muted">Cadastre o cartão para acompanhar faturas, parcelas e limite.</p>
            <button type="button" onClick={novoCartao} className={cn(btn.primary, 'mt-4')}><Plus className="h-4 w-4" />Novo cartão</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {creditCards.map(cartao => (
              <CartaoCard
                key={cartao.id}
                cartao={cartao}
                faturaAtual={faturaAtualPorCartao.get(cartao.id) || null}
                usado={usadoPorCartao.get(cartao.id) ?? 0}
                onEdit={() => { setEditingCartao(cartao); setIsCartaoFormOpen(true); }}
                onImportCsv={() => setCsvImportCartao(cartao)}
                onDelete={() => setDeleteCartaoConfirm({ open: true, cartao })}
                onLancamentos={() => { setDetailStartCreate(false); setDetailCartao(cartao); }}
                onNovoLancamento={() => { setDetailStartCreate(true); setDetailCartao(cartao); }}
                onPagar={() => {
                  const f = faturaAtualPorCartao.get(cartao.id);
                  if (f) setPagarState({ cartao, fatura: f });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <ConferirSaldoSheet
        open={conferirConta !== null}
        onOpenChange={(v) => { if (!v) { setConferirConta(null); refetchMovimento(); } }}
        contas={bankAccounts}
        contaInicial={conferirConta || null}
        onAjustado={() => refetch()}
      />

      {/* Conta bancária: criar / editar */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          <ModalShell>
            <ModalHeader eyebrow="Cadastro" title={editingConta ? 'Editar conta' : 'Nova conta'} onClose={() => setIsFormOpen(false)} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: formData.cor }}><IconeConta tipo={formData.tipo} className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block truncate text-[15px] font-semibold text-foreground">{formData.nome || 'Conta'}</span><span className="block truncate text-[12px] text-foreground-muted">{[formData.banco, tipoLabel(formData.tipo)].filter(Boolean).join(' · ')}</span></span>
              </div>
              <Secao n={1} title="Identificação">
                <Campo label="Nome da conta"><Input value={formData.nome} onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Ex.: Inter PJ" /></Campo>
                <Campo label="Banco"><Input value={formData.banco || ''} onChange={(e) => setFormData(p => ({ ...p, banco: e.target.value }))} placeholder="Ex.: Inter" /></Campo>
                <Campo label="Tipo">
                  <Segmented<ContaTipoForm> value={(CONTA_TIPOS.some((t) => t.value === formData.tipo) ? formData.tipo : 'corrente') as ContaTipoForm} onChange={(v) => setFormData(p => ({ ...p, tipo: v }))} opts={CONTA_TIPOS.map((t) => [t.value, t.label])} />
                </Campo>
              </Secao>
              <Secao n={2} title="Saldo e aparência">
                <Campo label="Saldo inicial" hint="É o ponto de partida: os lançamentos efetivados somam e subtraem a partir dele.">
                  <div className="flex h-10 items-center rounded-xl border border-input bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-ring">
                    <span className="mr-1 text-foreground-muted">R$</span>
                    <input type="text" inputMode="numeric" value={`${(formData.saldo_inicial || 0) < 0 ? '-' : ''}${mostrarMoeda(Math.abs(formData.saldo_inicial || 0))}`} placeholder="0,00"
                      onChange={(e) => setFormData(p => ({ ...p, saldo_inicial: digitarMoeda(e.target.value, true) }))} className="min-w-0 flex-1 bg-transparent font-semibold tabular-nums outline-none" />
                  </div>
                </Campo>
                <div>
                  <p className="mb-2 text-[12.5px] text-foreground-muted">Cor</p>
                  <div className="flex flex-wrap gap-2">
                    {CORES.map(cor => (
                      <button key={cor} type="button" aria-label={`Cor ${cor}`}
                        className={cn('no-touch-min h-9 w-9 rounded-full transition-transform', formData.cor === cor ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : 'hover:scale-105')}
                        style={{ backgroundColor: cor }} onClick={() => setFormData(p => ({ ...p, cor }))} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3.5 py-3">
                  <span><span className="block text-[14px] text-foreground">Conta ativa</span><span className="block text-[12px] text-foreground-muted">Desligada = arquivada (some das seleções, histórico mantido)</span></span>
                  <Switch checked={formData.ativa} onCheckedChange={(c) => setFormData(p => ({ ...p, ativa: c }))} />
                </div>
              </Secao>
            </div>
            <ModalFooter left={editingConta ? <button type="button" onClick={() => { setIsFormOpen(false); handleAskDelete(editingConta); }} className={btn.danger}><Trash2 className="h-4 w-4" />Excluir</button> : undefined}>
              <button type="button" className={btn.outline} onClick={() => setIsFormOpen(false)}>Cancelar</button>
              <button type="button" className={btn.primary} onClick={handleSubmit} disabled={!formData.nome.trim()}>{editingConta ? 'Salvar' : 'Criar conta'}</button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      {/* Cartão dialogs */}
      <CartaoFormDialog
        open={isCartaoFormOpen}
        onOpenChange={setIsCartaoFormOpen}
        cartao={editingCartao}
        contasBancarias={bankAccounts}
        onSubmit={handleSubmitCartao}
      />

      {detailCartao && (
        <FaturaDetailDialog
          open={!!detailCartao}
          onOpenChange={(o) => { if (!o) { setDetailCartao(null); setDetailStartCreate(false); } }}
          cartao={detailCartao}
          faturas={faturas}
          pagamentos={pagamentos}
          contas={contas}
          startInCreate={detailStartCreate}
          usado={usadoPorCartao.get(detailCartao.id) ?? 0}
          onRefresh={async () => { await refetchFaturas(); refetch(); }}
          onPagar={(f) => { setPagarState({ cartao: detailCartao, fatura: f }); }}
        />
      )}

      {pagarState && (
        <PagarFaturaDialog
          open={!!pagarState}
          onOpenChange={(o) => { if (!o) { setPagarState(null); refetchFaturas(); refetch(); refetchMovimento(); } }}
          cartao={pagarState.cartao}
          fatura={pagarState.fatura}
          contasBancarias={bankAccounts}
        />
      )}

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => { if (!open) setArchiveConfirm(null); }}
        onConfirm={handleArchive}
        title="Arquivar conta"
        description={archiveConfirm ? (
          `"${archiveConfirm.nome}" deixa de aparecer na seleção de conta dos lançamentos e no saldo total. Nada é apagado: os lançamentos antigos continuam nos relatórios e dá pra reativar em Contas → Arquivadas.`
          + (Math.abs(archiveConfirm.saldo_atual || 0) >= 0.01
            ? ` Atenção: ela tem saldo de ${formatCurrency(archiveConfirm.saldo_atual || 0)} — esse valor deixa de somar no saldo total. Se o dinheiro foi para outra conta, registre uma transferência antes.`
            : '')
        ) : ''}
        confirmLabel="Arquivar"
        variant="default"
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, conta: open ? deleteConfirm.conta : null, links: open ? deleteConfirm.links : null })}
        onConfirm={handleDelete}
        title={temLinks ? 'Arquivar conta' : 'Excluir conta'}
        description={(() => {
          const l = deleteConfirm.links;
          const nome = deleteConfirm.conta?.nome ?? '';
          if (!l) return `Excluir "${nome}"?`;
          const total = l.receitas + l.despesas + l.transferencias;
          if (total === 0) return `Excluir "${nome}"? Esta ação não pode ser desfeita.`;
          const partes = [
            l.receitas > 0 ? `${l.receitas} receita(s)` : null,
            l.despesas > 0 ? `${l.despesas} despesa(s)` : null,
            l.transferencias > 0 ? `${l.transferencias} transferência(s)` : null,
          ].filter(Boolean).join(', ');
          return `"${nome}" possui ${partes} e não pode ser excluída. Você pode arquivá-la: ela sai das listas de seleção (novos lançamentos), mas o histórico é preservado. Dá pra reativar depois editando a conta.`;
        })()}
        confirmLabel={temLinks ? 'Arquivar' : 'Excluir'}
        variant={temLinks ? 'default' : 'destructive'}
      />

      <ConfirmDialog
        open={deleteCartaoConfirm.open}
        onOpenChange={(open) => setDeleteCartaoConfirm({ open, cartao: deleteCartaoConfirm.cartao })}
        onConfirm={async () => {
          if (deleteCartaoConfirm.cartao) {
            await deleteCartao(deleteCartaoConfirm.cartao.id);
            setDeleteCartaoConfirm({ open: false, cartao: null });
          }
        }}
        title="Excluir cartão de crédito"
        description={`Excluir "${deleteCartaoConfirm.cartao?.nome}" e TODOS os lançamentos, faturas e pagamentos vinculados? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir tudo"
        variant="destructive"
      />

      {csvImportCartao && (
        <CartaoCsvImportDialog
          open={!!csvImportCartao}
          onOpenChange={(o) => { if (!o) setCsvImportCartao(null); }}
          cartao={csvImportCartao}
          onImportComplete={() => { refetch(); refetchFaturas(); }}
        />
      )}
    </main>
  );
}
