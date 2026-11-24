import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarClock, Check, ChevronLeft, ChevronRight, CreditCard, Download, FileText, Pencil, Plus, Repeat, Search, Trash2, Wallet, X,
} from 'lucide-react';
import { exportToCSV } from '@/utils/exportCSV';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { Segmented, Campo } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { melhorDiaDeCompra, rotuloCompetencia } from '@/utils/faturaCalculator';
import { useDespesas } from '@/hooks/useDespesas';
import { cn } from '@/lib/utils';
import type { ContaDB } from '@/hooks/useContas';
import type { FaturaDB, FaturaPagamentoDB } from '@/hooks/useFaturas';
import { digitarMoeda, mostrarMoeda, valorNumero } from '@/lib/moeda';

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
  /** Limite usado do cartão (todas as faturas em aberto). Mostra o bloco de limite. */
  usado?: number;
}

interface LancamentoLite {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string;
  categoria_id: string | null;
  fornecedor: string | null;
  parcela_num?: number | null;
  parcela_total?: number | null;
  fatura_id?: string | null;
  categoria?: { nome: string; cor: string } | null;
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const SEM_CAT = '__sem__';
const COR_SEM = '#94A3B8';

// Extrato do banco vem em MAIÚSCULAS: mostra em caixa normal, preservando siglas comuns.
const SIGLAS: Record<string, string> = { iof: 'IOF', ai: 'AI', openai: 'OpenAI', chatgpt: 'ChatGPT', pix: 'Pix', ltda: 'Ltda', me: 'ME', sa: 'SA' };
const bonito = (s: string | null | undefined) => {
  const t = (s || '').trim();
  if (!t || t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t;
  return t.toLowerCase().split(/(\s+)/).map((w) => SIGLAS[w] || (w.trim() ? w[0].toUpperCase() + w.slice(1) : w)).join('');
};
const diaLongo = (iso: string) => format(parseISO(iso), "EEE, d 'de' MMM", { locale: ptBR });

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
  usado,
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
  const [aba, setAba] = useState<'lanc' | 'parc' | 'pag'>('lanc');
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<'data' | 'valor'>('data');
  const [futuras, setFuturas] = useState<LancamentoLite[] | null>(null);

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
      .select('id, descricao, valor, data_competencia, data_vencimento, categoria_id, fornecedor, parcela_num, parcela_total, categoria:categorias(nome, cor)')
      .eq('fatura_id', faturaId)
      .order('data_competencia', { ascending: false });
    setLancamentos((data as unknown as LancamentoLite[]) || []);
    setLoadingLancs(false);
  };

  // Faturas seguintes (ainda não pagas): parcelas já comprometidas.
  const faturasFuturas = useMemo(
    () => (fatura ? cartaoFaturas.filter((f) => f.competencia > fatura.competencia && f.status !== 'paga').sort((a, b) => a.competencia.localeCompare(b.competencia)) : []),
    [cartaoFaturas, fatura],
  );
  const futurasKey = faturasFuturas.map((f) => f.id).join(',');

