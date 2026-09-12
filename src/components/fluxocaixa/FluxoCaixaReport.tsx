import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';

interface FluxoCaixaReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacoes: TransacaoUnificada[];
  contas: Array<{ id: string; nome: string; cor: string }>;
}

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export function FluxoCaixaReport({ open, onOpenChange, transacoes, contas }: FluxoCaixaReportProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [tipoFilter, setTipoFilter] = useState<string>('todas');
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

  // Monthly bar chart data
  const monthlyData = useMemo(() => {
    const months: Record<string, { entradas: number; saidas: number; label: string }> = {};
    filtered.forEach(t => {
      if (!t.data_vencimento) return;
      const key = t.data_vencimento.slice(0, 7);
      if (!months[key]) {
        const d = parseISO(t.data_vencimento);
        const label = format(d, 'MMM/yy', { locale: ptBR });
        months[key] = { entradas: 0, saidas: 0, label };
      }
      if (t.tipo === 'entrada') months[key].entradas += t.valor;
      else months[key].saidas += t.valor;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filtered]);

  // Category pie data
  const categoryData = useMemo(() => {
    const cats: Record<string, { nome: string; valor: number; cor: string }> = {};
    filtered.forEach(t => {
      const key = t.categoria?.nome || 'Sem categoria';
      if (!cats[key]) cats[key] = { nome: key, valor: 0, cor: t.categoria?.cor || '#6B7280' };
      cats[key].valor += t.valor;
    });
    return Object.values(cats).sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Relatório do Fluxo de Caixa</span>
            <Button onClick={handlePrint} className="gap-2 no-print">
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4 no-print">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={contaFilter} onValueChange={setContaFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Contas</SelectItem>
              {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateStart && dateEnd
                  ? `${format(dateStart, 'dd/MM/yy')} - ${format(dateEnd, 'dd/MM/yy')}`
                  : 'Período'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">De</Label>
                  <Calendar mode="single" selected={dateStart} onSelect={setDateStart} className="pointer-events-auto rounded border" />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Calendar mode="single" selected={dateEnd} onSelect={setDateEnd} className="pointer-events-auto rounded border" />
                </div>
              </div>
              {(dateStart || dateEnd) && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setDateStart(undefined); setDateEnd(undefined); }}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Report content (printable) */}
        <div ref={printRef} className="print-area space-y-6">
          <h2 className="text-xl font-semibold text-center hidden print:block">Relatório de Fluxo de Caixa</h2>
          
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-lg font-semibold text-emerald-600">{formatCurrency(totals.entradas)}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-lg font-semibold text-rose-600">{formatCurrency(totals.saidas)}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={cn("text-lg font-semibold", totals.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {formatCurrency(totals.saldo)}
              </p>
            </div>
          </div>

          {/* Charts row */}
          {monthlyData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Entradas vs Saídas por Mês</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Por Categoria</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`} labelLine fontSize={10}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.cor || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Detalhamento ({filtered.length} lançamentos)</h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Origem</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map(t => (
                    <tr key={`${t.tabela_origem}-${t.id}`} className="border-b">
                      <td className="p-2">{formatDate(t.data_vencimento)}</td>
                      <td className="p-2">{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
                      <td className="p-2 max-w-[150px] truncate">{t.descricao}</td>
                      <td className="p-2">{t.categoria?.nome || '-'}</td>
                      <td className="p-2">{t.cliente?.nome || t.fornecedor || '-'}</td>
                      <td className={cn("p-2 text-right font-medium", t.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600')}>
                        {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                      </td>
                      <td className="p-2 text-center">{t.status_display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
