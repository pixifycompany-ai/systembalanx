import { useState, useMemo } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportFluxoCaixa } from '@/utils/exportCSV';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, Download, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { Bloco, ModalHeader, ModalShell, Segmented } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';

interface FluxoCaixaReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacoes: TransacaoUnificada[];
  contas: Array<{ id: string; nome: string; cor: string }>;
}

const COR_R = 'hsl(var(--primary))';
const COR_D = 'hsl(var(--danger))';

export function FluxoCaixaReport({ open, onOpenChange, transacoes, contas }: FluxoCaixaReportProps) {
  const [tipoFilter, setTipoFilter] = useState<'todas' | 'entrada' | 'saida'>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contaFilter, setContaFilter] = useState<string>('all');
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return transacoes.filter(t => {
      if (tipoFilter !== 'todas' && t.tipo !== tipoFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (contaFilter !== 'all' && t.conta_id !== contaFilter) return false;
      if (dateStart && dateEnd && t.data_vencimento) {
        const d = parseISO(t.data_vencimento);
        if (!isWithinInterval(d, { start: dateStart, end: dateEnd })) return false;
      }
      return true;
    });
  }, [transacoes, tipoFilter, statusFilter, contaFilter, dateStart, dateEnd]);

  const totals = useMemo(() => {
    const entradas = filtered.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const saidas = filtered.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtered]);

  // Entradas × saídas por mês
  const monthlyData = useMemo(() => {
    const months: Record<string, { r: number; d: number; m: string }> = {};
    filtered.forEach(t => {
      if (!t.data_vencimento) return;
      const key = t.data_vencimento.slice(0, 7);
      if (!months[key]) months[key] = { r: 0, d: 0, m: format(parseISO(t.data_vencimento), 'MMM/yy', { locale: ptBR }) };
      if (t.tipo === 'entrada') months[key].r += t.valor;
      else months[key].d += t.valor;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filtered]);

  // Saídas por categoria (barras)
  const categoryData = useMemo(() => {
    const cats: Record<string, { nome: string; valor: number; cor: string }> = {};
    filtered.filter(t => t.tipo === 'saida' && t.tabela_origem !== 'transferencia').forEach(t => {
      const key = t.categoria?.nome || 'Sem categoria';
      if (!cats[key]) cats[key] = { nome: key, valor: 0, cor: t.categoria?.cor || '#6B7280' };
      cats[key].valor += t.valor;
    });
    return Object.values(cats).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);
  const maxCat = categoryData[0]?.valor || 1;

  const exportar = () => {
    exportFluxoCaixa(filtered.map(t => ({
      data: formatDate(t.data_vencimento),
      tipo: t.tipo === 'entrada' ? 'Entrada' : 'Saída',
      descricao: t.descricao,
      origem: t.cliente?.nome || t.fornecedor || '-',
      valor: t.valor,
      status: t.status_display,
      categoria: t.categoria?.nome || '-',
    })));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[960px]')}>
        <ModalShell>
          <ModalHeader eyebrow="Relatório" title="Fluxo de caixa" onClose={() => onOpenChange(false)}>
            <button type="button" onClick={exportar} className={cn(btn.outline, 'no-print h-9 px-3 text-[13px]')}><Download className="h-4 w-4" />Excel</button>
            <button type="button" onClick={() => window.print()} className={cn(btn.primary, 'no-print h-9 px-3.5 text-[13px]')}><Printer className="h-4 w-4" />Imprimir / PDF</button>
          </ModalHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
            {/* filtros */}
            <div className="no-print flex flex-wrap items-center gap-2">
              <Segmented<'todas' | 'entrada' | 'saida'> size="sm" value={tipoFilter} onChange={setTipoFilter} opts={[['todas', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas']]} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cn(campoCls, 'h-10 w-auto rounded-full bg-surface')} aria-label="Status">
                <option value="all">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="recebido">Recebido</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
              </select>
              <select value={contaFilter} onChange={(e) => setContaFilter(e.target.value)} className={cn(campoCls, 'h-10 w-auto rounded-full bg-surface')} aria-label="Conta">
                <option value="all">Todas as contas</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={cn(btn.outline, 'h-10')}>
                    <CalendarRange className="h-4 w-4" />
                    {dateStart && dateEnd ? `${format(dateStart, 'dd/MM/yy')} – ${format(dateEnd, 'dd/MM/yy')}` : 'Período'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[820px] max-w-[calc(100vw-2rem)] p-5" align="start">
                  <DateRangePicker
                    from={dateStart}
                    to={dateEnd}
                    onApply={(de, ate) => { setDateStart(de); setDateEnd(ate); }}
                    onClear={() => { setDateStart(undefined); setDateEnd(undefined); }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="print-area space-y-3">
              <h2 className="hidden text-center text-xl font-semibold print:block">Relatório de Fluxo de Caixa</h2>
              <div className="grid grid-cols-3 gap-2">
                {([['Entradas', totals.entradas, 'text-success-fg'], ['Saídas', totals.saidas, 'text-danger-fg'], ['Resultado', totals.saldo, totals.saldo >= 0 ? 'text-foreground' : 'text-danger-fg']] as const).map(([r, v, c]) => (
                  <div key={r} className="rounded-[20px] border border-border bg-surface p-3.5">
                    <p className="text-[12px] text-foreground-muted">{r}</p>
                    <p className={cn('font-heading text-[17px] font-semibold tabular-nums tracking-[-0.02em] md:text-[22px]', c)}>{formatCurrency(v)}</p>
                  </div>
                ))}
              </div>

              {monthlyData.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <Bloco title="Entradas × saídas por mês">
                    <div className="mb-2 flex gap-3 text-[12px] text-foreground-muted">
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: COR_R }} />Entradas</span>
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: COR_D }} />Saídas</span>
                    </div>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                          <defs>
                            <linearGradient id="rpR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COR_R} stopOpacity={0.4} /><stop offset="100%" stopColor={COR_R} stopOpacity={0} /></linearGradient>
                            <linearGradient id="rpD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COR_D} stopOpacity={0.2} /><stop offset="100%" stopColor={COR_D} stopOpacity={0} /></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="m" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                          <Tooltip formatter={(v: number, n) => [formatCurrency(v), n === 'r' ? 'Entradas' : 'Saídas']} contentStyle={{ borderRadius: 14, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                          <Area type="monotone" dataKey="d" stroke={COR_D} strokeWidth={2} fill="url(#rpD)" />
                          <Area type="monotone" dataKey="r" stroke={COR_R} strokeWidth={2.5} fill="url(#rpR)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Bloco>
                  <Bloco title="Saídas por categoria">
                    {categoryData.length === 0 ? <p className="text-[13px] text-foreground-muted">Sem saídas no filtro.</p> : (
                      <div className="space-y-3">
                        {categoryData.map((c) => (
                          <div key={c.nome}>
                            <div className="flex justify-between gap-2 text-[13px]">
                              <span className="flex min-w-0 items-center gap-1.5 text-foreground"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.cor }} /><span className="truncate">{c.nome}</span></span>
                              <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(c.valor)}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(c.valor / maxCat) * 100}%`, background: c.cor }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Bloco>
                </div>
              )}

              <Bloco title={`Detalhamento · ${filtered.length} lançamentos`}>
                <div className="-mx-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[12px] text-foreground-muted">
                        <th className="px-4 py-2 text-left font-normal">Data</th>
                        <th className="px-2 py-2 text-left font-normal">Descrição</th>
                        <th className="px-2 py-2 text-left font-normal">Categoria</th>
                        <th className="px-2 py-2 text-left font-normal">Cliente / fornecedor</th>
                        <th className="px-2 py-2 text-right font-normal">Valor</th>
                        <th className="px-4 py-2 text-right font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 200).map(t => (
                        <tr key={`${t.tabela_origem}-${t.id}-${t.tipo}`} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2 tabular-nums text-foreground-muted">{formatDate(t.data_vencimento)}</td>
                          <td className="max-w-[220px] truncate px-2 py-2 text-foreground">{t.descricao}</td>
                          <td className="px-2 py-2 text-foreground-muted">{t.categoria?.nome || '—'}</td>
                          <td className="px-2 py-2 text-foreground-muted">{t.cliente?.nome || t.fornecedor || '—'}</td>
                          <td className={cn('whitespace-nowrap px-2 py-2 text-right tabular-nums', t.tipo === 'entrada' ? 'text-success-fg' : 'text-danger-fg')}>
                            {t.tipo === 'entrada' ? '+' : '−'}{formatCurrency(t.valor)}
                          </td>
                          <td className="px-4 py-2 text-right text-foreground-muted">{t.status_display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 200 && <p className="px-4 pt-2 text-center text-[12px] text-foreground-muted">Mostrando 200 de {filtered.length}. Use o Excel para a lista completa.</p>}
                </div>
              </Bloco>
            </div>
          </div>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}
