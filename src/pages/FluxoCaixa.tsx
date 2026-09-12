import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEffect as useEffectForAction } from 'react';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTable, LoadingSpinner } from '@/components/shared/LoadingSpinner';

import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FileImportDialog } from '@/components/import/FileImportDialog';
import { FluxoCaixaReport } from '@/components/fluxocaixa/FluxoCaixaReport';
import { LinkedAuxiliaryList } from '@/components/fluxocaixa/LinkedAuxiliaryList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportFluxoCaixa } from '@/utils/exportCSV';
import { useFluxoCaixa, type ReceitaFormData, type DespesaFormData } from '@/hooks/useFluxoCaixa';
import { useClientes } from '@/hooks/useClientes';
import { useContas, useAccountRunningBalance } from '@/hooks/useContas';
import { useTransferencias, type TransferenciaFormData } from '@/hooks/useTransferencias';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { TrendingUp, TrendingDown, ArrowLeftRight, ArrowRightLeft, Filter, Plus, Pencil, Trash2, Upload, CalendarIcon, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CalendarRange, X, FileText, BarChart3, Repeat, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FluxoCaixaKPIRow } from '@/components/fluxocaixa/FluxoCaixaKPIRow';
import { ReceiptGenerator, type ReceiptData } from '@/components/shared/ReceiptGenerator';
import { DatePickerField, QuickDateButtons } from '@/components/shared/DatePickerField';
import { IconButton } from '@/components/shared/IconButton';
import { FilterPill } from '@/components/shared/FilterPill';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { HeroStatCard } from '@/components/shared/HeroStatCard';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TipoTransacao, TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { createAuxiliaryTransactions } from '@/hooks/useAuxiliaryTransactions';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTransactionList } from '@/components/fluxocaixa/MobileTransactionList';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { TransactionDetailSheet } from '@/components/fluxocaixa/TransactionDetailSheet';
import { toast } from 'sonner';

// Sorting types
type SortColumn = 'data_vencimento' | 'tipo' | 'descricao' | 'origem' | 'valor' | 'status' | 'categoria' | 'conta';
type SortDirection = 'asc' | 'desc';

const FORMA_PAGAMENTO_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

const DESPESA_TIPO_OPTIONS = [
  { value: 'fixa', label: 'Fixa' },
  { value: 'variavel', label: 'Variável' },
];

const RECURRENCE_OPTIONS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
];

function calculateNextDate(baseDate: string, frequency: string, index: number): string {
  const d = parseISO(baseDate);
  switch (frequency) {
    case 'semanal': return format(addWeeks(d, index), 'yyyy-MM-dd');
    case 'quinzenal': return format(addDays(d, index * 14), 'yyyy-MM-dd');
    case 'mensal': return format(addMonths(d, index), 'yyyy-MM-dd');
    case 'anual': return format(addYears(d, index), 'yyyy-MM-dd');
    default: return baseDate;
  }
}

