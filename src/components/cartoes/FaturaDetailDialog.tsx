import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Receipt, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconButton } from '@/components/shared/IconButton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { rotuloCompetencia } from '@/utils/faturaCalculator';
import { useDespesas, type DespesaDB } from '@/hooks/useDespesas';
import type { ContaDB } from '@/hooks/useContas';
import type { FaturaDB, FaturaPagamentoDB } from '@/hooks/useFaturas';

interface FaturaDetailDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cartao: ContaDB;
  faturas: FaturaDB[];
  pagamentos: FaturaPagamentoDB[];
  contas: ContaDB[];
  onPagar: (fatura: FaturaDB) => void;
  /** Quando true, abre direto o formulário de novo lançamento. */
  startInCreate?: boolean;
  onRefresh?: () => void | Promise<void>;
}

interface LancamentoLite {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  categoria_id: string | null;
  fornecedor: string | null;
  categoria?: { nome: string; cor: string } | null;
}

const isoToday = () => new Date().toISOString().slice(0, 10);

export function FaturaDetailDialog({
  open,
  onOpenChange,
  cartao,
  faturas,
  pagamentos,
  contas,
  onPagar,
  startInCreate = false,
  onRefresh,
}: FaturaDetailDialogProps) {
  const { categorias, createDespesa, updateDespesa, deleteDespesa } = useDespesas();

  const cartaoFaturas = useMemo(
    () => faturas.filter(f => f.cartao_id === cartao.id).sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [faturas, cartao.id]
  );
  const [idx, setIdx] = useState(0);
  const fatura = cartaoFaturas[idx];

  const [lancamentos, setLancamentos] = useState<LancamentoLite[]>([]);
  const [loadingLancs, setLoadingLancs] = useState(false);

  // Form state (criar/editar lançamento)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LancamentoLite | null>(null);
  const [form, setForm] = useState({
    descricao: '',
    valor: '' as string | number,
    data_competencia: isoToday(),
    categoria_id: '',
    fornecedor: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteState, setDeleteState] = useState<LancamentoLite | null>(null);

  const fetchLancamentos = async (faturaId: string) => {
    setLoadingLancs(true);
    const { data } = await supabase
      .from('despesas')
      .select('id, descricao, valor, data_competencia, data_vencimento, categoria_id, fornecedor, categoria:categorias(nome, cor)')
      .eq('fatura_id', faturaId)
      .order('data_competencia', { ascending: false });
    setLancamentos((data as any[]) || []);
    setLoadingLancs(false);
  };

  useEffect(() => {
    if (!open || !fatura) return;
    fetchLancamentos(fatura.id);
  }, [open, fatura?.id]);

  useEffect(() => {
    if (open) {
      setIdx(0);
      if (startInCreate) {
        // Pequeno delay garante que fatura já esteja carregada
        setTimeout(() => openCreate(), 50);
      }
    } else {
      setFormOpen(false);
      setEditing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setForm({
      descricao: '',
      valor: '',
      data_competencia: isoToday(),
      categoria_id: '',
      fornecedor: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (l: LancamentoLite) => {
    setEditing(l);
    setForm({
      descricao: l.descricao,
      valor: l.valor,
      data_competencia: l.data_competencia,
      categoria_id: l.categoria_id || '',
      fornecedor: l.fornecedor || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const valorNum = typeof form.valor === 'string' ? parseFloat(form.valor) : form.valor;
    if (!form.descricao.trim() || !valorNum || valorNum <= 0) return;
    setSaving(true);
    try {
      const payload = {
        descricao: form.descricao.trim(),
        valor: valorNum,
        data_competencia: form.data_competencia,
        data_vencimento: form.data_competencia,
        categoria_id: form.categoria_id || undefined,
        fornecedor: form.fornecedor.trim() || undefined,
        conta_id: cartao.id,
        status: 'pendente' as const,
        tipo: 'variavel' as const,
      };

      if (editing) {
        await updateDespesa(editing.id, payload);
      } else {
        await createDespesa(payload, true);
      }

      setFormOpen(false);
      resetForm();
      // Refresh global de faturas (atualiza valor_total/em aberto na UI)
      await onRefresh?.();
      // Refresh local da lista de lançamentos
      if (fatura) await fetchLancamentos(fatura.id);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteState) return;
    await deleteDespesa(deleteState.id);
    setDeleteState(null);
    await onRefresh?.();
    if (fatura) await fetchLancamentos(fatura.id);
  };

  if (!fatura) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{cartao.nome}</DialogTitle></DialogHeader>
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhuma fatura ainda. Crie um lançamento para abrir a primeira fatura deste cartão.
          </div>
          <Button onClick={async () => {
            // Cria fatura por meio de uma despesa pendente vazia? Em vez disso, abra o form de criar
            // forçando geração da fatura via createDespesa.
            openCreate();
          }}>
            <Plus className="h-4 w-4 mr-2" /> Novo lançamento
          </Button>

          {/* Form mesmo sem fatura: createDespesa cria a fatura no ato */}
          {formOpen && (
            <LancamentoFormInline
              categorias={categorias}
              form={form}
              setForm={setForm}
              editing={editing}
              saving={saving}
              onCancel={() => { setFormOpen(false); resetForm(); }}
              onSave={handleSave}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const restante = Number(fatura.valor_total) - Number(fatura.valor_pago);
  const pagsFatura = pagamentos.filter(p => p.fatura_id === fatura.id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Receipt className="h-5 w-5" /> Faturas — {cartao.nome}
            </DialogTitle>
          </DialogHeader>

          {/* Navegação entre meses + ação primária */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <Button variant="ghost" size="sm" disabled={idx >= cartaoFaturas.length - 1} onClick={() => setIdx(i => i + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground uppercase">Competência</p>
              <p className="font-semibold">{rotuloCompetencia(fatura.competencia)}</p>
            </div>
            <Button variant="ghost" size="sm" disabled={idx <= 0} onClick={() => setIdx(i => i - 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo lançamento
            </Button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-sm mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold tabular-nums">{formatCurrency(Number(fatura.valor_total))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="font-semibold tabular-nums">{formatCurrency(Number(fatura.valor_pago))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
              <p className="font-bold tabular-nums">{formatCurrency(restante)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-medium">{format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fechamento</p>
              <p className="font-medium">{format(parseISO(fatura.data_fechamento), 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{fatura.status.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Form inline */}
          {formOpen && (
            <LancamentoFormInline
              categorias={categorias}
              form={form}
              setForm={setForm}
              editing={editing}
              saving={saving}
              onCancel={() => { setFormOpen(false); resetForm(); }}
              onSave={handleSave}
            />
          )}

          {/* Lançamentos */}
          <div className="mb-4">
            <h4 className="text-xs uppercase text-muted-foreground mb-2">
              Lançamentos ({lancamentos.length})
            </h4>
            {loadingLancs ? (
              <p className="text-sm text-muted-foreground py-3 text-center">Carregando...</p>
            ) : lancamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">Sem lançamentos.</p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg">
                {lancamentos.map((l) => (
                  <li key={l.id} className="flex items-center justify-between p-2.5 text-sm gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{l.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(l.data_competencia), "dd 'de' MMM", { locale: ptBR })}
                        {l.categoria?.nome ? ` • ${l.categoria.nome}` : ''}
                        {l.fornecedor ? ` • ${l.fornecedor}` : ''}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatCurrency(Number(l.valor))}</span>
                    <div className="flex gap-0.5 shrink-0">
                      <IconButton
                        label="Editar lançamento"
                        tooltipSide="top"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(l)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="Excluir lançamento"
                        tooltipSide="top"
                        emphasis="destructive"
                        className="h-7 w-7"
                        onClick={() => setDeleteState(l)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagamentos */}
          {pagsFatura.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Pagamentos</h4>
              <ul className="divide-y divide-border border border-border rounded-lg">
                {pagsFatura.map(p => {
                  const conta = contas.find(c => c.id === p.conta_id);
                  return (
                    <li key={p.id} className="flex items-center justify-between p-2.5 text-sm">
                      <div>
                        <p className="font-medium">{conta?.nome || 'Conta'}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(p.data_pagamento), 'dd/MM/yyyy')}</p>
                      </div>
                      <span className="font-semibold tabular-nums text-emerald-600">{formatCurrency(Number(p.valor))}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {restante > 0 && (
            <Button className="w-full" onClick={() => onPagar(fatura)}>
              Pagar Fatura
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteState}
        onOpenChange={(o) => !o && setDeleteState(null)}
        onConfirm={handleDelete}
        title="Excluir lançamento"
        description={`Excluir "${deleteState?.descricao}" da fatura?`}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </>
  );
}

// ----------------- Form inline -----------------

function LancamentoFormInline({
  categorias,
  form,
  setForm,
  editing,
  saving,
  onCancel,
  onSave,
}: {
  categorias: { id: string; nome: string; tipo: string }[];
  form: { descricao: string; valor: string | number; data_competencia: string; categoria_id: string; fornecedor: string };
  setForm: (updater: any) => void;
  editing: LancamentoLite | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 mb-4 space-y-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {editing ? 'Editar lançamento' : 'Novo lançamento'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Descrição *</Label>
          <Input
            value={form.descricao}
            onChange={(e) => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
            placeholder="Ex: Assinatura Netflix"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor *</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm((p: any) => ({ ...p, valor: e.target.value }))}
            placeholder="0,00"
          />
        </div>
        <div className="space-y-1">
          <DatePickerField
            label="Data da compra"
            required
            showQuickButtons
            value={form.data_competencia}
            onChange={(v) => setForm((p: any) => ({ ...p, data_competencia: v }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select
            value={form.categoria_id || 'none'}
            onValueChange={(v) => setForm((p: any) => ({ ...p, categoria_id: v === 'none' ? '' : v }))}
          >
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categorias.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fornecedor</Label>
          <Input
            value={form.fornecedor}
            onChange={(e) => setForm((p: any) => ({ ...p, fornecedor: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button size="sm" onClick={onSave} disabled={saving || !form.descricao.trim() || !form.valor}>
          {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}