  useEffect(() => {
    if (!open || !fatura) return;
    fetchLancamentos(fatura.id);
    setCatFiltro(null);
    setBusca('');
    setFuturas(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fatura?.id]);

  useEffect(() => {
    if (!open || aba !== 'parc' || futuras !== null) return;
    if (!futurasKey) { setFuturas([]); return; }
    supabase
      .from('despesas')
      .select('id, descricao, valor, data_competencia, data_vencimento, categoria_id, fornecedor, parcela_num, parcela_total, fatura_id')
      .in('fatura_id', futurasKey.split(','))
      .then(({ data }) => setFuturas((data as unknown as LancamentoLite[]) || []));
  }, [open, aba, futuras, futurasKey]);

  useEffect(() => {
    if (open) {
      setIdxOverride(null); // volta pra fatura atual a cada abertura
      setAba('lanc');
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
    setAba('lanc');
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
    const valorNum = valorNumero(form.valor);
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
      setFuturas(null);
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
    setFuturas(null);
    await onRefresh?.();
    if (fatura) await fetchLancamentos(fatura.id);
  };

  // ---- Exportar lançamentos da fatura (CSV / PDF) ----
  const nomeArquivo = (ext: string) =>
    `fatura-${cartao.nome}-${fatura?.competencia || ''}`.replace(/[^\w.-]+/g, '_').toLowerCase() + '.' + ext;

  const baixarCsv = () => {
    if (!fatura || lancamentos.length === 0) return;
    const rows = lancamentos.map((l) => ({
      data: format(parseISO(l.data_competencia), 'dd/MM/yyyy'),
      descricao: l.descricao,
      categoria: l.categoria?.nome || '',
      fornecedor: l.fornecedor || '',
      valor: Number(l.valor).toFixed(2).replace('.', ','),
    }));
    exportToCSV(rows, nomeArquivo('csv').replace(/\.csv$/, ''), [
      { key: 'data', label: 'Data' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'valor', label: 'Valor (R$)' },
    ]);
  };

  const baixarPdf = () => {
    if (!fatura) return;
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const total = Number(fatura.valor_total), pago = Number(fatura.valor_pago), rest = total - pago;
    const linhas = lancamentos.map((l) => `
      <tr>
        <td>${esc(format(parseISO(l.data_competencia), 'dd/MM/yyyy'))}</td>
        <td>${esc(l.descricao)}</td>
        <td>${esc(l.categoria?.nome || '—')}</td>
        <td>${esc(l.fornecedor || '—')}</td>
        <td class="r">${esc(formatCurrency(Number(l.valor)))}</td>
      </tr>`).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nomeArquivo('pdf'))}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:32px;}
        h1{font-size:18px;margin:0 0 2px} .sub{color:#6b7280;font-size:12px;margin:0 0 16px}
        .cards{display:flex;gap:10px;margin:0 0 18px;flex-wrap:wrap}
        .card{border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;min-width:150px}
        .card .l{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
        .card .v{font-size:16px;font-weight:bold;margin-top:2px}
        .danger{color:#dc2626}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eceef2}
        th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;border-bottom:1px solid #d1d5db}
        td.r,th.r{text-align:right;white-space:nowrap}
        tfoot td{font-weight:bold;border-top:2px solid #d1d5db;border-bottom:none}
        @media print{body{margin:14mm}}
      </style></head><body>
      <h1>Fatura — ${esc(cartao.nome)}</h1>
      <p class="sub">Competência ${esc(rotuloCompetencia(fatura.competencia))} · Vencimento ${esc(format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy'))} · Fechamento ${esc(format(parseISO(fatura.data_fechamento), 'dd/MM/yyyy'))} · Status ${esc(String(fatura.status).replace('_', ' '))}</p>
      <div class="cards">
        <div class="card"><div class="l">Total</div><div class="v">${esc(formatCurrency(total))}</div></div>
        <div class="card"><div class="l">Pago</div><div class="v">${esc(formatCurrency(pago))}</div></div>
        <div class="card"><div class="l">Em aberto</div><div class="v ${rest > 0 ? 'danger' : ''}">${esc(formatCurrency(rest))}</div></div>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th class="r">Valor</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:20px">Sem lançamentos.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4">Total (${lancamentos.length} lançamento${lancamentos.length === 1 ? '' : 's'})</td><td class="r">${esc(formatCurrency(total))}</td></tr></tfoot>
      </table>
      <script>window.onload=function(){window.focus();window.print();}</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  // ---- derivados ----
  const porCategoria = useMemo(() => {
    const m = new Map<string, { nome: string; cor: string; valor: number }>();
    for (const l of lancamentos) {
      const k = l.categoria_id || SEM_CAT;
      const cur = m.get(k) || { nome: l.categoria?.nome || 'Sem categoria', cor: l.categoria?.cor || COR_SEM, valor: 0 };
      cur.valor += Number(l.valor);
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor);
  }, [lancamentos]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lancamentos.filter((l) => (!catFiltro || (l.categoria_id || SEM_CAT) === catFiltro)
      && (!t || `${l.descricao} ${l.fornecedor || ''}`.toLowerCase().includes(t)));
  }, [lancamentos, busca, catFiltro]);

  const grupos: [string, LancamentoLite[]][] = useMemo(() => {
    if (ordem === 'valor') return [['', [...filtrados].sort((a, b) => Number(b.valor) - Number(a.valor))]];
    const m = new Map<string, LancamentoLite[]>();
    for (const l of filtrados) m.set(l.data_competencia, [...(m.get(l.data_competencia) || []), l]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtrados, ordem]);

  const futurasPorFatura = useMemo(() => faturasFuturas.map((f) => ({
    fatura: f,
    itens: (futuras || []).filter((l) => l.fatura_id === f.id),
  })), [faturasFuturas, futuras]);

  const Topo = ({ comNavegacao }: { comNavegacao: boolean }) => (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-4 md:px-6">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: cartao.cor || '#0B1226' }}><CreditCard className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-foreground-muted">Fatura{cartao.bandeira ? ` · ${cartao.bandeira}` : ''}</p>
        <h2 className="truncate font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">{cartao.nome}</h2>
      </div>
      {comNavegacao && fatura && (
        <div className="order-last flex w-full items-center justify-between gap-1 rounded-full border border-border bg-surface p-1 md:order-none md:w-auto">
          <button type="button" disabled={idx >= cartaoFaturas.length - 1} onClick={() => setIdx(i => i + 1)} aria-label="Fatura anterior" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[96px] px-1 text-center leading-tight"><span className="block text-[10px] uppercase tracking-[0.08em] text-foreground-muted">Competência</span><span className="block text-[13px] font-semibold capitalize text-foreground">{format(parseISO(fatura.competencia), 'MMM/yyyy', { locale: ptBR })}</span></span>
          <button type="button" disabled={idx <= 0} onClick={() => setIdx(i => i - 1)} aria-label="Próxima fatura" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
      <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );

  const formulario = formOpen && (
    <LancamentoFormInline
      categorias={categorias}
      form={form}
      setForm={setForm}
      editing={editing}
      saving={saving}
      onCancel={() => { setFormOpen(false); resetForm(); }}
      onSave={handleSave}
    />
  );

  if (!fatura) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[640px]')}>
          <SheetTitle className="sr-only">Fatura de {cartao.nome}</SheetTitle>
          <div className="flex max-h-[92dvh] flex-col md:max-h-[88dvh]">
            <Topo comNavegacao={false} />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-[20px] border border-dashed border-border px-4 py-10 text-center">
                <p className="font-heading text-[18px] font-light text-foreground">Nenhuma fatura ainda</p>
                <p className="text-[13px] text-foreground-muted">Lance a primeira compra para abrir a fatura deste cartão.</p>
              </div>
              {formulario || <button type="button" onClick={openCreate} className={cn(btn.primary, 'w-full')}><Plus className="h-4 w-4" />Lançar compra</button>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const total = Number(fatura.valor_total);
  const pago = Number(fatura.valor_pago);
  const restante = Math.max(total - pago, 0);
  const pct = total > 0 ? Math.min(100, Math.max(0, (pago / total) * 100)) : 0;
  const pagsFatura = pagamentos.filter(p => p.fatura_id === fatura.id);
  const hoje = new Date();
  const diasFecha = differenceInCalendarDays(parseISO(fatura.data_fechamento), hoje);
  const diasVence = differenceInCalendarDays(parseISO(fatura.data_vencimento), hoje);
  const paga = fatura.status === 'paga' || restante <= 0.009;
  const selo = paga ? ['Paga', 'bg-success-bg text-success-fg']
    : diasVence < 0 ? ['Vencida', 'bg-danger-bg text-danger-fg']
    : diasFecha <= 0 ? ['Fechada', 'bg-warning-bg text-warning-fg']
    : [`Aberta · fecha em ${diasFecha} ${diasFecha === 1 ? 'dia' : 'dias'}`, 'bg-info-bg text-info-fg'];
  const relativo = (d: number) => (d === 0 ? 'hoje' : d > 0 ? `daqui a ${d} ${d === 1 ? 'dia' : 'dias'}` : `há ${-d} ${d === -1 ? 'dia' : 'dias'}`);
  const limite = Number(cartao.limite || 0);
  const melhorDia = cartao.dia_fechamento ? melhorDiaDeCompra(cartao.dia_fechamento) : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[1100px]')}>
          <SheetTitle className="sr-only">Fatura de {cartao.nome}</SheetTitle>
          <div className="flex max-h-[92dvh] flex-col md:h-[88dvh] md:max-h-[88dvh]">
            <Topo comNavegacao />

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[340px_minmax(0,1fr)] md:overflow-hidden">
              {/* coluna do resumo */}
              <aside className="space-y-3 border-b border-border bg-background p-4 md:overflow-y-auto md:border-b-0 md:border-r md:p-5">
                <section className="rounded-[22px] border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Em aberto</p>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px]', selo[1])}>{selo[0]}</span>
                  </div>
                  <p className={cn('mt-1 font-heading text-[34px] font-semibold tabular-nums tracking-[-0.03em]', paga ? 'text-success-fg' : 'text-foreground')}>{formatCurrency(restante)}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-success-fg" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1.5 text-[12.5px] text-foreground-muted">Pago <b className="font-semibold text-foreground">{formatCurrency(pago)}</b> de {formatCurrency(total)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-surface-2/70 p-3"><p className="text-[11.5px] text-foreground-muted">Fecha em</p><p className="text-[15px] font-semibold text-foreground">{format(parseISO(fatura.data_fechamento), 'dd/MM')}</p><p className="text-[11.5px] text-foreground-muted">{relativo(diasFecha)}</p></div>
                    <div className="rounded-2xl bg-surface-2/70 p-3"><p className="text-[11.5px] text-foreground-muted">Vence em</p><p className={cn('text-[15px] font-semibold', !paga && diasVence < 0 ? 'text-danger-fg' : 'text-foreground')}>{format(parseISO(fatura.data_vencimento), 'dd/MM')}</p><p className="text-[11.5px] text-foreground-muted">{relativo(diasVence)}</p></div>
                  </div>
                  {melhorDia && <p className="mt-3 rounded-2xl bg-primary/5 px-3 py-2 text-[12px] text-foreground-muted"><CalendarClock className="mr-1 inline h-3.5 w-3.5 text-primary" />Melhor dia de compra: <b className="font-semibold text-foreground">{melhorDia}</b> (a compra cai na fatura seguinte)</p>}
                  {!paga && <button type="button" onClick={() => onPagar(fatura)} className={cn(btn.primary, 'mt-3 h-11 w-full text-[14px]')}><Wallet className="h-4 w-4" />Pagar fatura</button>}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button type="button" onClick={openCreate} className="flex h-10 items-center justify-center gap-1 rounded-full border border-border text-[12.5px] text-foreground hover:bg-surface-2"><Plus className="h-3.5 w-3.5" />Lançar</button>
                    <button type="button" onClick={baixarCsv} disabled={lancamentos.length === 0} className="flex h-10 items-center justify-center gap-1 rounded-full border border-border text-[12.5px] text-foreground hover:bg-surface-2 disabled:opacity-40"><Download className="h-3.5 w-3.5" />CSV</button>
                    <button type="button" onClick={baixarPdf} disabled={lancamentos.length === 0} className="flex h-10 items-center justify-center gap-1 rounded-full border border-border text-[12.5px] text-foreground hover:bg-surface-2 disabled:opacity-40"><FileText className="h-3.5 w-3.5" />PDF</button>
                  </div>
                </section>

                {limite > 0 && usado !== undefined && (
                  <section className="rounded-[22px] border border-border bg-surface p-4">
                    <div className="flex items-baseline justify-between"><p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Limite</p><p className="text-[12.5px] text-foreground-muted">{formatCurrency(limite)}</p></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn('h-full rounded-full', usado / limite > 0.8 ? 'bg-danger-fg' : 'bg-primary')} style={{ width: `${Math.min(100, Math.max(2, (usado / limite) * 100))}%` }} /></div>
                    <div className="mt-1.5 flex justify-between text-[12.5px]"><span className="text-foreground-muted">Usado <b className="font-semibold text-foreground">{formatCurrency(usado)}</b></span><span className="text-foreground-muted">Livre <b className="font-semibold text-success-fg">{formatCurrency(Math.max(limite - usado, 0))}</b></span></div>
                    {usado > restante + 0.009 && <p className="mt-1 text-[11.5px] text-foreground-subtle">Inclui {formatCurrency(usado - restante)} de parcelas e faturas futuras</p>}
                  </section>
                )}

                {porCategoria.length > 0 && (
                  <section className="rounded-[22px] border border-border bg-surface p-4">
                    <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Por categoria</p>{catFiltro && <button type="button" onClick={() => setCatFiltro(null)} className="text-[12px] text-primary">limpar filtro</button>}</div>
                    {porCategoria.map(([k, c]) => (
                      <button key={k} type="button" onClick={() => { setCatFiltro(catFiltro === k ? null : k); setAba('lanc'); }} className={cn('mb-1.5 block w-full rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2', catFiltro === k && 'bg-surface-2')}>
                        <span className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.cor }} /><span className="truncate text-foreground">{c.nome}</span></span>
                          <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatCurrency(c.valor)}</span>
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(c.valor / porCategoria[0][1].valor) * 100}%`, background: c.cor }} /></span>
                      </button>
                    ))}
                  </section>
                )}
              </aside>

              {/* coluna dos lançamentos */}
              {/* No celular a janela inteira rola (um scroll só); a lista só tem scroll próprio no computador. */}
              <div className="flex flex-col bg-surface md:min-h-0">
                <div className="space-y-3 border-b border-border p-4 md:px-5">
                  <Segmented<'lanc' | 'parc' | 'pag'> value={aba} onChange={setAba} opts={[
                    ['lanc', <span key="l">Lançamentos <span className="text-[11px] opacity-70">{lancamentos.length}</span></span>],
                    ['parc', 'Parcelas futuras'],
                    ['pag', <span key="p">Pagamentos{pagsFatura.length ? <span className="text-[11px] opacity-70"> {pagsFatura.length}</span> : null}</span>],
                  ]} />
                  {aba === 'lanc' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-background px-3">
                        <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar compra ou fornecedor" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground-muted" />
                      </label>
                      <div className="flex gap-1 rounded-full border border-border p-1">
                        {(['data', 'valor'] as const).map((o) => <button key={o} type="button" onClick={() => setOrdem(o)} className={cn('h-7 rounded-full px-3 text-[12.5px]', ordem === o ? 'bg-foreground text-background' : 'text-foreground-muted')}>{o === 'data' ? 'Por dia' : 'Maior valor'}</button>)}
                      </div>
                      {catFiltro && (() => { const c = porCategoria.find(([k]) => k === catFiltro)?.[1]; return c ? <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] text-foreground"><i className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.nome}<button type="button" onClick={() => setCatFiltro(null)} aria-label="Tirar filtro"><X className="h-3.5 w-3.5" /></button></span> : null; })()}
                    </div>
                  )}
                </div>

                <div className="px-4 pb-6 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-5">
                  {aba === 'lanc' && (
                    <>
                      {formulario && <div className="pt-4">{formulario}</div>}
                      {loadingLancs ? (
                        <p className="py-10 text-center text-[13.5px] text-foreground-muted">Carregando…</p>
                      ) : (
                        <>
                          {grupos.map(([dia, itens]) => (
                            <div key={dia || 'valor'}>
                              {dia && (
                                <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-surface/95 px-4 pb-1.5 pt-4 backdrop-blur md:-mx-5 md:px-5">
                                  <p className="text-[12px] font-semibold text-foreground-muted first-letter:uppercase">{diaLongo(dia)}</p>
                                  <p className="text-[12px] tabular-nums text-foreground-muted">{formatCurrency(itens.reduce((s, l) => s + Number(l.valor), 0))}</p>
                                </div>
                              )}
                              {!dia && <div className="h-3" />}
                              {itens.map((l) => {
                                const cor = l.categoria?.cor || COR_SEM;
                                const forn = bonito(l.fornecedor);
                                return (
                                  <div key={l.id} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-2/60">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-semibold uppercase text-white" style={{ background: cor }}>{(forn || bonito(l.descricao) || '?').slice(0, 2)}</span>
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-2"><span className="truncate text-[14px] text-foreground">{bonito(l.descricao)}</span>
                                        {l.parcela_total && l.parcela_total > 1 && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-[1px] text-[10.5px] font-medium text-primary"><Repeat className="h-2.5 w-2.5" />{l.parcela_num}/{l.parcela_total}</span>}</span>
                                      <span className="block truncate text-[12px] text-foreground-muted">{[forn, l.categoria?.nome || 'Sem categoria', ordem === 'valor' ? diaLongo(l.data_competencia) : ''].filter(Boolean).join(' · ')}</span>
                                    </span>
                                    <span className="shrink-0 text-[14.5px] font-semibold tabular-nums text-foreground">{formatCurrency(Number(l.valor))}</span>
                                    <span className="flex shrink-0 gap-0.5 md:opacity-0 md:group-hover:opacity-100">
                                      <button type="button" onClick={() => openEdit(l)} aria-label="Editar" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => setDeleteState(l)} aria-label="Excluir" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-danger-fg"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                          {!filtrados.length && (
                            <div className="py-12 text-center">
                              <p className="text-[13.5px] text-foreground-muted">{lancamentos.length ? 'Nada encontrado com esse filtro.' : 'Sem lançamentos nesta fatura.'}</p>
                              {!lancamentos.length && !formOpen && <button type="button" onClick={openCreate} className={cn(btn.outline, 'mt-3')}><Plus className="h-4 w-4" />Lançar compra</button>}
                            </div>
                          )}
                          {filtrados.length > 0 && (
                            <div className="mt-3 flex justify-between border-t border-border pt-3 text-[13px]"><span className="text-foreground-muted">{filtrados.length} lançamento{filtrados.length === 1 ? '' : 's'}{catFiltro || busca ? ' (filtrados)' : ''}</span><span className="font-semibold tabular-nums text-foreground">{formatCurrency(filtrados.reduce((s, l) => s + Number(l.valor), 0))}</span></div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {aba === 'parc' && (
                    <div className="space-y-3 pt-4">
                      <p className="text-[12.5px] text-foreground-muted">O que já está lançado nas próximas faturas (parcelas e compras futuras).</p>
                      {futuras === null ? <p className="py-8 text-center text-[13.5px] text-foreground-muted">Carregando…</p>
                        : futurasPorFatura.length === 0 ? <p className="rounded-[20px] border border-dashed border-border py-10 text-center text-[13.5px] text-foreground-muted">Nenhuma fatura futura em aberto.</p>
                        : futurasPorFatura.map(({ fatura: f, itens }) => (
                          <section key={f.id} className="rounded-[20px] border border-border p-4">
                            <div className="mb-2 flex items-baseline justify-between"><p className="text-[14px] font-semibold capitalize text-foreground">{format(parseISO(f.competencia), 'MMM/yyyy', { locale: ptBR })} <span className="text-[12px] font-normal normal-case text-foreground-muted">· vence {format(parseISO(f.data_vencimento), 'dd/MM')}</span></p><p className="text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(Number(f.valor_total) - Number(f.valor_pago))}</p></div>
                            {itens.length ? itens.map((l) => (
                              <div key={l.id} className="flex items-center justify-between gap-3 border-t border-border py-2 text-[13px] first:border-t-0">
                                <span className="min-w-0 truncate text-foreground">{bonito(l.descricao)} {l.parcela_total && l.parcela_total > 1 && <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10.5px] text-primary">{l.parcela_num}/{l.parcela_total}</span>}</span>
                                <span className="shrink-0 tabular-nums text-foreground-muted">{formatCurrency(Number(l.valor))}</span>
                              </div>
                            )) : <p className="text-[12.5px] text-foreground-muted">Sem itens lançados ainda.</p>}
                          </section>
                        ))}
                    </div>
                  )}

                  {aba === 'pag' && (
                    <div className="pt-4">
                      {pagsFatura.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-border py-10 text-center">
                          <p className="font-heading text-[18px] font-light text-foreground">Nenhum pagamento ainda</p>
                          <p className="text-[13px] text-foreground-muted">Quando pagar, aparece aqui com a conta e a data.</p>
                          {!paga && <button type="button" onClick={() => onPagar(fatura)} className={cn(btn.primary, 'mt-4')}>Pagar fatura</button>}
                        </div>
                      ) : pagsFatura.map((p) => {
                        const conta = contas.find(c => c.id === p.conta_id);
                        return (
                          <div key={p.id} className="flex items-center gap-3 border-t border-border py-2.5 text-[13.5px] first:border-t-0">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-success-bg text-success-fg"><Check className="h-4 w-4" /></span>
                            <span className="flex-1"><span className="block text-foreground">Pago com {conta?.nome || 'conta'}</span><span className="block text-[12px] text-foreground-muted">{format(parseISO(p.data_pagamento), 'dd/MM/yyyy')}</span></span>
                            <span className="font-semibold tabular-nums text-foreground">{formatCurrency(Number(p.valor))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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
  categorias: { id: string; nome: string; tipo: string; cor?: string }[];
  form: { descricao: string; valor: string | number; data_competencia: string; categoria_id: string; fornecedor: string; parcelas: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setForm: (updater: any) => void;
  editing: LancamentoLite | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const catSel = categorias.find(c => c.id === form.categoria_id);
  type F = typeof form;
  const valorNum = valorNumero(form.valor);
  return (
    <section className="space-y-3 rounded-[20px] border border-foreground/20 bg-background p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">{editing ? 'Editar lançamento' : 'Nova compra no cartão'}</p>
      <Campo label="Descrição">
        <Input value={form.descricao} onChange={(e) => setForm((p: F) => ({ ...p, descricao: e.target.value }))} placeholder="Ex.: Assinatura Netflix" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Valor">
          <div className="flex h-10 items-center rounded-xl border border-input bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-ring">
            <span className="mr-1 text-foreground-muted">R$</span>
            <input type="text" inputMode="numeric" value={mostrarMoeda(valorNumero(form.valor))} onChange={(e) => setForm((p: F) => ({ ...p, valor: digitarMoeda(e.target.value) }))} placeholder="0,00" className="min-w-0 flex-1 bg-transparent font-semibold tabular-nums outline-none" />
          </div>
        </Campo>
        {!editing && (
          <Campo label="Parcelas" hint={form.parcelas > 1 && valorNum > 0 ? `${form.parcelas}× de ${formatCurrency(valorNum / form.parcelas)}` : 'à vista'}>
            <Input type="number" min="1" max="48" step="1" value={form.parcelas} onChange={(e) => setForm((p: F) => ({ ...p, parcelas: Math.max(1, Math.min(48, parseInt(e.target.value) || 1)) }))} />
          </Campo>
        )}
      </div>
      <DatePickerField label="Data da compra" required showQuickButtons value={form.data_competencia} onChange={(v) => setForm((p: F) => ({ ...p, data_competencia: v }))} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Categoria">
          <Select value={form.categoria_id || 'none'} onValueChange={(v) => setForm((p: F) => ({ ...p, categoria_id: v === 'none' ? '' : v }))}>
            <SelectTrigger>
              {catSel
                ? <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: catSel.cor || COR_SEM }} />{catSel.nome}</span>
                : <SelectValue placeholder="Selecionar categoria" />}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categorias.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.cor || COR_SEM }} />{c.nome}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Fornecedor">
          <Input value={form.fornecedor} onChange={(e) => setForm((p: F) => ({ ...p, fornecedor: e.target.value }))} placeholder="Opcional" />
        </Campo>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={btn.outline} onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="button" className={btn.primary} onClick={onSave} disabled={saving || !form.descricao.trim() || !form.valor}>{saving ? 'Salvando…' : editing ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </section>
  );
}