export default function FluxoCaixa() {
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get('action');
  const { 
    transacoes, 
    isLoading, 
    categoriasReceita, 
    categoriasDespesa,
    createReceita,
    updateReceita,
    deleteReceita,
    deleteMultipleReceitas,
    createDespesa,
    updateDespesa,
    deleteDespesa,
    deleteMultipleDespesas,
    updateMultipleStatus,
    updateMultipleCliente,
    updateMultipleFornecedor,
    updateMultipleConta,
    refetch: refetchFluxo,
  } = useFluxoCaixa();
  
  const { clientes } = useClientes();
  const { contas, refetch: refetchContas } = useContas();
  const { transferencias, createTransferencia, deleteTransferencia, refetch: refetchTransferencias } = useTransferencias();
  
  // Initialize filters from URL query params
  const initialTipo = (searchParams.get('tipo') as TipoTransacao) || 'todas';
  const initialStatus = searchParams.get('status')?.split(',').filter(Boolean) || [];
  const initialSearch = searchParams.get('search') || '';
  
  // Filters - default to current month
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [tipoFilter, setTipoFilter] = useState<TipoTransacao>(initialTipo);
  const [statusFilter, setStatusFilter] = useState<string[]>(initialStatus);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [contaFilter, setContaFilter] = useState<string>('all');
  const singleAccountId = contaFilter !== 'all' ? contaFilter : null;
  const { data: runningBalance } = useAccountRunningBalance(singleAccountId);
  
  // Date range filter
  const [dateFilterMode, setDateFilterMode] = useState<'month' | 'range'>('month');
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  
  // Sorting
  const isMobile = useIsMobile();
  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'data_vencimento',
    direction: 'asc',
  });

  // Modal states
  const [entradaModalOpen, setEntradaModalOpen] = useState(false);
  const [saidaModalOpen, setSaidaModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<TransacaoUnificada | null>(null);
  const [editingItem, setEditingItem] = useState<TransacaoUnificada | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; tipo: 'receitas' | 'despesas' | 'transferencia' } | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Import & Report dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [transferData, setTransferData] = useState<TransferenciaFormData>({
    conta_origem_id: '',
    conta_destino_id: '',
    valor: 0,
    descricao: '',
    data_transferencia: format(new Date(), 'yyyy-MM-dd'),
  });

  // Receipt states
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Recurrence state (for new entries only)
  const [entradaRecurrence, setEntradaRecurrence] = useState<'unico' | 'recorrente'>('unico');
  const [entradaFrequency, setEntradaFrequency] = useState('mensal');
  const [entradaRepeatTimes, setEntradaRepeatTimes] = useState(12);
  const [saidaRecurrence, setSaidaRecurrence] = useState<'unico' | 'recorrente'>('unico');
  const [saidaFrequency, setSaidaFrequency] = useState('mensal');
  const [saidaRepeatTimes, setSaidaRepeatTimes] = useState(12);

  // Juros/Multa, Tarifa e Imposto states
  const [entradaValorJuros, setEntradaValorJuros] = useState('');
  const [entradaValorTarifa, setEntradaValorTarifa] = useState('');
  const [entradaValorImposto, setEntradaValorImposto] = useState('');
  const [saidaValorJuros, setSaidaValorJuros] = useState('');
  const [saidaValorTarifa, setSaidaValorTarifa] = useState('');
  const [saidaValorImposto, setSaidaValorImposto] = useState('');

  // Form states
  const [formEntrada, setFormEntrada] = useState<ReceitaFormData>({
    descricao: '',
    valor: 0,
    cliente_id: undefined,
    categoria_id: undefined,
    conta_id: undefined,
    data_competencia: format(new Date(), 'yyyy-MM-dd'),
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    data_recebimento: undefined,
    status: 'pendente',
    forma_pagamento: undefined,
  });

  const [formSaida, setFormSaida] = useState<DespesaFormData>({
    descricao: '',
    valor: 0,
    cliente_id: undefined,
    fornecedor: undefined,
    categoria_id: undefined,
    conta_id: undefined,
    data_competencia: format(new Date(), 'yyyy-MM-dd'),
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    data_pagamento: undefined,
    status: 'pendente',
    tipo: 'variavel',
    forma_pagamento: undefined,
  });


  // Status options based on tipo filter
  const statusOptions = useMemo(() => {
    if (tipoFilter === 'entrada') {
      return [
        { value: 'pendente', label: 'Pendente' },
        { value: 'recebido', label: 'Recebido' },
        { value: 'atrasado', label: 'Atrasado' },
      ];
    } else if (tipoFilter === 'saida') {
      return [
        { value: 'pendente', label: 'Pendente' },
        { value: 'pago', label: 'Pago' },
        { value: 'atrasado', label: 'Atrasado' },
      ];
    }
    return [
      { value: 'pendente', label: 'Pendente' },
      { value: 'recebido', label: 'Recebido' },
      { value: 'pago', label: 'Pago' },
      { value: 'atrasado', label: 'Atrasado' },
    ];
  }, [tipoFilter]);

  // Filter transactions
  const filteredTransacoes = useMemo(() => {
    const filtered = transacoes.filter(t => {
      const matchesTipo = tipoFilter === 'todas' || t.tipo === tipoFilter;
      // "Pendente" engloba os vencidos (status 'atrasado') — não expomos filtro de atrasado separado.
      const matchesStatus =
        statusFilter.length === 0 ||
        statusFilter.includes(t.status) ||
        (statusFilter.includes('pendente') && t.status === 'atrasado');
      const matchesSearch = !searchTerm || 
        t.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesConta = contaFilter === 'all' || t.conta_id === contaFilter;
      
      let matchesDate = true;
      if (dateFilterMode === 'month' && monthFilter !== 'all' && t.data_vencimento) {
        const vencimento = parseISO(t.data_vencimento);
        const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
        const monthEnd = endOfMonth(monthStart);
        matchesDate = isWithinInterval(vencimento, { start: monthStart, end: monthEnd });
      } else if (dateFilterMode === 'range' && dateRangeStart && dateRangeEnd && t.data_vencimento) {
        const vencimento = parseISO(t.data_vencimento);
        matchesDate = isWithinInterval(vencimento, { start: dateRangeStart, end: dateRangeEnd });
      }
      
      return matchesTipo && matchesStatus && matchesSearch && matchesConta && matchesDate;
    });
    
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortConfig.column) {
        case 'data_vencimento':
          comparison = a.data_vencimento.localeCompare(b.data_vencimento);
          break;
        case 'tipo':
          comparison = a.tipo.localeCompare(b.tipo);
          break;
        case 'descricao':
          comparison = a.descricao.localeCompare(b.descricao);
          break;
        case 'origem':
          const origemA = a.cliente?.nome || a.fornecedor || '';
          const origemB = b.cliente?.nome || b.fornecedor || '';
          comparison = origemA.localeCompare(origemB);
          break;
        case 'categoria':
          comparison = (a.categoria?.nome || '').localeCompare(b.categoria?.nome || '');
          break;
        case 'conta': {
          const contaA = contas.find(c => c.id === a.conta_id)?.nome || '';
          const contaB = contas.find(c => c.id === b.conta_id)?.nome || '';
          comparison = contaA.localeCompare(contaB);
          break;
        }
        case 'valor':
          comparison = a.valor - b.valor;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [transacoes, tipoFilter, statusFilter, monthFilter, searchTerm, contaFilter, dateFilterMode, dateRangeStart, dateRangeEnd, sortConfig, contas]);

  // Handle sort toggle
  const handleSort = (column: SortColumn) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Sortable header component
  const SortableHeader = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <th 
      className={cn(
        "text-left p-3 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none transition-colors",
        className
      )}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortConfig.column === column && (
          sortConfig.direction === 'asc' 
            ? <ChevronUp className="h-3 w-3" /> 
            : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  // Calculate totals (transferências são neutras — não afetam entradas/saídas/saldo)
  const totals = useMemo(() => {
    const reaisTransacoes = filteredTransacoes.filter(t => t.tabela_origem !== 'transferencia');
    const entradas = reaisTransacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const saidas = reaisTransacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filteredTransacoes]);

  const hasFilters = statusFilter.length > 0 || monthFilter !== 'all' || searchTerm !== '' || contaFilter !== 'all' || (dateFilterMode === 'range' && dateRangeStart && dateRangeEnd);

  // Multi-select
  const {
    selectedIds,
    selectedItems,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,
  } = useMultiSelect({
    items: filteredTransacoes,
    getItemId: (t) => `${t.tabela_origem}-${t.id}-${t.tipo}`,
  });

  const selectedEntradas = selectedItems.filter(t => t.tipo === 'entrada');
  const selectedSaidas = selectedItems.filter(t => t.tipo === 'saida');
  const hasEntradas = selectedEntradas.length > 0;
  const hasSaidas = selectedSaidas.length > 0;

  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.nome }));

  const multiSelectStatusOptions = useMemo(() => {
    if (hasEntradas && !hasSaidas) {
      return [
        { value: 'pendente', label: 'Pendente' },
        { value: 'recebido', label: 'Recebido' },
        { value: 'atrasado', label: 'Atrasado' },
      ];
    } else if (hasSaidas && !hasEntradas) {
      return [
        { value: 'pendente', label: 'Pendente' },
        { value: 'pago', label: 'Pago' },
        { value: 'atrasado', label: 'Atrasado' },
      ];
    }
    return [
      { value: 'pendente', label: 'Pendente' },
      { value: 'atrasado', label: 'Atrasado' },
    ];
  }, [hasEntradas, hasSaidas]);

  // Helper to refresh contas after CRUD
  const syncContas = async () => {
    await refetchContas();
  };

  const activeContas = contas.filter(c => c.ativa);

  const handleTransfer = async () => {
    if (!transferData.conta_origem_id || !transferData.conta_destino_id || transferData.valor <= 0) return;
    
    const result = await createTransferencia(transferData);
    if (result) {
      setTransferModalOpen(false);
      setTransferData({
        conta_origem_id: '',
        conta_destino_id: '',
        valor: 0,
        descricao: '',
        data_transferencia: format(new Date(), 'yyyy-MM-dd'),
      });
      refetchContas();
      refetchTransferencias();
    }
  };

  // Handlers
  const handleNewEntrada = () => {
    setEditingItem(null);
    setEntradaRecurrence('unico');
    setEntradaFrequency('mensal');
    setEntradaRepeatTimes(12);
    setFormEntrada({
      descricao: '',
      valor: 0,
      cliente_id: undefined,
      categoria_id: undefined,
      conta_id: undefined,
      data_competencia: format(new Date(), 'yyyy-MM-dd'),
      data_vencimento: format(new Date(), 'yyyy-MM-dd'),
      data_recebimento: undefined,
      status: 'pendente',
      forma_pagamento: undefined,
    });
    setEntradaValorJuros('');
    setEntradaValorTarifa('');
    setEntradaValorImposto('');
    setEntradaModalOpen(true);
  };

  const handleEditEntrada = (t: TransacaoUnificada) => {
    setEditingItem(t);
    setEntradaRecurrence('unico');
    setFormEntrada({
      descricao: t.descricao,
      valor: t.valor,
      cliente_id: t.cliente_id || undefined,
      categoria_id: t.categoria_id || undefined,
      conta_id: t.conta_id || undefined,
      data_competencia: t.data_competencia,
      data_vencimento: t.data_vencimento,
      data_recebimento: t.data_efetivacao || undefined,
      status: t.status as 'pendente' | 'recebido' | 'atrasado',
      forma_pagamento: t.forma_pagamento || undefined,
    });
    setEntradaValorJuros('');
    setEntradaValorTarifa('');
    setEntradaValorImposto('');
    setEntradaModalOpen(true);
  };

  const handleNewSaida = () => {
    setEditingItem(null);
    setSaidaRecurrence('unico');
    setSaidaFrequency('mensal');
    setSaidaRepeatTimes(12);
    setFormSaida({
      descricao: '',
      valor: 0,
      cliente_id: undefined,
      fornecedor: undefined,
      categoria_id: undefined,
      conta_id: undefined,
      data_competencia: format(new Date(), 'yyyy-MM-dd'),
      data_vencimento: format(new Date(), 'yyyy-MM-dd'),
      data_pagamento: undefined,
      status: 'pendente',
      tipo: 'variavel',
      forma_pagamento: undefined,
    });
    setSaidaValorJuros('');
    setSaidaValorTarifa('');
    setSaidaValorImposto('');
    setSaidaModalOpen(true);
  };

  const handleEditSaida = (t: TransacaoUnificada) => {
    setEditingItem(t);
    setSaidaRecurrence('unico');
    setFormSaida({
      descricao: t.descricao,
      valor: t.valor,
      cliente_id: t.cliente_id || undefined,
      fornecedor: t.fornecedor || undefined,
      categoria_id: t.categoria_id || undefined,
      conta_id: t.conta_id || undefined,
      data_competencia: t.data_competencia,
      data_vencimento: t.data_vencimento,
      data_pagamento: t.data_efetivacao || undefined,
      status: t.status as 'pendente' | 'pago' | 'atrasado',
      tipo: t.tipo_despesa || 'variavel',
    });
    setSaidaValorJuros('');
    setSaidaValorTarifa('');
    setSaidaValorImposto('');
    setSaidaModalOpen(true);
  };

  // Row click handler → abre o detalhe (bottom sheet)
  const handleRowClick = (t: TransacaoUnificada) => {
    if (t.tabela_origem === 'transferencia') return; // Transferências não abrem detalhe
    setDetailItem(t);
  };

  const handleEditFromDetail = (t: TransacaoUnificada) => {
    if (t.tipo === 'entrada') handleEditEntrada(t);
    else handleEditSaida(t);
  };

  const handleSubmitEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEntrada.descricao || formEntrada.valor <= 0) return;

    setIsSaving(true);
    let success: boolean;
    
    if (editingItem) {
      success = await updateReceita(editingItem.id, formEntrada);
    } else if (entradaRecurrence === 'recorrente' && entradaRepeatTimes > 1) {
      // Create multiple entries with shared recurrence_group_id
      const groupId = crypto.randomUUID();
      success = true;
      for (let i = 0; i < entradaRepeatTimes; i++) {
        const data = {
          ...formEntrada,
          data_competencia: calculateNextDate(formEntrada.data_competencia, entradaFrequency, i),
          data_vencimento: calculateNextDate(formEntrada.data_vencimento, entradaFrequency, i),
          descricao: `${formEntrada.descricao} (${i + 1}/${entradaRepeatTimes})`,
        };
        // Pass recurrence_group_id via the insert (handled by supabase directly)
        const r = await createReceita(data);
        if (!r) { success = false; break; }
      }
    } else {
      success = await createReceita(formEntrada);
    }
    
    if (success) {
      // Create auxiliary transactions for juros/tarifa when status is 'recebido'
      if (formEntrada.status === 'recebido') {
        const valorJuros = parseFloat(entradaValorJuros) || 0;
        const valorTarifa = parseFloat(entradaValorTarifa) || 0;
        const valorImposto = parseFloat(entradaValorImposto) || 0;
        if (valorJuros > 0 || valorTarifa > 0 || valorImposto > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await createAuxiliaryTransactions({
              tipo: 'receita',
              descricaoOrigem: formEntrada.descricao,
              valorJuros,
              valorTarifa,
              valorImposto,
              data_competencia: formEntrada.data_competencia,
              data_vencimento: formEntrada.data_vencimento,
              conta_id: formEntrada.conta_id,
              cliente_id: formEntrada.cliente_id,
              user_id: user.id,
              origem_id: editingItem?.id,
              origem_tipo: editingItem ? 'receita' : undefined,
            });
          }
        }
      }
      setEntradaModalOpen(false);
      syncContas();
    }
    setIsSaving(false);
  };


  const handleSubmitSaida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSaida.descricao || formSaida.valor <= 0) return;

    setIsSaving(true);
    let success: boolean;
    
    if (editingItem) {
      success = await updateDespesa(editingItem.id, formSaida);
    } else if (saidaRecurrence === 'recorrente' && saidaRepeatTimes > 1) {
      const groupId = crypto.randomUUID();
      success = true;
      for (let i = 0; i < saidaRepeatTimes; i++) {
        const data = {
          ...formSaida,
          data_competencia: calculateNextDate(formSaida.data_competencia, saidaFrequency, i),
          data_vencimento: calculateNextDate(formSaida.data_vencimento, saidaFrequency, i),
          descricao: `${formSaida.descricao} (${i + 1}/${saidaRepeatTimes})`,
        };
        const r = await createDespesa(data);
        if (!r) { success = false; break; }
      }
    } else {
      success = await createDespesa(formSaida);
    }
    
    if (success) {
      // Create auxiliary transactions for juros/tarifa when status is 'pago'
      if (formSaida.status === 'pago') {
        const valorJuros = parseFloat(saidaValorJuros) || 0;
        const valorTarifa = parseFloat(saidaValorTarifa) || 0;
        const valorImposto = parseFloat(saidaValorImposto) || 0;
        if (valorJuros > 0 || valorTarifa > 0 || valorImposto > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await createAuxiliaryTransactions({
              tipo: 'despesa',
              descricaoOrigem: formSaida.descricao,
              valorJuros,
              valorTarifa,
              valorImposto,
              data_competencia: formSaida.data_competencia,
              data_vencimento: formSaida.data_vencimento,
              conta_id: formSaida.conta_id,
              cliente_id: formSaida.cliente_id,
              user_id: user.id,
              origem_id: editingItem?.id,
              origem_tipo: editingItem ? 'despesa' : undefined,
            });
          }
        }
      }
      setSaidaModalOpen(false);
      syncContas();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    
    setIsSaving(true);
    let success = false;
    if (deletingItem.tipo === 'receitas') {
      success = await deleteReceita(deletingItem.id);
    } else if (deletingItem.tipo === 'despesas') {
      success = await deleteDespesa(deletingItem.id);
    } else if (deletingItem.tipo === 'transferencia') {
      success = await deleteTransferencia(deletingItem.id);
      if (success) {
        await refetchFluxo();
        await refetchTransferencias();
      }
    }
    
    if (success) {
      setDeleteDialogOpen(false);
      syncContas();
    }
    setDeletingItem(null);
    setIsSaving(false);
  };

  const handleBulkDelete = async () => {
    setIsSaving(true);
    
    const entradaIds = selectedEntradas.map(t => t.id);
    const saidaIds = selectedSaidas.map(t => t.id);
    
    let success = true;
    if (entradaIds.length > 0) {
      success = await deleteMultipleReceitas(entradaIds) && success;
    }
    if (saidaIds.length > 0) {
      success = await deleteMultipleDespesas(saidaIds) && success;
    }
    
    if (success) {
      setBulkDeleteDialogOpen(false);
      clearSelection();
      syncContas();
    }
    setIsSaving(false);
  };

  const handleBulkStatusChange = async (status: string) => {
    setIsSaving(true);
    
    if (hasEntradas && !hasSaidas) {
      await updateMultipleStatus(selectedEntradas.map(t => t.id), 'receitas', status);
    } else if (hasSaidas && !hasEntradas) {
      await updateMultipleStatus(selectedSaidas.map(t => t.id), 'despesas', status);
    } else {
      if (selectedEntradas.length > 0) {
        await updateMultipleStatus(selectedEntradas.map(t => t.id), 'receitas', status);
      }
      if (selectedSaidas.length > 0) {
        await updateMultipleStatus(selectedSaidas.map(t => t.id), 'despesas', status);
      }
    }
    
    clearSelection();
    syncContas();
    setIsSaving(false);
  };

  const handleBulkClienteChange = async (clienteId: string) => {
    setIsSaving(true);
    await updateMultipleCliente(selectedEntradas.map(t => t.id), clienteId);
    clearSelection();
    setIsSaving(false);
  };

  const handleBulkFornecedorChange = async (fornecedor: string) => {
    setIsSaving(true);
    await updateMultipleFornecedor(selectedSaidas.map(t => t.id), fornecedor);
    clearSelection();
    setIsSaving(false);
  };

  const handleBulkContaChange = async (contaId: string) => {
    setIsSaving(true);
    await updateMultipleConta(
      selectedEntradas.map(t => t.id),
      selectedSaidas.map(t => t.id),
      contaId
    );
    clearSelection();
    syncContas();
    setIsSaving(false);
  };


  const handleExport = () => {
    const dataToExport = (selectedItems.length > 0 ? selectedItems : filteredTransacoes).map(t => ({
      data: formatDate(t.data_vencimento),
      tipo: t.tipo === 'entrada' ? 'Entrada' : 'Saída',
      descricao: t.descricao,
      origem: t.cliente?.nome || t.fornecedor || '-',
      valor: t.valor,
      status: t.status_display,
      categoria: t.categoria?.nome || '-',
    }));
    exportFluxoCaixa(dataToExport);
    clearSelection();
  };

  // DatePickerField and QuickDateButtons imported from shared

  // Recurrence section component
  const RecurrenceSection = ({
    recurrence,
    setRecurrence,
    frequency,
    setFrequency,
    repeatTimes,
    setRepeatTimes,
  }: {
    recurrence: 'unico' | 'recorrente';
    setRecurrence: (v: 'unico' | 'recorrente') => void;
    frequency: string;
    setFrequency: (v: string) => void;
    repeatTimes: number;
    setRepeatTimes: (v: number) => void;
  }) => (
    <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-muted/20">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lançamento</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={recurrence === 'unico' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRecurrence('unico')}
          className="text-xs"
        >
          Único
        </Button>
        <Button
          type="button"
          variant={recurrence === 'recorrente' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRecurrence('recorrente')}
          className="text-xs gap-1"
        >
          <Repeat className="h-3 w-3" />
          Recorrente
        </Button>
      </div>
      {recurrence === 'recorrente' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Frequência</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Repetir (vezes)</Label>
            <Input
              type="number"
              min={2}
              max={60}
              value={repeatTimes}
              onChange={(e) => setRepeatTimes(Math.max(2, Math.min(60, parseInt(e.target.value) || 2)))}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );

  // Handle action param from mobile nav
  useEffectForAction(() => {
    if (actionParam === 'nova-entrada') {
      handleNewEntrada();
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    } else if (actionParam === 'nova-saida') {
      handleNewSaida();
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    } else if (actionParam === 'nova-transferencia') {
      setTransferModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [actionParam]);

  // Mobile swipe confirm handler — atualiza SÓ status+data (update parcial preserva categoria/conta/cliente/etc)
  const handleMobileConfirm = async (t: TransacaoUnificada) => {
    if (t.tabela_origem === 'transferencia') return; // não há "dar baixa" em transferências
    if (t.tipo === 'entrada') {
      await updateReceita(t.id, { status: 'recebido', data_recebimento: format(new Date(), 'yyyy-MM-dd') });
    } else {
      await updateDespesa(t.id, { status: 'pago', data_pagamento: format(new Date(), 'yyyy-MM-dd') });
    }
    // Re-busca lançamentos + contas pra lista refletir o estado real (com joins de categoria/conta)
    await Promise.all([refetchFluxo(), refetchContas()]);
  };

  // Mobile swipe delete handler
  const handleMobileDelete = (t: TransacaoUnificada) => {
    setDeletingItem({ id: t.id, tipo: t.tabela_origem });
    setDeleteDialogOpen(true);
  };

  // Long-press → Duplicar (cria cópia como pendente)
  const handleDuplicate = async (t: TransacaoUnificada) => {
    if (t.tabela_origem === 'transferencia') return;
    const base: any = {
      descricao: `${t.descricao} (cópia)`,
      valor: Number(t.valor),
      categoria_id: t.categoria_id || undefined,
      conta_id: t.conta_id || undefined,
      data_competencia: (t as any).data_competencia || t.data_vencimento,
      data_vencimento: t.data_vencimento,
      status: 'pendente',
    };
    if (t.tipo === 'entrada') {
      await createReceita({ ...base, cliente_id: (t as any).cliente_id || undefined });
    } else {
      await createDespesa({ ...base, tipo: 'variavel' });
    }
    syncContas();
    toast.success('Lançamento duplicado', { description: 'Criado como pendente.' });
  };

  return (
    <main className="container py-4 md:py-6">
        {/* Mobile: header iOS-style */}
        <div className="md:hidden">
          <MobilePageHeader
            eyebrow="Extrato"
            title="Lançamentos"
            actions={
              <button
                onClick={() => setFiltersOpen(true)}
                aria-label="Filtros"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-surface/70 backdrop-blur-xl text-foreground"
              >
                <SlidersHorizontal className="h-[18px] w-[18px]" />
                {(contaFilter !== 'all' || statusFilter.length > 0) && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
                )}
              </button>
            }
          />
        </div>
        <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
            <p className="text-sm text-muted-foreground">Visualize todas as movimentações financeiras</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 flex-wrap">
            <IconButton label="Relatório" onClick={() => setReportOpen(true)}>
              <BarChart3 className="h-4 w-4" />
            </IconButton>
            <IconButton label="Importar lançamentos" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
            </IconButton>
            <IconButton label="Transferir entre contas" onClick={() => setTransferModalOpen(true)} disabled={activeContas.length < 2}>
              <ArrowRightLeft className="h-4 w-4" />
            </IconButton>
            {tipoFilter !== 'entrada' && (
              <IconButton label="Nova Saída" onClick={handleNewSaida}>
                <TrendingDown className="h-4 w-4" />
              </IconButton>
            )}
            {tipoFilter !== 'saida' && (
              <IconButton label="Nova Entrada" emphasis="primary" onClick={handleNewEntrada}>
                <Plus className="h-4 w-4" />
              </IconButton>
            )}
          </div>
        </div>

        {/* Summary KPIs rendered below the toolbar so they reflect filtered totals */}


        {/* Tabs and Filters */}
        <Tabs value={tipoFilter} onValueChange={(v) => { setTipoFilter(v as TipoTransacao); setStatusFilter([]); }} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 h-auto rounded-[13px] border border-border/60 bg-surface/70 backdrop-blur-xl p-[3px] gap-0">
            {[
              { v: 'todas', l: 'Tudo' },
              { v: 'entrada', l: 'Receitas' },
              { v: 'saida', l: 'Despesas' },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-[10px] py-2 text-[12.5px] font-semibold text-foreground-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                {t.l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Mobile filter pills — igual HTML: Todas contas | Pago | Pendente | mês */}
        <div className="md:hidden mb-4">
          <div className="scroll-pills -mx-3 px-3 flex gap-2 overflow-x-auto scrollbar-hide items-center">
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-8 px-3.5 shrink-0 inline-flex items-center rounded-full text-xs font-semibold border border-transparent bg-primary text-primary-foreground whitespace-nowrap">
                  {contaFilter === 'all' ? 'Todas contas' : (contas.find(c => c.id === contaFilter)?.nome || 'Conta')}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2 max-h-72 overflow-y-auto">
                <button onClick={() => setContaFilter('all')} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent">Todas as contas</button>
                {contas.filter(c => c.tipo !== 'cartao_credito').map(c => (
                  <button key={c.id} onClick={() => setContaFilter(c.id)} className={cn('w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2', contaFilter === c.id && 'bg-accent font-medium')}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
                    {c.nome}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {(() => {
              const pagoVals = ['pago', 'recebido'];
              const pagoActive = pagoVals.some(v => statusFilter.includes(v));
              const pendenteActive = statusFilter.includes('pendente');
              const pill = (active: boolean) => cn(
                'h-8 px-3.5 shrink-0 inline-flex items-center rounded-full text-xs font-semibold border transition-colors whitespace-nowrap',
                active ? 'bg-primary text-primary-foreground border-transparent' : 'bg-transparent border-border/70 text-foreground-muted',
              );
              return (
                <>
                  <button
                    className={pill(pagoActive)}
                    onClick={() => setStatusFilter(prev => pagoActive ? prev.filter(v => !pagoVals.includes(v)) : [...new Set([...prev, ...pagoVals])])}
                  >Pago</button>
                  <button
                    className={pill(pendenteActive)}
                    onClick={() => setStatusFilter(prev => pendenteActive ? prev.filter(v => v !== 'pendente') : [...prev, 'pendente'])}
                  >Pendente</button>
                </>
              );
            })()}

          </div>
        </div>

        {/* Sheet de filtros (botão sliders no header) */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader className="text-left">
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2">Período</p>
                {/* Alterna entre navegação por mês e período personalizado */}
                <div className="mb-2.5 inline-flex rounded-full border border-border/60 p-0.5">
                  <button onClick={() => setDateFilterMode('month')}
                    className={cn('h-7 rounded-full px-3 text-xs font-semibold transition-colors', dateFilterMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted')}>Mês</button>
                  <button onClick={() => setDateFilterMode('range')}
                    className={cn('h-7 rounded-full px-3 text-xs font-semibold transition-colors', dateFilterMode === 'range' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted')}>Personalizado</button>
                </div>
                {dateFilterMode === 'month' ? (
                  <div className="flex items-center gap-2">
                    <button aria-label="Mês anterior" onClick={() => setMonthFilter(format(addMonths(parseISO(`${monthFilter}-01`), -1), 'yyyy-MM'))}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="h-9 flex-1 px-4 inline-flex items-center justify-center rounded-full border border-border/60 text-sm font-medium capitalize">
                      {format(parseISO(`${monthFilter}-01`), 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button aria-label="Próximo mês" onClick={() => setMonthFilter(format(addMonths(parseISO(`${monthFilter}-01`), 1), 'yyyy-MM'))}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="date" aria-label="Data inicial"
                      value={dateRangeStart ? format(dateRangeStart, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDateRangeStart(e.target.value ? parseISO(e.target.value) : undefined)}
                      className="h-9 flex-1 rounded-lg border border-border/60 bg-transparent px-2.5 text-sm text-foreground [color-scheme:dark]" />
                    <span className="text-xs text-foreground-muted">até</span>
                    <input type="date" aria-label="Data final"
                      value={dateRangeEnd ? format(dateRangeEnd, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDateRangeEnd(e.target.value ? parseISO(e.target.value) : undefined)}
                      className="h-9 flex-1 rounded-lg border border-border/60 bg-transparent px-2.5 text-sm text-foreground [color-scheme:dark]" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2">Conta</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setContaFilter('all')} className={cn('h-8 px-3 rounded-full text-xs font-medium border', contaFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60')}>Todas</button>
                  {contas.filter(c => c.tipo !== 'cartao_credito').map(c => (
                    <button key={c.id} onClick={() => setContaFilter(c.id)} className={cn('h-8 px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5', contaFilter === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60')}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />{c.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(o => {
                    const checked = statusFilter.includes(o.value);
                    return (
                      <button key={o.value} onClick={() => setStatusFilter(prev => checked ? prev.filter(v => v !== o.value) : [...prev, o.value])}
                        className={cn('h-8 px-3 rounded-full text-xs font-medium border', checked ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60')}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => { setContaFilter('all'); setStatusFilter([]); }}>Limpar filtros</Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop toolbar */}
        <div className="hidden md:flex md:flex-wrap items-center gap-3 mb-4">
          <Input type="search" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64 h-9 shrink-0" />

          {dateFilterMode === 'month' ? (
            <div className="inline-flex items-center gap-1 shrink-0">
              <IconButton
                label="Mês anterior"
                onClick={() => setMonthFilter(format(addMonths(parseISO(`${monthFilter}-01`), -1), 'yyyy-MM'))}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <div className="inline-flex items-center justify-center h-9 min-w-[10rem] px-3 border rounded-md bg-background text-sm font-medium capitalize">
                {format(parseISO(`${monthFilter}-01`), 'MMMM yyyy', { locale: ptBR })}
              </div>
              <IconButton
                label="Próximo mês"
                onClick={() => setMonthFilter(format(addMonths(parseISO(`${monthFilter}-01`), 1), 'yyyy-MM'))}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 h-9 border rounded-md bg-background shrink-0">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm whitespace-nowrap">
                {dateRangeStart && dateRangeEnd
                  ? `${format(dateRangeStart, 'dd/MM/yy')} - ${format(dateRangeEnd, 'dd/MM/yy')}`
                  : 'Período selecionado'
                }
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => {
                  setDateFilterMode('month');
                  setDateRangeStart(undefined);
                  setDateRangeEnd(undefined);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <Select value={contaFilter} onValueChange={setContaFilter}>
            <SelectTrigger className="w-44 h-9 shrink-0"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {contas.filter(c => c.tipo !== 'cartao_credito').map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
                    {c.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mais filtros (agrupa período personalizado + status) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 shrink-0">
                <SlidersHorizontal className="h-4 w-4" />
                Mais filtros
                {(statusFilter.length > 0 || dateFilterMode === 'range') && (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                    {statusFilter.length + (dateFilterMode === 'range' ? 1 : 0)}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[640px] max-w-[calc(100vw-2rem)] p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map(o => {
                    const checked = statusFilter.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setStatusFilter(prev => checked ? prev.filter(v => v !== o.value) : [...prev, o.value])}
                        className={cn(
                          'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                          checked
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período personalizado</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">De</Label>
                    <Calendar mode="single" selected={dateRangeStart} onSelect={setDateRangeStart} className="pointer-events-auto rounded border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até</Label>
                    <Calendar mode="single" selected={dateRangeEnd} onSelect={setDateRangeEnd} className="pointer-events-auto rounded border" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => { setDateRangeStart(undefined); setDateRangeEnd(undefined); setDateFilterMode('month'); }}>Limpar período</Button>
                  <Button size="sm" disabled={!dateRangeStart || !dateRangeEnd} onClick={() => { if (dateRangeStart && dateRangeEnd) setDateFilterMode('range'); }}>Aplicar período</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {(statusFilter.length > 0 || dateFilterMode === 'range') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setStatusFilter([]); setDateFilterMode('month'); setDateRangeStart(undefined); setDateRangeEnd(undefined); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Chips de filtros aplicados (mais filtros) */}
        {(statusFilter.length > 0 || dateFilterMode === 'range') && (
          <div className="hidden md:flex flex-wrap items-center gap-2 mb-4">
            {statusFilter.map(s => {
              const label = statusOptions.find(o => o.value === s)?.label || s;
              return (
                <span key={s} className="inline-flex items-center gap-1.5 h-7 rounded-full border border-foreground bg-foreground text-background px-3 text-xs font-medium">
                  Status: {label}
                  <button type="button" onClick={() => setStatusFilter(prev => prev.filter(v => v !== s))} className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background/20" aria-label={`Remover ${label}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            {dateFilterMode === 'range' && dateRangeStart && dateRangeEnd && (
              <span className="inline-flex items-center gap-1.5 h-7 rounded-full border border-foreground bg-foreground text-background px-3 text-xs font-medium">
                Período: {format(dateRangeStart, 'dd/MM')}–{format(dateRangeEnd, 'dd/MM')}
                <button type="button" onClick={() => { setDateFilterMode('month'); setDateRangeStart(undefined); setDateRangeEnd(undefined); }} className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background/20" aria-label="Remover período">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* KPI Row (desktop) */}
        <div className="hidden md:block">
          <FluxoCaixaKPIRow
            entradas={totals.entradas}
            saidas={totals.saidas}
            saldo={totals.saldo}
            itemCount={filteredTransacoes.length}
          />
        </div>


        {/* Table / Mobile List */}
        {isMobile ? (
          <PullToRefresh onRefresh={async () => { await Promise.all([refetchFluxo(), refetchContas(), refetchTransferencias()]); }}>
            <MobileTransactionList
              transactions={filteredTransacoes}
              contas={contas}
              isLoading={isLoading}
              totals={totals}
              saldoAtual={contas.filter(c => c.ativa && c.tipo !== 'cartao_credito').reduce((s, c) => s + Number(c.saldo_atual || 0), 0)}
              onConfirm={handleMobileConfirm}
              onDelete={handleMobileDelete}
              onClick={handleRowClick}
              onDuplicate={handleDuplicate}
              onNewEntrada={handleNewEntrada}
              onNewSaida={handleNewSaida}
            />
          </PullToRefresh>
        ) : (
        <div className="metric-card overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : filteredTransacoes.length === 0 ? (
            <EmptyState  
              title="Nenhuma transação encontrada" 
              description="Registre receitas ou despesas para visualizar o fluxo."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleNewSaida}>Nova Saída</Button>
                  <Button onClick={handleNewEntrada}>Nova Entrada</Button>
                </div>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 sticky top-0 z-10">
                    <th className="p-3 w-10">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos"
                        className={isSomeSelected && !isAllSelected ? "opacity-50" : ""}
                      />
                    </th>
                    <SortableHeader column="tipo">Tipo</SortableHeader>
                    <SortableHeader column="descricao">Descrição</SortableHeader>
                    <SortableHeader column="origem">Origem</SortableHeader>
                    <SortableHeader column="categoria">Categoria</SortableHeader>
                    <SortableHeader column="conta">Conta</SortableHeader>
                    <SortableHeader column="valor" className="text-right">Valor</SortableHeader>
                    <SortableHeader column="status" className="text-center">Status</SortableHeader>
                    <th className="text-center p-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows: JSX.Element[] = [];
                    let lastDate: string | null = null;
                    const COLSPAN = 9;
                    // Pre-compute daily totals
                    const dailyTotals = new Map<string, { entradas: number; saidas: number }>();
                    for (const t of filteredTransacoes) {
                      const d = t.data_vencimento;
                      const cur = dailyTotals.get(d) || { entradas: 0, saidas: 0 };
                      if (t.tabela_origem !== 'transferencia') {
                        if (t.tipo === 'entrada') cur.entradas += Number(t.valor);
                        else cur.saidas += Number(t.valor);
                      }
                      dailyTotals.set(d, cur);
                    }

                    // Bank-statement-style running balance per displayed day.
                    // Active only when a single account is filtered.
                    const isSingleAccount = !!singleAccountId && !!runningBalance;
                    const closingByDate = new Map<string, number>();
                    if (isSingleAccount && runningBalance) {
                      const displayedDates = Array.from(new Set(filteredTransacoes.map(t => t.data_vencimento))).sort();
                      const efetivadoDates = runningBalance.sortedDates || [];
                      let idx = 0;
                      let last = runningBalance.saldoInicial;
                      for (const d of displayedDates) {
                        while (idx < efetivadoDates.length && efetivadoDates[idx] <= d) {
                          last = runningBalance.byDate.get(efetivadoDates[idx])!;
                          idx++;
                        }
                        closingByDate.set(d, last);
                      }
                    }

                    filteredTransacoes.forEach((t) => {
                      const key = `${t.tabela_origem}-${t.id}-${t.tipo}`;
                      const contaNome = contas.find(c => c.id === t.conta_id);
                      const isTransfer = t.tabela_origem === 'transferencia';
                      const dateObj = parseISO(t.data_vencimento);

                      if (t.data_vencimento !== lastDate) {
                        lastDate = t.data_vencimento;
                        const totals = dailyTotals.get(t.data_vencimento) || { entradas: 0, saidas: 0 };
                        const saldo = isSingleAccount
                          ? (closingByDate.get(t.data_vencimento) ?? 0)
                          : totals.entradas - totals.saidas;
                        rows.push(
                          <tr key={`hdr-${t.data_vencimento}`} className="bg-muted/40 border-y border-border/60 sticky top-[44px] z-[5]">
                            <td colSpan={COLSPAN} className="px-4 py-2">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {format(dateObj, "EEE, dd 'de' MMM yyyy", { locale: ptBR })}
                                </span>
                                <div className="flex items-center gap-4 text-[11px] tabular-nums">
                                  {totals.entradas > 0 && (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      <span className="opacity-60 uppercase mr-1">Entradas</span>
                                      <span className="font-semibold">{formatCurrency(totals.entradas)}</span>
                                    </span>
                                  )}
                                  {totals.saidas > 0 && (
                                    <span className="text-rose-600 dark:text-rose-400">
                                      <span className="opacity-60 uppercase mr-1">Saídas</span>
                                      <span className="font-semibold">{formatCurrency(totals.saidas)}</span>
                                    </span>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={cn(
                                        "pl-3 border-l border-border/60 cursor-help",
                                        saldo >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400"
                                      )}>
                                        <span className="opacity-60 uppercase mr-1">Saldo</span>
                                        <span className="font-bold">{formatCurrency(saldo)}</span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {isSingleAccount
                                        ? 'Saldo de fechamento do dia (apenas efetivados)'
                                        : 'Saldo do dia (entradas − saídas)'}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      rows.push(
                        <tr
                          key={key}
                          className={cn(
                            "border-b border-border/40 hover:bg-muted/30 transition-colors group",
                            !isTransfer && "cursor-pointer",
                            isTransfer && "bg-muted/10",
                            isSelected(key) && "bg-primary/5"
                          )}
                          onClick={() => handleRowClick(t)}
                        >
                          <td className="p-3 pl-6" onClick={(e) => e.stopPropagation()}>
                            {!isTransfer && (
                              <Checkbox
                                checked={isSelected(key)}
                                onCheckedChange={() => toggleSelect(key)}
                                aria-label={`Selecionar ${t.descricao}`}
                              />
                            )}
                          </td>
                          <td className="p-3">
                            {isTransfer ? (
                              <span
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                title="Transferência"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-full",
                                  t.tipo === 'entrada'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                )}
                                title={t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                              >
                                {t.tipo === 'entrada' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-sm max-w-[260px] truncate font-medium text-foreground uppercase">{t.descricao}</td>
                          <td className="p-3 text-sm text-muted-foreground truncate max-w-[150px] uppercase">
                            {isTransfer ? '—' : (t.cliente?.nome || t.fornecedor || '-')}
                          </td>
                          <td className="p-3">
                            {t.categoria ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.categoria.cor }} />
                                {t.categoria.nome}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {contaNome ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: contaNome.cor }} />
                                {contaNome.nome}
                              </span>
                            ) : '-'}
                          </td>
                          <td className={cn(
                            "p-3 text-sm text-right font-semibold tabular-nums whitespace-nowrap",
                            isTransfer
                              ? 'text-muted-foreground'
                              : t.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          )}>
                            {isTransfer ? '' : (t.tipo === 'entrada' ? '+' : '-')} {formatCurrency(t.valor)}
                          </td>
                          <td className="p-3 text-center">
                            {isTransfer ? (
                              <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                Transferida
                              </span>
                            ) : (
                              <StatusBadge status={t.status} />
                            )}
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {!isTransfer && (t.status === 'pendente' || t.status === 'atrasado') && (
                                <Tooltip delayDuration={250}>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                                      onClick={() => handleMobileConfirm(t)}
                                      aria-label={t.tipo === 'entrada' ? 'Dar baixa — marcar como recebido' : 'Dar baixa — marcar como pago'}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {t.tipo === 'entrada' ? 'Dar baixa (marcar como recebido)' : 'Dar baixa (marcar como pago)'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {!isTransfer && (t.status === 'recebido' || t.status === 'pago') && (
                                <span className="inline-flex h-8 w-8 items-center justify-center text-emerald-500/50" aria-label="Liquidado">
                                  <CheckCircle2 className="h-4 w-4" />
                                </span>
                              )}
                              {!isTransfer && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => t.tipo === 'entrada' ? handleEditEntrada(t) : handleEditSaida(t)}
                                  aria-label="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setDeletingItem({ id: t.id, tipo: t.tabela_origem });
                                  setDeleteDialogOpen(true);
                                }}
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* ===== ENTRADA MODAL (modern layout) ===== */}
        <Sheet open={entradaModalOpen} onOpenChange={setEntradaModalOpen}>
          <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[760px] sm:mx-auto">
            {/* Header AURO */}
            <div className="px-5 pt-1 pb-1">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[hsl(var(--success))]">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />Receita
              </div>
              <h2 className="mt-0.5 text-[22px] font-[670] tracking-[-0.02em] text-foreground">
                {editingItem ? 'Editar entrada' : 'Nova entrada'}
              </h2>
            </div>

            <form onSubmit={handleSubmitEntrada} className="p-5 pt-3 space-y-4">
              {/* Valor — grande e verde */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formEntrada.valor || ''}
                  onChange={(e) => setFormEntrada(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                  placeholder="R$ 0,00"
                  required
                  className="h-14 text-2xl font-bold tabular-nums text-[hsl(var(--success))]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição *</Label>
                <Input
                  value={formEntrada.descricao}
                  onChange={(e) => setFormEntrada(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Gestão de Redes — Janeiro"
                  required
                />
              </div>

              {/* Quick date + date pickers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datas</Label>
                  <QuickDateButtons onSelect={(d) => setFormEntrada(prev => ({ ...prev, data_competencia: d, data_vencimento: d }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField
                    label="Competência"
                    value={formEntrada.data_competencia}
                    onChange={(d) => setFormEntrada(prev => ({ ...prev, data_competencia: d }))}
                  />
                  <DatePickerField
                    label="Vencimento"
                    value={formEntrada.data_vencimento}
                    onChange={(d) => setFormEntrada(prev => ({ ...prev, data_vencimento: d }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Cliente</Label>
                <Select value={formEntrada.cliente_id || 'none'} onValueChange={(v) => setFormEntrada(prev => ({ ...prev, cliente_id: v === 'none' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Categoria</Label>
                <Select value={formEntrada.categoria_id || 'none'} onValueChange={(v) => setFormEntrada(prev => ({ ...prev, categoria_id: v === 'none' ? undefined : v }))}>
                  <SelectTrigger>
                    {(() => {
                      const sel = categoriasReceita.find(c => c.id === formEntrada.categoria_id);
                      return sel
                        ? <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: sel.cor }} />{sel.nome}</span>
                        : <SelectValue placeholder="Selecionar categoria" />;
                    })()}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categoriasReceita.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: c.cor }} />{c.nome}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Conta</Label>
                <Select value={formEntrada.conta_id || 'none'} onValueChange={(v) => setFormEntrada(prev => ({ ...prev, conta_id: v === 'none' ? undefined : v }))}>
                  <SelectTrigger>
                    {(() => {
                      const sel = contas.find(c => c.id === formEntrada.conta_id);
                      return sel
                        ? <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full" style={{ background: sel.cor }} />{sel.nome}</span>
                        : <SelectValue placeholder="Selecionar conta" />;
                    })()}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={formEntrada.forma_pagamento || 'none'} onValueChange={(v) => setFormEntrada(prev => ({ ...prev, forma_pagamento: v === 'none' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar forma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {FORMA_PAGAMENTO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Status</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pendente', 'recebido', 'atrasado'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormEntrada(prev => ({
                          ...prev,
                          status: s,
                          data_recebimento: s === 'recebido' ? (prev.data_recebimento || prev.data_vencimento) : prev.data_recebimento,
                        }))}
                        className={cn(
                          'no-touch-min rounded-xl border py-2.5 text-sm font-semibold capitalize transition-colors',
                          formEntrada.status === s
                            ? 'border-transparent bg-primary text-white'
                            : 'border-border/60 bg-surface/60 text-foreground-muted',
                        )}
                      >
                        {s === 'recebido' ? 'Recebido' : s === 'pendente' ? 'Pendente' : 'Atrasado'}
                      </button>
                    ))}
                  </div>
                </div>
                {formEntrada.status === 'recebido' && (
                  <DatePickerField
                    label="Data Recebimento"
                    value={formEntrada.data_recebimento}
                    onChange={(d) => setFormEntrada(prev => ({ ...prev, data_recebimento: d }))}
                  />
                )}
              </div>

              {/* Juros/Multa, Tarifa e Imposto - shown when 'recebido' */}
              {formEntrada.status === 'recebido' && (
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-amber-500">Juros/Multa</Label>
                    <Input type="number" step="0.01" min="0" value={entradaValorJuros} onChange={(e) => setEntradaValorJuros(e.target.value)} placeholder="0,00" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-[hsl(var(--danger))]">Tarifa</Label>
                    <Input type="number" step="0.01" min="0" value={entradaValorTarifa} onChange={(e) => setEntradaValorTarifa(e.target.value)} placeholder="0,00" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-[hsl(var(--warning))]">Imposto</Label>
                    <Input type="number" step="0.01" min="0" value={entradaValorImposto} onChange={(e) => setEntradaValorImposto(e.target.value)} placeholder="0,00" className="h-9 text-sm" />
                  </div>
                  <p className="col-span-3 text-[10px] text-muted-foreground">
                    Juros/Multa cria receita extra. Tarifa e Imposto criam despesas automáticas (Imposto na categoria Impostos).
                  </p>
                </div>
              )}

              {/* Recurrence (only for new) */}
              {!editingItem && (
                <RecurrenceSection
                  recurrence={entradaRecurrence}
                  setRecurrence={setEntradaRecurrence}
                  frequency={entradaFrequency}
                  setFrequency={setEntradaFrequency}
                  repeatTimes={entradaRepeatTimes}
                  setRepeatTimes={setEntradaRepeatTimes}
                />
              )}

              {editingItem && editingItem.tabela_origem === 'receitas' && (
                <LinkedAuxiliaryList origemId={editingItem.id} origemTipo="receita" />
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {editingItem && formEntrada.cliente_id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cliente = clientes.find(c => c.id === formEntrada.cliente_id);
                        setReceiptData({
                          id: editingItem.id,
                          descricao: formEntrada.descricao,
                          valor: formEntrada.valor,
                          clienteNome: cliente?.nome || '',
                          clienteCnpj: cliente?.cpf_cnpj || undefined,
                          formaPagamento: formEntrada.forma_pagamento,
                          dataVencimento: formEntrada.data_vencimento,
                          dataRecebimento: formEntrada.data_recebimento,
                          tipo: 'receita',
                        });
                        setReceiptOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Recibo
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEntradaModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white">
                    {isSaving ? <><LoadingSpinner size="sm" className="mr-2" />Salvando...</> : (editingItem ? 'Atualizar' : 'Adicionar')}
                  </Button>
                </div>
              </div>
            </form>
          </SheetContent>
        </Sheet>

        {/* ===== SAÍDA MODAL (modern layout) ===== */}
        <Sheet open={saidaModalOpen} onOpenChange={setSaidaModalOpen}>
          <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[760px] sm:mx-auto">
            {/* Header AURO */}
            <div className="px-5 pt-1 pb-1">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[hsl(var(--danger))]">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--danger))]" />Despesa
              </div>
              <h2 className="mt-0.5 text-[22px] font-[670] tracking-[-0.02em] text-foreground">
                {editingItem ? 'Editar saída' : 'Nova saída'}
              </h2>
            </div>

            <form onSubmit={handleSubmitSaida} className="p-5 pt-3 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formSaida.valor || ''}
                  onChange={(e) => setFormSaida(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                  placeholder="R$ 0,00"
                  required
                  className="h-14 text-2xl font-bold tabular-nums text-[hsl(var(--danger))]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição *</Label>
                <Input
                  value={formSaida.descricao}
                  onChange={(e) => setFormSaida(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Meta Ads — cliente Verano"
                  required
                />
              </div>

              {/* Quick date + date pickers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datas</Label>
                  <QuickDateButtons onSelect={(d) => setFormSaida(prev => ({ ...prev, data_competencia: d, data_vencimento: d }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField
                    label="Competência"
                    value={formSaida.data_competencia}
                    onChange={(d) => setFormSaida(prev => ({ ...prev, data_competencia: d }))}
                  />
                  <DatePickerField
                    label="Vencimento"
                    value={formSaida.data_vencimento}
                    onChange={(d) => setFormSaida(prev => ({ ...prev, data_vencimento: d }))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Fornecedor</Label>
                  <Input
                    value={formSaida.fornecedor || ''}
                    onChange={(e) => setFormSaida(prev => ({ ...prev, fornecedor: e.target.value }))}
                    placeholder="Ex: Meta Platforms"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Vincular a cliente</Label>
                  <Select value={formSaida.cliente_id || 'none'} onValueChange={(v) => setFormSaida(prev => ({ ...prev, cliente_id: v === 'none' ? undefined : v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clientes.filter(c => c.status === 'ativo').map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={formSaida.categoria_id || 'none'} onValueChange={(v) => setFormSaida(prev => ({ ...prev, categoria_id: v === 'none' ? undefined : v }))}>
                    <SelectTrigger>
                      {(() => {
                        const sel = categoriasDespesa.find(c => c.id === formSaida.categoria_id);
                        return sel
                          ? <span className="flex items-center gap-2 min-w-0"><span className="h-3.5 w-3.5 shrink-0 rounded-[5px]" style={{ background: sel.cor }} /><span className="truncate">{sel.nome}</span></span>
                          : <SelectValue placeholder="Categoria" />;
                      })()}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {categoriasDespesa.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: c.cor }} />{c.nome}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Conta</Label>
                  <Select value={formSaida.conta_id || 'none'} onValueChange={(v) => setFormSaida(prev => ({ ...prev, conta_id: v === 'none' ? undefined : v }))}>
                    <SelectTrigger>
                      {(() => {
                        const sel = contas.find(c => c.id === formSaida.conta_id);
                        return sel
                          ? <span className="flex items-center gap-2 min-w-0"><span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: sel.cor }} /><span className="truncate">{sel.nome}</span></span>
                          : <SelectValue placeholder="Conta" />;
                      })()}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Select value={formSaida.forma_pagamento || 'none'} onValueChange={(v) => setFormSaida(prev => ({ ...prev, forma_pagamento: v === 'none' ? undefined : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar forma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {FORMA_PAGAMENTO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tipo de despesa</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DESPESA_TIPO_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setFormSaida(prev => ({ ...prev, tipo: o.value as 'fixa' | 'variavel' }))}
                      className={cn(
                        'no-touch-min rounded-xl border py-2.5 text-sm font-semibold transition-colors',
                        formSaida.tipo === o.value ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pendente', 'pago', 'atrasado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormSaida(prev => ({
                        ...prev,
                        status: s,
                        data_pagamento: s === 'pago' ? (prev.data_pagamento || prev.data_vencimento) : prev.data_pagamento,
                      }))}
                      className={cn(
                        'no-touch-min rounded-xl border py-2.5 text-sm font-semibold capitalize transition-colors',
                        formSaida.status === s ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted',
                      )}
                    >
                      {s === 'pago' ? 'Pago' : s === 'pendente' ? 'Pendente' : 'Atrasado'}
                    </button>
                  ))}
                </div>
              </div>

              {formSaida.status === 'pago' && (
                <DatePickerField
                  label="Data Pagamento"
                  value={formSaida.data_pagamento}
                  onChange={(d) => setFormSaida(prev => ({ ...prev, data_pagamento: d }))}
                />
              )}

              {/* Juros/Multa, Tarifa e Imposto - shown when 'pago' */}
              {formSaida.status === 'pago' && (
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-amber-500">Juros/Multa</Label>
                    <Input type="number" step="0.01" min="0" value={saidaValorJuros} onChange={(e) => setSaidaValorJuros(e.target.value)} placeholder="0,00" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-[hsl(var(--danger))]">Tarifa</Label>
                    <Input type="number" step="0.01" min="0" value={saidaValorTarifa} onChange={(e) => setSaidaValorTarifa(e.target.value)} placeholder="0,00" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-[hsl(var(--warning))]">Imposto</Label>
                    <Input type="number" step="0.01" min="0" value={saidaValorImposto} onChange={(e) => setSaidaValorImposto(e.target.value)} placeholder="0,00" className="h-9 text-sm" />
                  </div>
                  <p className="col-span-3 text-[10px] text-muted-foreground">
                    Juros/Multa, Tarifa e Imposto criam despesas automáticas (Imposto na categoria Impostos).
                  </p>
                </div>
              )}

              {/* Recurrence (only for new) */}
              {!editingItem && (
                <RecurrenceSection
                  recurrence={saidaRecurrence}
                  setRecurrence={setSaidaRecurrence}
                  frequency={saidaFrequency}
                  setFrequency={setSaidaFrequency}
                  repeatTimes={saidaRepeatTimes}
                  setRepeatTimes={setSaidaRepeatTimes}
                />
              )}

              {editingItem && editingItem.tabela_origem === 'despesas' && (
                <LinkedAuxiliaryList origemId={editingItem.id} origemTipo="despesa" />
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {editingItem && (formSaida.cliente_id || formSaida.fornecedor) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cliente = clientes.find(c => c.id === formSaida.cliente_id);
                        setReceiptData({
                          id: editingItem.id,
                          descricao: formSaida.descricao,
                          valor: formSaida.valor,
                          clienteNome: cliente?.nome || formSaida.fornecedor || '',
                          clienteCnpj: cliente?.cpf_cnpj || undefined,
                          dataVencimento: formSaida.data_vencimento,
                          dataPagamento: formSaida.data_pagamento,
                          tipo: 'despesa',
                        });
                        setReceiptOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Recibo
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSaidaModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white">
                    {isSaving ? <><LoadingSpinner size="sm" className="mr-2" />Salvando...</> : (editingItem ? 'Atualizar' : 'Adicionar')}
                  </Button>
                </div>
              </div>
            </form>
          </SheetContent>
        </Sheet>

        {/* Detalhe do lançamento (bottom sheet) */}
        {detailItem && (() => {
          const cats = detailItem.tipo === 'entrada' ? categoriasReceita : categoriasDespesa;
          const cat = cats.find(c => c.id === detailItem.categoria_id);
          const conta = contas.find(c => c.id === detailItem.conta_id);
          const cliente = clientes.find(c => c.id === (detailItem as any).cliente_id);
          const forma = FORMA_PAGAMENTO_OPTIONS.find(o => o.value === (detailItem as any).forma_pagamento);
          return (
            <TransactionDetailSheet
              transaction={detailItem}
              contaNome={conta?.nome}
              categoriaNome={cat?.nome}
              categoriaCor={cat?.cor}
              clienteNome={cliente?.nome}
              formaLabel={forma?.label}
              onOpenChange={(o) => { if (!o) setDetailItem(null); }}
              onEdit={handleEditFromDetail}
              onDelete={handleMobileDelete}
            />
          );
        })()}

        {/* Receipt Generator */}
        <ReceiptGenerator open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />

        {/* Report Dialog */}
        <FluxoCaixaReport
          open={reportOpen}
          onOpenChange={setReportOpen}
          transacoes={transacoes}
          contas={contas}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={`Excluir ${deletingItem?.tipo === 'receitas' ? 'Entrada' : 'Saída'}`}
          description="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={isSaving}
        />

        {/* Bulk Delete Confirmation */}
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title="Excluir Lançamentos"
          description={`Tem certeza que deseja excluir ${selectedIds.size} lançamentos? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir Todos"
          variant="destructive"
          onConfirm={handleBulkDelete}
          isLoading={isSaving}
        />

        {/* Import Dialog */}
        <FileImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={() => {
            setImportDialogOpen(false);
          }}
        />

        {/* Multi-select bar */}
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          onExport={handleExport}
          statusOptions={multiSelectStatusOptions}
          onStatusChange={handleBulkStatusChange}
          clienteOptions={hasEntradas ? clienteOptions : undefined}
          onClienteChange={hasEntradas ? handleBulkClienteChange : undefined}
          showFornecedor={hasSaidas}
          onFornecedorChange={hasSaidas ? handleBulkFornecedorChange : undefined}
          contaOptions={activeContas.map(c => ({ value: c.id, label: c.nome, color: c.cor }))}
          onContaChange={handleBulkContaChange}
        />


        {/* Transfer Dialog */}
        <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Transferência</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Conta Origem</Label>
                <Select
                  value={transferData.conta_origem_id}
                  onValueChange={(value) => setTransferData(prev => ({ ...prev, conta_origem_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeContas.filter(c => c.id !== transferData.conta_destino_id).map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conta.cor }} />
                          {conta.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta Destino</Label>
                <Select
                  value={transferData.conta_destino_id}
                  onValueChange={(value) => setTransferData(prev => ({ ...prev, conta_destino_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeContas.filter(c => c.id !== transferData.conta_origem_id).map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conta.cor }} />
                          {conta.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transferData.valor || ''}
                  onChange={(e) => setTransferData(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <DatePickerField
                  label="Data"
                  value={transferData.data_transferencia}
                  onChange={(d) => setTransferData(prev => ({ ...prev, data_transferencia: d }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={transferData.descricao || ''}
                  onChange={(e) => setTransferData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Reserva de emergência"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleTransfer}
                disabled={!transferData.conta_origem_id || !transferData.conta_destino_id || transferData.valor <= 0}
              >
                Transferir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </main>
  );
}
