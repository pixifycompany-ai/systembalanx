import { useMemo, useState } from 'react';
import { useActionParam } from '@/hooks/useActionParam';
import { IconButton } from '@/components/shared/IconButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useContas, type ContaDB, type ContaFormData } from '@/hooks/useContas';
import { useFaturas, type FaturaDB } from '@/hooks/useFaturas';
import { formatCurrency } from '@/utils/formatters';
import { Plus, Pencil, Trash2, Building2, Archive, ArchiveRestore } from 'lucide-react';
import { BuildingLibraryIcon, CreditCardIcon, HomeIcon } from '@heroicons/react/24/outline';
import { HeroStatCard } from '@/components/shared/HeroStatCard';
import { SectionCard } from '@/components/shared/SectionCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { CartaoCard } from '@/components/cartoes/CartaoCard';
import { CartaoFormDialog } from '@/components/cartoes/CartaoFormDialog';
import { FaturaDetailDialog } from '@/components/cartoes/FaturaDetailDialog';
import { PagarFaturaDialog } from '@/components/cartoes/PagarFaturaDialog';
import { CartaoCsvImportDialog } from '@/components/cartoes/CartaoCsvImportDialog';
import { getFaturaAtual } from '@/utils/faturaCalculator';

const CONTA_TIPOS = [
  { value: 'corrente', label: 'Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
] as const;

const CORES = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const defaultFormData: ContaFormData = {
  nome: '',
  banco: '',
  tipo: 'corrente',
  saldo_inicial: 0,
  cor: '#3B82F6',
  ativa: true,
};

export default function Contas() {
  const { contas, isLoading, createConta, updateConta, deleteConta, setContaArquivada, deleteCartao, countContaLinks, getBankAccounts, getCreditCards, refetch } = useContas();
  const { faturas, pagamentos, refetch: refetchFaturas } = useFaturas();

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
  // não pagas (parcelas futuras também ocupam limite). Derivado das faturas
  // (mesma fonte do card) → consistente e atualiza ao pagar/lançar.
  const usadoPorCartao = useMemo(() => {
    const map = new Map<string, number>();
    faturas.forEach((f: any) => {
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
        tipo: conta.tipo as any,
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

  const novoCartao = () => { setEditingCartao(null); setIsCartaoFormOpen(true); };

  // Mobile: contas agrupadas por tipo (corrente / poupança / investimento), com total do grupo.
  const gruposContas = CONTA_TIPOS
    .map((t) => {
      const itens = bankAccounts.filter((c) => c.tipo === t.value);
      return { key: t.value as string, label: t.label as string, itens, total: itens.reduce((s, c) => s + (c.saldo_atual || 0), 0) };
    })
    .concat((() => {
      const outros = bankAccounts.filter((c) => !CONTA_TIPOS.some((t) => t.value === c.tipo));
      return [{ key: 'outros', label: 'Outras', itens: outros, total: outros.reduce((s, c) => s + (c.saldo_atual || 0), 0) }];
    })())
    .filter((g) => g.itens.length > 0);

  return (
    <main className="container py-4 md:py-6">
      <MobilePageHeader
        eyebrow="Sistema"
        title={tab === 'contas' ? 'Contas' : 'Cartões'}
        actions={
          tab === 'contas' ? (
            <Button onClick={() => handleOpenForm()} aria-label="Nova Conta Bancária">
              <Plus className="h-4 w-4" />Nova conta
            </Button>
          ) : (
            <Button onClick={novoCartao} aria-label="Novo Cartão de Crédito">
              <Plus className="h-4 w-4" />Novo cartão
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'contas' | 'cartoes')}>
        <TabsList className="grid w-full grid-cols-2 md:inline-grid md:w-auto">
          <TabsTrigger value="contas" className="gap-1.5 md:px-6">
            <BuildingLibraryIcon className="h-[15px] w-[15px]" />Contas
          </TabsTrigger>
          <TabsTrigger value="cartoes" className="gap-1.5 md:px-6">
            <CreditCardIcon className="h-[15px] w-[15px]" />Cartões
          </TabsTrigger>
        </TabsList>

        {/* TAB CONTAS BANCÁRIAS */}
        <TabsContent value="contas" className="mt-4 space-y-4 md:mt-6 md:space-y-6">
          <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            <HeroStatCard
              eyebrow="Saldo total em contas"
              value={saldoContasAtivas}
              subtitle={`${bankAccounts.length} ${bankAccounts.length === 1 ? 'conta ativa' : 'contas ativas'}`}
              className="md:col-span-2 xl:col-span-1 [&>div]:h-full"
            />

            {/* DESKTOP: cartões lisos em grid */}
            {bankAccounts.map((conta) => (
              <div
                key={conta.id}
                className={cn(
                  'hidden flex-col rounded-[20px] border border-border bg-surface p-5 transition-colors hover:border-border-strong md:flex md:rounded-3xl',
                  !conta.ativa && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"
                    style={{ background: `color-mix(in srgb, ${conta.cor} 16%, transparent)`, color: conta.cor }}
                  >
                    <Building2 className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">{conta.nome}</p>
                    <p className="truncate text-[12px] text-foreground-muted">
                      {[conta.banco, CONTA_TIPOS.find(t => t.value === conta.tipo)?.label].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="-mr-1.5 -mt-1 flex shrink-0 gap-0.5">
                    <IconButton label="Editar conta" tooltipSide="top" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => handleOpenForm(conta)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Arquivar conta" tooltipSide="top" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setArchiveConfirm(conta)}>
                      <Archive className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Excluir conta" tooltipSide="top" variant="danger-ghost" className="h-8 w-8 rounded-full" onClick={() => handleAskDelete(conta)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-5 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Saldo atual</p>
                  <p className="mt-1 font-heading text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-foreground">
                    {formatCurrency(conta.saldo_atual || 0)}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[12px] text-foreground-muted">
                    Saldo inicial <span className="tabular-nums text-foreground">{formatCurrency(conta.saldo_inicial)}</span>
                  </span>
                  {!conta.ativa && <StatusBadge status="inativo" />}
                </div>
              </div>
            ))}
          </div>

          {bankAccounts.length === 0 ? (
            <SectionCard>
              <EmptyState
                title="Nenhuma conta cadastrada"
                description="Adicione suas contas bancárias para começar."
                action={<Button onClick={() => handleOpenForm()}><Plus className="h-4 w-4" />Nova Conta</Button>}
              />
            </SectionCard>
          ) : (
            /* MOBILE: lista agrupada por tipo */
            <div className="space-y-4 md:hidden">
              {gruposContas.map((g) => (
                <section key={g.key}>
                  <div className="flex items-baseline justify-between px-0.5 pb-1.5 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">{g.label}</span>
                    <span className="text-[12px] tabular-nums text-foreground-muted">{formatCurrency(g.total)}</span>
                  </div>
                  <div className="rounded-[20px] border border-border bg-surface px-3.5">
                    {g.itens.map((conta) => (
                      <button
                        key={conta.id}
                        type="button"
                        onClick={() => handleOpenForm(conta)}
                        className={cn(
                          'flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-b-0',
                          !conta.ativa && 'opacity-60',
                        )}
                      >
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"
                          style={{ background: `color-mix(in srgb, ${conta.cor} 16%, transparent)`, color: conta.cor }}
                        >
                          <HomeIcon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-foreground">{conta.nome}</span>
                          <span className="block truncate text-[12px] text-foreground-muted">
                            {conta.banco || CONTA_TIPOS.find(t => t.value === conta.tipo)?.label}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="whitespace-nowrap font-heading text-[15px] font-semibold tabular-nums tracking-[-0.01em] text-foreground">
                            {formatCurrency(conta.saldo_atual || 0)}
                          </span>
                          {!conta.ativa && <span className="text-[11px] font-semibold text-foreground-muted">Inativa</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Contas arquivadas: fora das seleções e do saldo total; histórico preservado */}
          {contasArquivadas.length > 0 && (
            <SectionCard
              title={`Arquivadas (${contasArquivadas.length})`}
              description="Não aparecem na seleção de conta dos lançamentos nem no saldo total. Os lançamentos antigos continuam nos relatórios."
              action={
                <Button variant="outline" size="sm" onClick={() => setVerArquivadas((v) => !v)}>
                  {verArquivadas ? 'Ocultar' : 'Mostrar'}
                </Button>
              }
            >
              {verArquivadas && (
                <div className="rounded-[16px] border border-border px-3.5">
                  {contasArquivadas.map((conta) => (
                    <div key={conta.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 text-foreground-muted">
                        <Archive className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-foreground">{conta.nome}</span>
                        <span className="block truncate text-[12px] text-foreground-muted">
                          {[conta.banco, `saldo ${formatCurrency(conta.saldo_atual || 0)}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setContaArquivada(conta.id, false)}>
                        <ArchiveRestore className="h-4 w-4" />Reativar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </TabsContent>

        {/* TAB CARTÕES */}
        <TabsContent value="cartoes" className="mt-4 space-y-4 md:mt-6 md:space-y-6">
          <HeroStatCard
            eyebrow="Total em faturas abertas"
            value={totalCartoes}
            subtitle={`${creditCards.length} ${creditCards.length === 1 ? 'cartão ativo' : 'cartões ativos'}`}
            className="md:max-w-md"
          />

          {creditCards.length === 0 ? (
            <SectionCard>
              <EmptyState
                title="Nenhum cartão cadastrado"
                description="Cadastre seus cartões de crédito para acompanhar faturas."
                action={
                  <Button onClick={novoCartao}>
                    <Plus className="h-4 w-4" /> Novo Cartão
                  </Button>
                }
              />
            </SectionCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
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
        </TabsContent>
      </Tabs>

      {/* Conta bancária dialog */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[480px] sm:mx-auto">
          <div className="pb-1">
            <div className="text-[13px] text-foreground-muted">Cadastro</div>
            <h2 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-foreground">{editingConta ? 'Editar conta' : 'Nova conta'}</h2>
          </div>

          <div className="space-y-5 pt-4">
            <FormSection title="Identificação">
              <div className="space-y-2">
                <Label>Nome da conta</Label>
                <Input value={formData.nome} onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Bradesco PJ" />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={formData.banco || ''} onChange={(e) => setFormData(p => ({ ...p, banco: e.target.value }))} placeholder="Ex: Bradesco" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTA_TIPOS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, tipo: t.value as any }))}
                      className={cn(CHOICE_BASE, formData.tipo === t.value ? CHOICE_ON : CHOICE_OFF)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title="Saldo e aparência">
              <div className="space-y-2">
                <Label>Saldo inicial</Label>
                <Input type="number" step="0.01" value={formData.saldo_inicial || ''} placeholder="R$ 0,00"
                  onChange={(e) => setFormData(p => ({ ...p, saldo_inicial: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map(cor => (
                    <button key={cor} type="button" aria-label={`Cor ${cor}`}
                      className={cn('no-touch-min h-9 w-9 rounded-full transition-transform', formData.cor === cor ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : 'hover:scale-105')}
                      style={{ backgroundColor: cor }} onClick={() => setFormData(p => ({ ...p, cor }))} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3.5">
                <div>
                  <Label>Conta ativa</Label>
                  <p className="mt-0.5 text-[12px] text-foreground-muted">Desligada = arquivada (some das seleções, histórico mantido)</p>
                </div>
                <Switch checked={formData.ativa} onCheckedChange={(c) => setFormData(p => ({ ...p, ativa: c }))} />
              </div>
            </FormSection>
          </div>

          <div className="flex gap-2.5 pt-5">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="lg" className="flex-[2]" onClick={handleSubmit} disabled={!formData.nome.trim()}>
              {editingConta ? 'Salvar' : 'Criar'}
            </Button>
          </div>
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
          onRefresh={async () => { await refetchFaturas(); refetch(); }}
          onPagar={(f) => { setPagarState({ cartao: detailCartao, fatura: f }); }}
        />
      )}

      {pagarState && (
        <PagarFaturaDialog
          open={!!pagarState}
          onOpenChange={(o) => { if (!o) { setPagarState(null); refetchFaturas(); refetch(); } }}
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
        title={deleteConfirm.links && (deleteConfirm.links.receitas + deleteConfirm.links.despesas + deleteConfirm.links.transferencias) > 0 ? 'Arquivar Conta' : 'Excluir Conta'}
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
        confirmLabel={deleteConfirm.links && (deleteConfirm.links.receitas + deleteConfirm.links.despesas + deleteConfirm.links.transferencias) > 0 ? 'Arquivar' : 'Excluir'}
        variant={deleteConfirm.links && (deleteConfirm.links.receitas + deleteConfirm.links.despesas + deleteConfirm.links.transferencias) > 0 ? 'default' : 'destructive'}
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
        title="Excluir Cartão de Crédito"
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


const CHOICE_BASE = 'no-touch-min h-10 rounded-full border text-[13px] font-semibold transition-colors';
const CHOICE_ON = 'border-foreground bg-foreground text-background';
const CHOICE_OFF = 'border-border bg-surface text-foreground hover:border-border-strong';

/** Bloco de campos do formulário: label de seção em caixa alta + campos agrupados. */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">{title}</h3>
      <div className="space-y-3.5 rounded-[20px] border border-border p-4">{children}</div>
    </section>
  );
}
