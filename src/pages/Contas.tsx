import { useMemo, useState } from 'react';
import { IconButton } from '@/components/shared/IconButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useContas, type ContaDB, type ContaFormData } from '@/hooks/useContas';
import { useFaturas, type FaturaDB } from '@/hooks/useFaturas';
import { formatCurrency } from '@/utils/formatters';
import { Plus, Pencil, Trash2, Wallet, Building2, CreditCard } from 'lucide-react';
import { HeroStatCard } from '@/components/shared/HeroStatCard';
import { ListRowCard } from '@/components/shared/ListRowCard';
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
  const { contas, isLoading, createConta, updateConta, deleteConta, deleteCartao, countContaLinks, getTotalBalance, getBankAccounts, getCreditCards, refetch } = useContas();
  const { faturas, pagamentos, refetch: refetchFaturas } = useFaturas();

  const bankAccounts = getBankAccounts();
  const creditCards = getCreditCards();

  const [tab, setTab] = useState<'contas' | 'cartoes'>('contas');

  // Conta bancária state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaDB | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; conta: ContaDB | null; links: { receitas: number; despesas: number; transferencias: number } | null }>({ open: false, conta: null, links: null });
  const [formData, setFormData] = useState<ContaFormData>(defaultFormData);

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

  const handleAskDelete = async (conta: ContaDB) => {
    const links = await countContaLinks(conta.id);
    setDeleteConfirm({ open: true, conta, links });
  };

  const handleDelete = async () => {
    if (deleteConfirm.conta) {
      await deleteConta(deleteConfirm.conta.id);
      setDeleteConfirm({ open: false, conta: null, links: null });
    }
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

  return (
    <main className="container py-4 md:py-6">
      {/* Header desktop */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-foreground">Contas & Cartões</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias e cartões de crédito</p>
        </div>
      </div>

      {/* Header mobile estilo iOS */}
      <div className="md:hidden">
        <MobilePageHeader
          eyebrow="Suas finanças"
          title={tab === 'contas' ? 'Contas' : 'Cartões'}
        />
      </div>


      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="contas"><Building2 className="h-3.5 w-3.5 mr-1.5" />Contas Bancárias</TabsTrigger>
          <TabsTrigger value="cartoes"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Cartões de Crédito</TabsTrigger>
        </TabsList>

        {/* TAB CONTAS BANCARIAS */}
        <TabsContent value="contas">
          <div className="flex justify-end mb-4">
            <IconButton label="Nova Conta Bancária" emphasis="primary" onClick={() => handleOpenForm()}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>

          {/* HERO: saldo total — mobile (dark) / desktop (light gradient) */}
          <div className="md:hidden mb-6">
            <HeroStatCard
              eyebrow="Saldo Total em Contas"
              value={getTotalBalance()}
              subtitle={`${bankAccounts.length} ${bankAccounts.length === 1 ? 'conta ativa' : 'contas ativas'}`}
            />
          </div>
          <Card className="hidden md:block mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Saldo Total (Contas)</p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(getTotalBalance())}</p>
                </div>
                <Wallet className="h-10 w-10 text-primary/50" />
              </div>
            </CardContent>
          </Card>

          {bankAccounts.length === 0 ? (
            <EmptyState
              title="Nenhuma conta cadastrada"
              description="Adicione suas contas bancárias para começar."
              action={<Button onClick={() => handleOpenForm()}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>}
            />
          ) : (
            <>
              {/* MOBILE: lista estilo iOS */}
              <div className="md:hidden flex flex-col gap-2">
                {bankAccounts.map((conta) => (
                  <ListRowCard
                    key={conta.id}
                    onClick={() => handleOpenForm(conta)}
                    leading={
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: conta.cor }}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                    }
                    title={conta.nome}
                    subtitle={
                      <>
                        {conta.banco ? `${conta.banco} · ` : ''}
                        {CONTA_TIPOS.find(t => t.value === conta.tipo)?.label}
                      </>
                    }
                    value={formatCurrency(conta.saldo_atual || 0)}
                    meta={!conta.ativa ? 'Inativa' : null}
                    dimmed={!conta.ativa}
                  />
                ))}
              </div>

              {/* DESKTOP: grid de cards */}
              <div className="hidden md:grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {bankAccounts.map((conta) => (
                  <Card key={conta.id} className={`relative overflow-hidden ${!conta.ativa ? 'opacity-60' : ''}`}>
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: conta.cor }} />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-base">{conta.nome}</CardTitle>
                            {conta.banco && <p className="text-xs text-muted-foreground">{conta.banco}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <IconButton label="Editar conta" tooltipSide="top" variant="ghost" className="h-8 w-8" onClick={() => handleOpenForm(conta)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Excluir conta" tooltipSide="top" emphasis="destructive" className="h-8 w-8" onClick={() => handleAskDelete(conta)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground uppercase">
                          {CONTA_TIPOS.find(t => t.value === conta.tipo)?.label}
                        </span>
                        <p className="text-2xl font-semibold tabular-nums">{formatCurrency(conta.saldo_atual || 0)}</p>
                        <p className="text-xs text-muted-foreground">Saldo inicial: {formatCurrency(conta.saldo_inicial)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

        </TabsContent>

        {/* TAB CARTOES */}
        <TabsContent value="cartoes">
          <div className="flex justify-end mb-4">
            <IconButton label="Novo Cartão de Crédito" emphasis="primary" onClick={() => { setEditingCartao(null); setIsCartaoFormOpen(true); }}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="md:hidden mb-6">
            <HeroStatCard
              eyebrow="Total em Faturas Abertas"
              value={totalCartoes}
              subtitle={`${creditCards.length} ${creditCards.length === 1 ? 'cartão ativo' : 'cartões ativos'}`}
              progressTone="danger"
            />
          </div>
          <Card className="hidden md:block mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/5 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total em Faturas Abertas</p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(totalCartoes)}</p>
                </div>
                <CreditCard className="h-10 w-10 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>


          {creditCards.length === 0 ? (
            <EmptyState
              title="Nenhum cartão cadastrado"
              description="Cadastre seus cartões de crédito para acompanhar faturas."
              action={
                <Button onClick={() => { setEditingCartao(null); setIsCartaoFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Cartão
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {creditCards.map(cartao => (
                <CartaoCard
                  key={cartao.id}
                  cartao={cartao}
                  faturaAtual={faturaAtualPorCartao.get(cartao.id) || null}
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
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingConta ? 'Editar Conta' : 'Nova Conta'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Conta *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={formData.banco || ''} onChange={(e) => setFormData(p => ({ ...p, banco: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v: any) => setFormData(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTA_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Input type="number" step="0.01" value={formData.saldo_inicial || ''}
                onChange={(e) => setFormData(p => ({ ...p, saldo_inicial: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CORES.map(cor => (
                  <button key={cor} type="button"
                    className={`w-8 h-8 rounded-full border-2 ${formData.cor === cor ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: cor }} onClick={() => setFormData(p => ({ ...p, cor }))} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Conta Ativa</Label>
              <Switch checked={formData.ativa} onCheckedChange={(c) => setFormData(p => ({ ...p, ativa: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!formData.nome.trim()}>{editingConta ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          onOpenChange={(o) => !o && setPagarState(null)}
          cartao={pagarState.cartao}
          fatura={pagarState.fatura}
          contasBancarias={bankAccounts}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, conta: open ? deleteConfirm.conta : null, links: open ? deleteConfirm.links : null })}
        onConfirm={handleDelete}
        title="Excluir Conta"
        description={(() => {
          const l = deleteConfirm.links;
          const nome = deleteConfirm.conta?.nome ?? '';
          if (!l) return `Excluir "${nome}"?`;
          if (l.transferencias > 0) {
            return `"${nome}" possui ${l.transferencias} transferência(s) vinculada(s). Exclua ou edite as transferências antes de remover esta conta.`;
          }
          const total = l.receitas + l.despesas;
          if (total === 0) return `Excluir "${nome}"? Esta ação não pode ser desfeita.`;
          const partes = [
            l.receitas > 0 ? `${l.receitas} receita(s)` : null,
            l.despesas > 0 ? `${l.despesas} despesa(s)` : null,
          ].filter(Boolean).join(' e ');
          return `"${nome}" possui ${partes} vinculada(s). Os lançamentos serão mantidos no histórico, mas ficarão sem conta. Deseja continuar?`;
        })()}
        confirmLabel={deleteConfirm.links && deleteConfirm.links.transferencias > 0 ? 'Entendi' : 'Excluir'}
        variant="destructive"
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
