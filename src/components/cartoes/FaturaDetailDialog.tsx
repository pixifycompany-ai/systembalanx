import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { rotuloCompetencia } from '@/utils/faturaCalculator';
import { useDespesas } from '@/hooks/useDespesas';
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
  const { categorias, createDespesa, createDespesaParcelada, updateDespesa, deleteDespesa } = useDespesas();

  const cartaoFaturas = useMemo(
    () => faturas.filter(f => f.cartao_id === cartao.id).sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [faturas, cartao.id]
  );
  // Índice da fatura ATUAL (competência <= mês corrente). Calculado já na 1ª
  // renderização → abre direto na atual, sem flash na última parcela.
  const targetIdx = useMemo(() => {
    if (cartaoFaturas.length === 0) return 0;
    const nowYM = new Date().toISOString().slice(0, 7); // YYYY-MM
    const t = cartaoFaturas.findIndex((f) => (f.competencia || '').slice(0, 7) <= nowYM);
    return t < 0 ? cartaoFaturas.length - 1 : t;
  }, [cartaoFaturas]);
  const [idxOverride, setIdxOverride] = useState<number | null>(null);
  const idx = idxOverride ?? targetIdx;
  const setIdx = (fn: number | ((prev: number) => number)) =>
    setIdxOverride((prev) => {
      const cur = prev ?? targetIdx;
      return typeof fn === 'function' ? fn(cur) : fn;
    });
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
    parcelas: 1,
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
      setIdxOverride(null); // volta pra fatura atual a cada abertura
      if (startInCreate) {
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
      parcelas: 1,
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
      parcelas: 1,
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
      } else if (form.parcelas > 1) {
        await createDespesaParcelada(payload, form.parcelas);
      } else {
        await createDespesa(payload, true);
      }

      setFormOpen(false);
      resetForm();
      await onRefresh?.();
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

  const sheetClass = 'p-0 max-h-[94dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[960px] sm:mx-auto';

  const Header = () => (
    <div className="flex items-center gap-2.5 px-5 pt-1 pb-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </span>
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Faturas — {cartao.nome}</h2>
    </div>
  );

  if (!fatura) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showHandle className={sheetClass}>
          <Header />
          <div className="px-5 pb-6">
            <div className="py-6 text-center text-sm text-foreground-muted">
              Nenhuma fatura ainda. Crie um lançamento para abrir a primeira fatura deste cartão.
            </div>
            {!formOpen && (
              <button onClick={openCreate} className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13px] font-semibold text-white">
                <PlusIcon className="h-4 w-4" strokeWidth={2.4} /> Novo lançamento
              </button>
            )}
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
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const total = Number(fatura.valor_total);
  const pago = Number(fatura.valor_pago);
  const restante = total - pago;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((pago / total) * 100))) : 0;
  const pagsFatura = pagamentos.filter(p => p.fatura_id === fatura.id);
  const statusTone = fatura.status === 'paga' ? 'success' : restante > 0 ? 'danger' : 'muted';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showHandle className={sheetClass}>
          {/* Top bar: título + navegação de competência */}
          <div className="flex flex-wrap items-center gap-2.5 px-5 pt-1 pb-3 md:px-7 md:pt-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </span>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground md:text-[21px]">Faturas — {cartao.nome}</h2>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                disabled={idx >= cartaoFaturas.length - 1}
                onClick={() => setIdx(i => i + 1)}
                aria-label="Competência anterior"
                className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-surface/60 text-foreground transition-colors hover:bg-surface-2 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[116px] text-center">
                <p className="text-[9.5px] uppercase tracking-wide text-foreground-muted">Competência</p>
                <p className="text-[13.5px] font-semibold text-foreground">{rotuloCompetencia(fatura.competencia)}</p>
              </div>
              <button
                disabled={idx <= 0}
                onClick={() => setIdx(i => i - 1)}
                aria-label="Próxima competência"
                className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-surface/60 text-foreground transition-colors hover:bg-surface-2 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-5 pb-6 md:flex md:items-start md:gap-6 md:px-7 md:pb-7">
            {/* COLUNA ESQUERDA: resumo + pagar + novo lançamento */}
            <div className="space-y-3.5 md:sticky md:top-2 md:w-[316px] md:shrink-0 md:self-start">
              <div className="auro-card rounded-2xl border border-border/60 bg-surface/55 p-4 md:p-5">
                <p className="text-[10.5px] uppercase tracking-wide text-foreground-muted">Em aberto</p>
                <p className={`mt-0.5 text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums md:text-[34px] ${restante > 0 ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
                  {formatCurrency(restante)}
                </p>

                {/* Progresso pago/total */}
                <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[hsl(var(--success))] transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-foreground-muted">
                  Pago <b className="text-foreground">{formatCurrency(pago)}</b> de {formatCurrency(total)} · {pct}%
                </p>

                <div className="mt-4 grid grid-cols-2 gap-y-3 border-t border-border/50 pt-3.5">
                  <Summary lab="Vencimento" val={format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy')} />
                  <Summary lab="Fechamento" val={format(parseISO(fatura.data_fechamento), 'dd/MM/yyyy')} />
                  <Summary lab="Status" val={fatura.status.replace('_', ' ')} capitalize tone={statusTone} />
                  <Summary lab="Lançamentos" val={String(lancamentos.length)} />
                </div>

                {restante > 0 && (
                  <button
                    onClick={() => onPagar(fatura)}
                    className="mt-4 w-full rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13.5px] font-semibold text-white transition-transform active:scale-[0.99]"
                  >
                    Pagar fatura
                  </button>
                )}
              </div>

              {!formOpen && (
                <button onClick={openCreate} className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-border/60 bg-surface/60 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-2">
                  <PlusIcon className="h-4 w-4" strokeWidth={2.4} /> Novo lançamento
                </button>
              )}
            </div>

            {/* COLUNA DIREITA: form + lançamentos + pagamentos */}
            <div className="mt-4 min-w-0 flex-1 space-y-4 md:mt-0">
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

              <div>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  Lançamentos ({lancamentos.length})
                </h4>
                {loadingLancs ? (
                  <p className="py-3 text-center text-sm text-foreground-muted">Carregando…</p>
                ) : lancamentos.length === 0 ? (
                  <p className="rounded-2xl border border-border/60 bg-surface/55 py-8 text-center text-sm text-foreground-muted">Sem lançamentos nesta fatura.</p>
                ) : (
                  <div className="auro-card divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-surface/55">
                    {lancamentos.map((l) => (
                      <div key={l.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: l.categoria?.cor || 'hsl(var(--primary))' }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{l.descricao}</p>
                          <p className="truncate text-[11px] text-foreground-muted">
                            {format(parseISO(l.data_competencia), "dd 'de' MMM", { locale: ptBR })}
                            {l.categoria?.nome ? ` · ${l.categoria.nome}` : ''}
                            {l.fornecedor ? ` · ${l.fornecedor}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(Number(l.valor))}</span>
                        <div className="flex shrink-0 items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                          <button onClick={() => openEdit(l)} aria-label="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-foreground-muted hover:bg-white/5 hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteState(l)} aria-label="Excluir" className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-white/5">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {pagsFatura.length > 0 && (
                <div>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Pagamentos</h4>
                  <div className="auro-card divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-surface/55">
                    {pagsFatura.map(p => {
                      const conta = contas.find(c => c.id === p.conta_id);
                      return (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{conta?.nome || 'Conta'}</p>
                            <p className="text-[11px] text-foreground-muted">{format(parseISO(p.data_pagamento), 'dd/MM/yyyy')}</p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-[hsl(var(--success))]">{formatCurrency(Number(p.valor))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

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

function Summary({ lab, val, danger, capitalize, tone }: { lab: string; val: string; strong?: boolean; danger?: boolean; capitalize?: boolean; tone?: 'success' | 'danger' | 'muted' }) {
  const color = danger || tone === 'danger'
    ? 'text-[hsl(var(--danger))]'
    : tone === 'success'
      ? 'text-[hsl(var(--success))]'
      : tone === 'muted'
        ? 'text-foreground-muted'
        : 'text-foreground';
  return (
    <div>
      <p className="text-[10.5px] text-foreground-muted">{lab}</p>
      <p className={`mt-0.5 text-[13.5px] font-semibold tabular-nums ${color} ${capitalize ? 'capitalize' : ''}`}>
        {val}
      </p>
    </div>
  );
}

// ----------------- Form inline (AURO) -----------------

function LancamentoFormInline({
  categorias,
  form,
  setForm,
  editing,
  saving,
  onCancel,
  onSave,
}: {
  categorias: { id: string; nome: string; tipo: string; cor?: string }[];
  form: { descricao: string; valor: string | number; data_competencia: string; categoria_id: string; fornecedor: string; parcelas: number };
  setForm: (updater: any) => void;
  editing: LancamentoLite | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const catSel = categorias.find(c => c.id === form.categoria_id);
  return (
    <div className="auro-card space-y-3.5 rounded-2xl border border-primary/30 bg-surface/60 p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
        <span className="h-2 w-2 rounded-full bg-primary" />
        {editing ? 'Editar lançamento' : 'Novo lançamento'}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descrição *</Label>
        <Input
          value={form.descricao}
          onChange={(e) => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
          placeholder="Ex: Assinatura Netflix"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor *</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm((p: any) => ({ ...p, valor: e.target.value }))}
            placeholder="R$ 0,00"
            className="h-12 text-lg font-semibold tabular-nums text-[hsl(var(--danger))]"
          />
        </div>
        {!editing && (
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Parcelas</Label>
            <Input
              type="number"
              min="1"
              max="48"
              step="1"
              value={form.parcelas}
              onChange={(e) => setForm((p: any) => ({ ...p, parcelas: parseInt(e.target.value) || 1 }))}
              placeholder="1"
              className="h-12"
            />
          </div>
        )}
      </div>

      <DatePickerField
        label="Data da compra"
        required
        showQuickButtons
        value={form.data_competencia}
        onChange={(v) => setForm((p: any) => ({ ...p, data_competencia: v }))}
      />

      <div className="space-y-1.5">
        <Label className="text-xs">Categoria</Label>
        <Select
          value={form.categoria_id || 'none'}
          onValueChange={(v) => setForm((p: any) => ({ ...p, categoria_id: v === 'none' ? '' : v }))}
        >
          <SelectTrigger>
            {catSel
              ? <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: catSel.cor || 'hsl(var(--primary))' }} />{catSel.nome}</span>
              : <SelectValue placeholder="Selecionar categoria" />}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem categoria</SelectItem>
            {categorias.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: c.cor || 'hsl(var(--primary))' }} />{c.nome}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Fornecedor</Label>
        <Input
          value={form.fornecedor}
          onChange={(e) => setForm((p: any) => ({ ...p, fornecedor: e.target.value }))}
          placeholder="Opcional"
        />
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="flex-[0_0_34%] rounded-[14px] bg-surface-2 py-3 text-[13px] font-semibold text-foreground disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.descricao.trim() || !form.valor}
          className="flex-1 rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Salvando…' : editing ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}
