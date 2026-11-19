import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEffect as useEffectForAction } from 'react';

import { SkeletonTable, LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { FileImportDialog } from '@/components/import/FileImportDialog';
import { FluxoCaixaReport } from '@/components/fluxocaixa/FluxoCaixaReport';
import { LinkedAuxiliaryList } from '@/components/fluxocaixa/LinkedAuxiliaryList';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportFluxoCaixa } from '@/utils/exportCSV';
import { useFluxoCaixa, type ReceitaFormData, type DespesaFormData } from '@/hooks/useFluxoCaixa';
import { useClientes } from '@/hooks/useClientes';
import { useContas, useAccountRunningBalance } from '@/hooks/useContas';
import { useTransferencias, type TransferenciaFormData } from '@/hooks/useTransferencias';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { ArrowRightLeft, ArrowUp, ArrowDown, BarChart3, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Copy, CreditCard, Download, FileText, MoreHorizontal, Paperclip, Pencil, Plus, Receipt, Search, SlidersHorizontal, Store, Trash2, TrendingDown, Upload, User, X } from 'lucide-react';
import { ResumoPeriodo } from '@/components/fluxocaixa/FluxoCaixaKPIRow';
import { ReceiptGenerator, type ReceiptData } from '@/components/shared/ReceiptGenerator';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, addYears, endOfDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TipoTransacao, TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { createAuxiliaryTransactions } from '@/hooks/useAuxiliaryTransactions';
import { supabase } from '@/integrations/supabase/client';
import { PagarFaturaDialog } from '@/components/cartoes/PagarFaturaDialog';
import type { FaturaDB } from '@/hooks/useFaturas';
import type { ContaDB } from '@/hooks/useContas';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTransactionList } from '@/components/fluxocaixa/MobileTransactionList';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { TransactionDetailSheet } from '@/components/fluxocaixa/TransactionDetailSheet';
import { toast } from 'sonner';
import { GerarCobrancaDialog } from '@/components/fluxocaixa/GerarCobrancaDialog';
import { BarraSelecao } from '@/components/fluxocaixa/BarraSelecao';
import { TipoIcone } from '@/components/fluxocaixa/TipoIcone';
import { FORMA_LABEL, serieDe, statusInfo } from '@/components/fluxocaixa/lancamento';
import { Chips, ContasPick, ExcluirSheet, QuickDatas, ResumoLateral, Stepper, ValorInput } from '@/components/fluxocaixa/formPecas';
import { Bloco, Campo, MenuAcoes, ModalFooter, ModalHeader, ModalShell, PageHeader, Secao, Segmented } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';

// Sorting types
const SEM_CATEGORIA = '__sem_categoria__';

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

const TIPO_OPTIONS: { v: TipoTransacao; l: string }[] = [
  { v: 'todas', l: 'Tudo' },
  { v: 'entrada', l: 'Entradas' },
  { v: 'saida', l: 'Saídas' },
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
    createDespesaParcelada,
    updateDespesa,
    deleteDespesa,
    deleteMultipleDespesas,
    updateMultipleStatus,
    updateMultipleCliente,
    updateMultipleFornecedor,
    updateMultipleConta,
    updateMultipleForma,
    updateMultipleCategoria,
    refetch: refetchFluxo,
  } = useFluxoCaixa();
  
  const { clientes } = useClientes();
  const { contas, refetch: refetchContas } = useContas();
  const { transferencias, createTransferencia, deleteTransferencia, refetch: refetchTransferencias } = useTransferencias();
  
  // Initialize filters from URL query params
  const initialTipo = (searchParams.get('tipo') as TipoTransacao) || 'todas';
  const initialSearch = searchParams.get('search') || '';
  // Preset "próximos vencimentos" (vindo do dashboard): venc=prox7 | hoje
  const vencParam = searchParams.get('venc');
  const _hojeRange = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  // ?de=yyyy-MM-dd&ate=yyyy-MM-dd: período vindo dos relatórios.
  const deParam = searchParams.get('de');
  const ateParam = searchParams.get('ate');
  const initialRange = vencParam === 'prox7'
    ? { de: _hojeRange, ate: addDays(_hojeRange, 7) }
    : vencParam === 'hoje'
      ? { de: _hojeRange, ate: _hojeRange }
      : deParam && ateParam && /^\d{4}-\d{2}-\d{2}$/.test(deParam) && /^\d{4}-\d{2}-\d{2}$/.test(ateParam)
        ? { de: parseISO(deParam), ate: endOfDay(parseISO(ateParam)) }
        : null;
  const initialStatus = searchParams.get('status')?.split(',').filter(Boolean)
    || (vencParam ? ['pendente', 'atrasado'] : []);
  // Data usada no filtro de mês/período: vencimento (padrão) ou a data em que o dinheiro
  // entrou/saiu (recebimento/pagamento), usada pelos cards "recebidas/pagas no mês" do início.
  // 'competencia' vem dos relatórios (DRE/categorias contam pela competência).
  const [dataBase, setDataBase] = useState<'vencimento' | 'efetivacao' | 'competencia'>(() => {
    const b = searchParams.get('base');
    return b === 'efetivacao' || b === 'competencia' ? b : 'vencimento';
  });

  // Filters - default to current month
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [tipoFilter, setTipoFilter] = useState<TipoTransacao>(initialTipo);
  const [statusFilter, setStatusFilter] = useState<string[]>(initialStatus);
  // ?mes=yyyy-MM (ou 'all'), ?conta=<id>, ?categoria=<id>[,<id>] — usados pelos números
  // clicáveis do início, dos relatórios e da conferência de saldo.
  const mesParam = searchParams.get('mes');
  const [monthFilter, setMonthFilter] = useState<string>(mesParam && /^(\d{4}-\d{2}|all)$/.test(mesParam) ? mesParam : currentMonth);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [contaFilter, setContaFilter] = useState<string>(searchParams.get('conta') || 'all');
  // Categorias selecionadas (ids). SEM_CATEGORIA = lançamentos sem categoria.
  const [categoriaFilter, setCategoriaFilter] = useState<string[]>(searchParams.get('categoria')?.split(',').filter(Boolean) || []);
  const singleAccountId = contaFilter !== 'all' ? contaFilter : null;
  const { data: runningBalance } = useAccountRunningBalance(singleAccountId);

  // Date range filter (pré-selecionado quando vem de "próximos vencimentos")
  const [dateFilterMode, setDateFilterMode] = useState<'month' | 'range'>(initialRange ? 'range' : 'month');
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>(initialRange?.de);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>(initialRange?.ate);
  
  // Sorting
  const isMobile = useIsMobile();
  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'data_vencimento',
    direction: 'asc',
  });

  // Modal states
  const [entradaModalOpen, setEntradaModalOpen] = useState(false);
  const [saidaModalOpen, setSaidaModalOpen] = useState(false);
  const [pagarFaturaState, setPagarFaturaState] = useState<{ cartao: ContaDB; fatura: FaturaDB } | null>(null);
  const [detailItem, setDetailItem] = useState<TransacaoUnificada | null>(null);
  // "Gerar cobrança" a partir de uma receita em aberto (e das próximas parcelas)
  const [cobrancaFor, setCobrancaFor] = useState<TransacaoUnificada | null>(null);
  const podeGerarCobranca = (t: TransacaoUnificada) =>
    t.tabela_origem === 'receitas' && (t.status === 'pendente' || t.status === 'atrasado') && !t.tem_cobranca;
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
  const [saidaParcelas, setSaidaParcelas] = useState(1);

  // Juros/Multa, Tarifa e Imposto states
  const [entradaValorJuros, setEntradaValorJuros] = useState('');
  const [entradaValorTarifa, setEntradaValorTarifa] = useState('');
  const [entradaValorImposto, setEntradaValorImposto] = useState('');
  const [saidaValorJuros, setSaidaValorJuros] = useState('');
  const [saidaValorTarifa, setSaidaValorTarifa] = useState('');
  const [saidaValorImposto, setSaidaValorImposto] = useState('');
  const [extrasEntrada, setExtrasEntrada] = useState(false);
  const [extrasSaida, setExtrasSaida] = useState(false);

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

  // Categorias do filtro: só as do tipo da aba (Receitas/Despesas); em "Tudo", os dois grupos.
  const categoriaGrupos = useMemo(() => {
    const grupos: { titulo: string | null; itens: { id: string; nome: string; cor: string }[] }[] = [];
    if (tipoFilter !== 'saida') grupos.push({ titulo: tipoFilter === 'todas' ? 'Receitas' : null, itens: categoriasReceita });
    if (tipoFilter !== 'entrada') grupos.push({ titulo: tipoFilter === 'todas' ? 'Despesas' : null, itens: categoriasDespesa });
    return grupos;
  }, [tipoFilter, categoriasReceita, categoriasDespesa]);
  const categoriaNomePorId = useMemo(() => {
    const m = new Map<string, { nome: string; cor: string }>();
    [...categoriasReceita, ...categoriasDespesa].forEach(c => m.set(c.id, { nome: c.nome, cor: c.cor }));
    return m;
  }, [categoriasReceita, categoriasDespesa]);
  // Ao trocar de aba, descarta categorias que não pertencem a ela.
  useEffect(() => {
    const validas = new Set(categoriaGrupos.flatMap(g => g.itens.map(c => c.id)));
    if (!validas.size) return; // categorias ainda carregando: não descarta o filtro vindo do link
    setCategoriaFilter(prev => {
      const next = prev.filter(id => id === SEM_CATEGORIA || validas.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [categoriaGrupos]);
  const toggleCategoria = (id: string) =>
    setCategoriaFilter(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]));

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
      const matchesCategoria =
        categoriaFilter.length === 0 || categoriaFilter.includes(t.categoria_id || SEM_CATEGORIA);
      
      let matchesDate = true;
      // Por recebimento/pagamento: sem essa data (ainda em aberto) não entra no período.
      const dataRef = dataBase === 'efetivacao' ? t.data_efetivacao : dataBase === 'competencia' ? t.data_competencia : t.data_vencimento;
      const filtrandoData = (dateFilterMode === 'month' && monthFilter !== 'all') || (dateFilterMode === 'range' && !!dateRangeStart && !!dateRangeEnd);
      if (filtrandoData && !dataRef) {
        matchesDate = dataBase === 'vencimento';
      } else if (dateFilterMode === 'month' && monthFilter !== 'all' && dataRef) {
        const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
        const monthEnd = endOfMonth(monthStart);
        matchesDate = isWithinInterval(parseISO(dataRef), { start: monthStart, end: monthEnd });
      } else if (dateFilterMode === 'range' && dateRangeStart && dateRangeEnd && dataRef) {
        matchesDate = isWithinInterval(parseISO(dataRef), { start: dateRangeStart, end: dateRangeEnd });
      }
      
      return matchesTipo && matchesStatus && matchesSearch && matchesConta && matchesCategoria && matchesDate;
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
        case 'origem': {
          const origemA = a.cliente?.nome || a.fornecedor || '';
          const origemB = b.cliente?.nome || b.fornecedor || '';
          comparison = origemA.localeCompare(origemB);
          break;
        }
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
  }, [transacoes, tipoFilter, statusFilter, monthFilter, searchTerm, contaFilter, categoriaFilter, dateFilterMode, dateRangeStart, dateRangeEnd, sortConfig, contas, dataBase]);

  // Handle sort toggle
  const handleSort = (column: SortColumn) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Calculate totals (transferências são neutras — não afetam entradas/saídas/saldo)
  const totals = useMemo(() => {
    const reaisTransacoes = filteredTransacoes.filter(t => t.tabela_origem !== 'transferencia');
    const entradas = reaisTransacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const saidas = reaisTransacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filteredTransacoes]);

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

  // Ações em massa valem só para receitas/despesas (pernas de transferência ficam de fora).
  const selectedEntradas = selectedItems.filter(t => t.tipo === 'entrada' && t.tabela_origem === 'receitas');
  const selectedSaidas = selectedItems.filter(t => t.tipo === 'saida' && t.tabela_origem === 'despesas');
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
  // Saída no cartão de crédito: muda o comportamento do modal (parcelas, sem
  // Pago/Pendente — vai pra fatura, sem recorrência).
  const saidaContaIsCartao = activeContas.some(c => c.id === formSaida.conta_id && c.tipo === 'cartao_credito');

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
    setExtrasEntrada(false);
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
    setExtrasEntrada(false);
    setEntradaModalOpen(true);
  };

  const handleNewSaida = () => {
    setEditingItem(null);
    setSaidaRecurrence('unico');
    setSaidaFrequency('mensal');
    setSaidaRepeatTimes(12);
    setSaidaParcelas(1);
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
    setExtrasSaida(false);
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
      forma_pagamento: t.forma_pagamento || undefined,
    });
    setSaidaValorJuros('');
    setSaidaValorTarifa('');
    setSaidaValorImposto('');
    setExtrasSaida(false);
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
          recurrence_group_id: groupId,
        };
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
    if (editingItem && ehFaturaCartao(editingItem) && formSaida.status === 'pago' && editingItem.status !== 'pago') {
      setSaidaModalOpen(false);
      await abrirPagarFatura(editingItem.id);
      return;
    }

    setIsSaving(true);
    let success: boolean;
    
    if (editingItem) {
      success = await updateDespesa(editingItem.id, formSaida);
    } else if (saidaContaIsCartao && saidaParcelas > 1) {
      // Cartão parcelado: distribui nas faturas dos próximos meses.
      success = await createDespesaParcelada(formSaida, saidaParcelas);
    } else if (saidaRecurrence === 'recorrente' && saidaRepeatTimes > 1) {
      const groupId = crypto.randomUUID();
      success = true;
      for (let i = 0; i < saidaRepeatTimes; i++) {
        const data = {
          ...formSaida,
          data_competencia: calculateNextDate(formSaida.data_competencia, saidaFrequency, i),
          data_vencimento: calculateNextDate(formSaida.data_vencimento, saidaFrequency, i),
          descricao: `${formSaida.descricao} (${i + 1}/${saidaRepeatTimes})`,
          recurrence_group_id: groupId,
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
    // Só uma fatura de cartão selecionada: vai direto para o Pagar fatura.
    if (status === 'pago' && !hasEntradas && selectedSaidas.length === 1 && ehFaturaCartao(selectedSaidas[0])) {
      clearSelection();
      await abrirPagarFatura(selectedSaidas[0].id);
      return;
    }
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
    } else if (actionParam === 'importar') {
      // Vindo do FAB mobile ("Subir print/comprovante") — abre o upload direto
      setImportDialogOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [actionParam]);

  // Fatura de cartão ('[fatura]') não tem conta: "dar baixa" nela abre o Pagar fatura,
  // que pergunta de qual banco saiu o dinheiro (senão o saldo das contas fica errado).
  const ehFaturaCartao = (t: { fornecedor?: string | null }) => t.fornecedor === '[fatura]';
  const abrirPagarFatura = async (despesaId: string) => {
    const { data } = await supabase.from('cartao_faturas' as never).select('*').eq('despesa_id', despesaId).maybeSingle();
    const fatura = data as unknown as FaturaDB | null;
    const cartao = fatura ? contas.find((c) => c.id === fatura.cartao_id) : undefined;
    if (!fatura || !cartao) { toast.error('Não achei a fatura deste cartão. Pague pela tela de Contas.'); return; }
    if (fatura.status === 'paga') { toast.info('Esta fatura já está paga.'); return; }
    setPagarFaturaState({ cartao, fatura });
  };

  // Mobile swipe confirm handler — atualiza SÓ status+data (update parcial preserva categoria/conta/cliente/etc)
  const handleMobileConfirm = async (t: TransacaoUnificada) => {
    if (t.tabela_origem === 'transferencia') return; // não há "dar baixa" em transferências
    if (ehFaturaCartao(t)) { await abrirPagarFatura(t.id); return; }
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
    const base = {
      descricao: `${t.descricao} (cópia)`,
      valor: Number(t.valor),
      categoria_id: t.categoria_id || undefined,
      conta_id: t.conta_id || undefined,
      data_competencia: t.data_competencia || t.data_vencimento,
      data_vencimento: t.data_vencimento,
      status: 'pendente' as const,
    };
    if (t.tipo === 'entrada') {
      await createReceita({ ...base, cliente_id: t.cliente_id || undefined });
    } else {
      await createDespesa({ ...base, tipo: 'variavel' });
    }
    syncContas();
    toast.success('Lançamento duplicado', { description: 'Criado como pendente.' });
  };

  // ===== Helpers de layout =====
  const changeTipo = (v: TipoTransacao) => { setTipoFilter(v); setStatusFilter([]); };
  const mesBase = monthFilter === 'all' ? currentMonth : monthFilter;
  const monthLabel = monthFilter === 'all'
    ? 'Todos os meses'
    : format(parseISO(`${monthFilter}-01`), 'MMMM yyyy', { locale: ptBR });
  const navMes = (n: number) => {
    setDateFilterMode('month');
    setDateRangeStart(undefined);
    setDateRangeEnd(undefined);
    setMonthFilter(format(addMonths(parseISO(`${mesBase}-01`), n), 'yyyy-MM'));
  };
  const periodoLabel = dateFilterMode === 'range' && dateRangeStart && dateRangeEnd
    ? `${format(dateRangeStart, 'dd/MM/yy')} – ${format(dateRangeEnd, 'dd/MM/yy')}`
    : monthLabel;
  const modoPeriodo: 'mes' | 'periodo' | 'tudo' = dateFilterMode === 'range' ? 'periodo' : monthFilter === 'all' ? 'tudo' : 'mes';
  const setModoPeriodo = (m: 'mes' | 'periodo' | 'tudo') => {
    if (m === 'periodo') { setDateFilterMode('range'); return; }
    setDateFilterMode('month');
    setDateRangeStart(undefined);
    setDateRangeEnd(undefined);
    setMonthFilter(m === 'tudo' ? 'all' : (monthFilter === 'all' ? currentMonth : monthFilter));
  };

  // Situação (segmentado) ↔ statusFilter. "Em aberto" usa 'pendente', que já engloba os atrasados.
  type Situ = 'todas' | 'aberto' | 'atrasado' | 'efetivado';
  const situ: Situ | null = statusFilter.length === 0 ? 'todas'
    : statusFilter.includes('pendente') ? 'aberto'
    : statusFilter.every(v => v === 'atrasado') ? 'atrasado'
    : statusFilter.every(v => v === 'recebido' || v === 'pago') ? 'efetivado'
    : null;
  const setSitu = (v: Situ) => setStatusFilter(v === 'todas' ? [] : v === 'aberto' ? ['pendente'] : v === 'atrasado' ? ['atrasado'] : ['recebido', 'pago']);
  const SITU_OPTS: [Situ, string][] = [['todas', 'Todas'], ['aberto', 'Em aberto'], ['atrasado', 'Atrasadas'], ['efetivado', 'Efetivadas']];

  // Números do período: realizado × previsto (transferências são neutras)
  const resumo = useMemo(() => {
    const reais = filteredTransacoes.filter(t => t.tabela_origem !== 'transferencia');
    const soma = (f: (t: TransacaoUnificada) => boolean) => reais.filter(f).reduce((acc, t) => acc + Number(t.valor || 0), 0);
    return {
      entOk: soma(t => t.tipo === 'entrada' && t.status === 'recebido'),
      entTot: soma(t => t.tipo === 'entrada'),
      saiOk: soma(t => t.tipo === 'saida' && t.status === 'pago'),
      saiTot: soma(t => t.tipo === 'saida'),
      atraso: soma(t => t.tipo === 'entrada' && statusInfo(t).tom === 'atraso'),
    };
  }, [filteredTransacoes]);

  const contaById = useMemo(() => new Map(contas.map(c => [c.id, c])), [contas]);
  const contaEhCartao = (id?: string | null) => !!id && contaById.get(id)?.tipo === 'cartao_credito';
  const filtrosAtivos = categoriaFilter.length + (dataBase !== 'vencimento' ? 1 : 0) + (dateFilterMode === 'range' && dateRangeStart && dateRangeEnd ? 1 : 0);
  const contasFiltro = contas.filter(c => c.tipo !== 'cartao_credito');

  // Agrupamento por dia (na ordem exibida) + totais e saldo de fechamento por conta
  const gruposDia = useMemo(() => {
    const grupos: { data: string; itens: TransacaoUnificada[] }[] = [];
    for (const t of filteredTransacoes) {
      const last = grupos[grupos.length - 1];
      if (last && last.data === t.data_vencimento) last.itens.push(t);
      else grupos.push({ data: t.data_vencimento, itens: [t] });
    }
    return grupos;
  }, [filteredTransacoes]);
  const isSingleAccount = !!singleAccountId && !!runningBalance;
  const closingByDate = useMemo(() => {
    const m = new Map<string, number>();
    if (!singleAccountId || !runningBalance) return m;
    const displayedDates = Array.from(new Set(filteredTransacoes.map(t => t.data_vencimento))).sort();
    const efetivadoDates = runningBalance.sortedDates || [];
    let idx = 0;
    let last = runningBalance.saldoInicial;
    for (const d of displayedDates) {
      while (idx < efetivadoDates.length && efetivadoDates[idx] <= d) {
        last = runningBalance.byDate.get(efetivadoDates[idx])!;
        idx++;
      }
      m.set(d, last);
    }
    return m;
  }, [filteredTransacoes, singleAccountId, runningBalance]);

  // Dar baixa numa data escolhida (detalhe)
  const handleDarBaixa = async (t: TransacaoUnificada, dataISO: string) => {
    if (t.tabela_origem === 'transferencia') return;
    if (ehFaturaCartao(t)) { await abrirPagarFatura(t.id); return; }
    if (t.tipo === 'entrada') await updateReceita(t.id, { status: 'recebido', data_recebimento: dataISO });
    else await updateDespesa(t.id, { status: 'pago', data_pagamento: dataISO });
    await Promise.all([refetchFluxo(), refetchContas()]);
  };

  // Recibo a partir de um lançamento salvo
  const abrirRecibo = (t: TransacaoUnificada) => {
    const cliente = clientes.find(c => c.id === t.cliente_id);
    setReceiptData({
      id: t.id,
      descricao: t.descricao,
      valor: t.valor,
      clienteNome: cliente?.nome || t.fornecedor || '',
      clienteCnpj: cliente?.cpf_cnpj || undefined,
      formaPagamento: t.forma_pagamento || undefined,
      dataVencimento: t.data_vencimento,
      dataRecebimento: t.tipo === 'entrada' ? t.data_efetivacao || undefined : undefined,
      dataPagamento: t.tipo === 'saida' ? t.data_efetivacao || undefined : undefined,
      tipo: t.tipo === 'entrada' ? 'receita' : 'despesa',
    });
    setReceiptOpen(true);
  };
  const temParteParaRecibo = (t: TransacaoUnificada) => !!t.cliente_id || (!!t.fornecedor && !t.fornecedor.startsWith('['));

  // Forma de pagamento em massa: no cartão de crédito a forma é sempre "Cartão crédito", então
  // lançamentos em conta cartão (e as linhas de sistema da fatura) ficam de fora.
  const formaOpcoesBulk = FORMA_PAGAMENTO_OPTIONS.filter(o => o.value !== 'cartao_credito').map(o => ({ value: o.value, label: FORMA_LABEL[o.value] ?? o.label }));
  const handleBulkForma = async (forma: string) => {
    const rec = selectedEntradas.filter(t => !contaEhCartao(t.conta_id)).map(t => t.id);
    const desp = selectedSaidas.filter(t => !contaEhCartao(t.conta_id) && !(t.fornecedor ?? '').startsWith('[')).map(t => t.id);
    const fora = selectedEntradas.length + selectedSaidas.length - rec.length - desp.length;
    if (!rec.length && !desp.length) {
      toast.info('Nada para alterar', { description: 'No cartão de crédito a forma é sempre "Cartão crédito".' });
      return;
    }
    setIsSaving(true);
    const ok = await updateMultipleForma(rec, desp, forma);
    if (ok && fora > 0) toast.info(`${fora} lançamento(s) ficaram de fora`, { description: 'Compras no cartão e faturas mantêm a forma "Cartão crédito".' });
    clearSelection();
    setIsSaving(false);
  };
  // Categoria em massa: só quando a seleção é de um tipo (receitas OU despesas).
  const bulkCategoriaTipo: 'receitas' | 'despesas' | null = hasEntradas && !hasSaidas ? 'receitas' : hasSaidas && !hasEntradas ? 'despesas' : null;
  const handleBulkCategoria = async (categoriaId: string) => {
    if (!bulkCategoriaTipo) return;
    setIsSaving(true);
    await updateMultipleCategoria((bulkCategoriaTipo === 'receitas' ? selectedEntradas : selectedSaidas).map(t => t.id), bulkCategoriaTipo, categoriaId);
    clearSelection();
    setIsSaving(false);
  };
  const somaSelecao = selectedItems.reduce((acc, t) => t.tabela_origem === 'transferencia' ? acc : acc + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0);

  // Troca entre Nova entrada ↔ Nova saída sem perder o que já foi digitado
  const trocarTipo = (para: 'entrada' | 'saida') => {
    if (para === 'saida') {
      const f = formEntrada;
      handleNewSaida();
      setFormSaida(prev => ({ ...prev, valor: f.valor, descricao: f.descricao, data_competencia: f.data_competencia, data_vencimento: f.data_vencimento, conta_id: f.conta_id, forma_pagamento: f.forma_pagamento }));
      setEntradaModalOpen(false);
    } else {
      const f = formSaida;
      const cartao = contaEhCartao(f.conta_id);
      handleNewEntrada();
      setFormEntrada(prev => ({ ...prev, valor: f.valor, descricao: f.descricao, data_competencia: f.data_competencia, data_vencimento: f.data_vencimento, conta_id: cartao ? undefined : f.conta_id, forma_pagamento: cartao ? undefined : f.forma_pagamento }));
      setSaidaModalOpen(false);
    }
  };

  const itemExcluir = deletingItem ? transacoes.find(t => t.id === deletingItem.id && t.tabela_origem === deletingItem.tipo) : undefined;
  const nomeConta = (id?: string | null) => (id ? contaById.get(id)?.nome : undefined);
  const nomeCategoria = (id?: string, tipo?: 'entrada' | 'saida') => (tipo === 'entrada' ? categoriasReceita : categoriasDespesa).find(c => c.id === id)?.nome;
  const dataBR = (iso?: string) => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—');
  const freqPlural: Record<string, string> = { semanal: 'semanais', quinzenal: 'quinzenais', mensal: 'mensais', anual: 'anuais' };

  // Cabeçalho ordenável da lista (desktop)
  const SortBtn = ({ col, children, className }: { col: SortColumn; children: React.ReactNode; className?: string }) => (
    <button type="button" onClick={() => handleSort(col)} className={cn('inline-flex items-center gap-1 text-[12px] text-foreground-muted hover:text-foreground', className)}>
      {children}
      {sortConfig.column === col && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  const categoriaOpcoes = (lista: { id: string; nome: string; cor: string }[]) => lista.map(c => ({ value: c.id, label: c.nome, color: c.cor }));
  const entradaEfetivada = formEntrada.status === 'recebido';
  const saidaEfetivada = formSaida.status === 'pago';
  const mostrarExtrasEntrada = extrasEntrada || !!(entradaValorJuros || entradaValorTarifa || entradaValorImposto);
  const mostrarExtrasSaida = extrasSaida || !!(saidaValorJuros || saidaValorTarifa || saidaValorImposto);

  return (
    <main className="container max-w-[1180px] space-y-5 py-4 md:py-6">
        {/* Cabeçalho */}
        <PageHeader
          eyebrow="Dinheiro"
          title="Fluxo de caixa"
          mobileAction={<MenuAcoes itens={[
            { label: 'Nova entrada', icon: <Plus className="h-4 w-4 text-success-fg" />, onClick: handleNewEntrada, destaque: true },
            { label: 'Nova saída', icon: <TrendingDown className="h-4 w-4 text-danger-fg" />, onClick: handleNewSaida },
            { label: 'Transferir entre contas', icon: <ArrowRightLeft className="h-4 w-4" />, onClick: () => setTransferModalOpen(true), disabled: activeContas.length < 2 },
            { label: 'Importar extrato ou print', icon: <Upload className="h-4 w-4" />, onClick: () => setImportDialogOpen(true) },
            { label: 'Relatório do período', icon: <BarChart3 className="h-4 w-4" />, onClick: () => setReportOpen(true) },
          ]} />}
        >
          <div className="flex items-center justify-between gap-1 rounded-full border border-border bg-surface p-1 max-sm:w-full">
            <button type="button" aria-label="Mês anterior" onClick={() => navMes(-1)} className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setFiltersOpen(true)} className="max-w-[170px] truncate whitespace-nowrap px-1 text-[13px] text-foreground first-letter:uppercase max-sm:max-w-none max-sm:flex-1">{periodoLabel}</button>
            <button type="button" aria-label="Próximo mês" onClick={() => navMes(1)} className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => setReportOpen(true)} aria-label="Relatório" title="Relatório" className={cn(btn.icon, 'max-sm:hidden')}><BarChart3 className="h-4 w-4" /></button>
          <button type="button" onClick={() => setImportDialogOpen(true)} aria-label="Importar" title="Importar extrato ou comprovantes" className={cn(btn.icon, 'max-sm:hidden')}><Upload className="h-4 w-4" /></button>
          <button type="button" onClick={() => setTransferModalOpen(true)} disabled={activeContas.length < 2} aria-label="Transferir" title="Transferir entre contas" className={cn(btn.icon, 'max-sm:hidden')}><ArrowRightLeft className="h-4 w-4" /></button>
          <button type="button" onClick={handleNewSaida} className={cn(btn.outline, 'max-sm:hidden')}><TrendingDown className="h-4 w-4 text-danger-fg" />Saída</button>
          <button type="button" onClick={handleNewEntrada} className={cn(btn.primary, 'max-sm:hidden')}><Plus className="h-4 w-4" />Entrada</button>
        </PageHeader>

        {/* Números do período */}
        <ResumoPeriodo
          entradasOk={resumo.entOk}
          entradasTotal={resumo.entTot}
          saidasOk={resumo.saiOk}
          saidasTotal={resumo.saiTot}
          atrasoReceber={resumo.atraso}
          saldoLabel={modoPeriodo === 'mes' ? 'Saldo do mês' : 'Saldo do período'}
        />

        {/* Barra de filtros */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<TipoTransacao> size="sm" className="max-sm:w-full" value={tipoFilter} onChange={changeTipo} opts={TIPO_OPTIONS.map(o => [o.v, o.l] as [TipoTransacao, string])} />
            <div className="hidden md:block">
              <Segmented<Situ> size="sm" value={situ ?? ('' as Situ)} onChange={setSitu} opts={SITU_OPTS} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={cn('inline-flex h-10 max-w-[220px] items-center gap-1.5 rounded-full border bg-surface px-3.5 text-[13px] text-foreground max-sm:max-w-none max-sm:flex-1 max-sm:justify-between', contaFilter !== 'all' ? 'border-foreground' : 'border-border')}>
                  {contaFilter === 'all' ? 'Todas as contas' : (
                    <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: contaById.get(contaFilter)?.cor }} /><span className="truncate">{contaById.get(contaFilter)?.nome ?? 'Conta'}</span></span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto rounded-2xl p-1.5">
                <DropdownMenuItem onSelect={() => setContaFilter('all')} className={cn('rounded-xl py-2 text-[13.5px]', contaFilter === 'all' && 'font-medium')}>Todas as contas</DropdownMenuItem>
                {contasFiltro.map(c => (
                  <DropdownMenuItem key={c.id} onSelect={() => setContaFilter(c.id)} className={cn('justify-between gap-2 rounded-xl py-2 text-[13.5px]', contaFilter === c.id && 'bg-surface-2 font-medium')}>
                    <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor }} /><span className="truncate">{c.nome}</span></span>
                    <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">{formatCurrency(Number(c.saldo_atual || 0))}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" onClick={() => setFiltersOpen(true)} className={cn(btn.outline, 'h-10 px-3.5 text-[13px]')}>
              <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filtros</span>
              {filtrosAtivos > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[10.5px] text-background">{filtrosAtivos}</span>}
            </button>
            <button type="button" onClick={() => setMobileSearchOpen(o => !o)} aria-label="Buscar" aria-pressed={mobileSearchOpen || !!searchTerm} className={cn(btn.icon, 'sm:hidden', (mobileSearchOpen || searchTerm) && 'border-foreground bg-foreground text-background')}><Search className="h-4 w-4" /></button>
            <label className={cn('ml-auto h-10 w-full items-center gap-2 rounded-full border border-border bg-surface px-3.5 sm:flex sm:w-72', mobileSearchOpen || searchTerm ? 'flex' : 'hidden')}>
              <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar lançamento, cliente…"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-foreground-muted"
              />
              {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca"><X className="h-4 w-4 text-foreground-muted" /></button>}
            </label>
          </div>
          {/* situação no celular */}
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 scrollbar-hide md:hidden">
            {SITU_OPTS.map(([v, r]) => (
              <button key={v} type="button" onClick={() => setSitu(v)} className={cn('h-8 shrink-0 rounded-full border px-3.5 text-[13px]', situ === v ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground-muted')}>{r}</button>
            ))}
          </div>
          {/* filtros aplicados */}
          {(categoriaFilter.length > 0 || dataBase !== 'vencimento' || (dateFilterMode === 'range' && dateRangeStart && dateRangeEnd) || situ === null) && (
            <div className="flex flex-wrap gap-2">
              {categoriaFilter.map(id => {
                const cat = id === SEM_CATEGORIA ? null : categoriaNomePorId.get(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCategoria(id)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-[12.5px] text-background">
                    {cat && <span className="h-2 w-2 rounded-full" style={{ background: cat.cor }} />}{cat?.nome ?? 'Sem categoria'}<X className="h-3.5 w-3.5" />
                  </button>
                );
              })}
              {dataBase !== 'vencimento' && (
                <button type="button" onClick={() => setDataBase('vencimento')} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-[12.5px] text-background">
                  Data de {dataBase === 'competencia' ? 'competência' : tipoFilter === 'entrada' ? 'recebimento' : tipoFilter === 'saida' ? 'pagamento' : 'recebimento/pagamento'}<X className="h-3.5 w-3.5" />
                </button>
              )}
              {dateFilterMode === 'range' && dateRangeStart && dateRangeEnd && (
                <button type="button" onClick={() => setModoPeriodo('mes')} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-[12.5px] text-background">
                  {format(dateRangeStart, 'dd/MM')}–{format(dateRangeEnd, 'dd/MM')}<X className="h-3.5 w-3.5" />
                </button>
              )}
              {situ === null && statusFilter.map(v => (
                <button key={v} type="button" onClick={() => setStatusFilter(prev => prev.filter(x => x !== v))} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-[12.5px] text-background">
                  {statusOptions.find(o => o.value === v)?.label ?? v}<X className="h-3.5 w-3.5" />
                </button>
              ))}
              <button type="button" onClick={() => { setStatusFilter([]); setCategoriaFilter([]); setDataBase('vencimento'); setModoPeriodo('mes'); }} className="h-8 px-2 text-[12.5px] text-foreground-muted hover:text-foreground">Limpar</button>
            </div>
          )}
        </div>

        {/* Lista */}
        {isMobile ? (
          <PullToRefresh onRefresh={async () => { await Promise.all([refetchFluxo(), refetchContas(), refetchTransferencias()]); }}>
            <MobileTransactionList
              transactions={filteredTransacoes}
              contas={contas}
              isLoading={isLoading}
              totals={totals}
              saldoAtual={contas.filter(c => c.ativa && c.tipo !== 'cartao_credito').reduce((acc, c) => acc + Number(c.saldo_atual || 0), 0)}
              onConfirm={handleMobileConfirm}
              onDelete={handleMobileDelete}
              onClick={handleRowClick}
              onDuplicate={handleDuplicate}
              onNewEntrada={handleNewEntrada}
              onNewSaida={handleNewSaida}
            />
          </PullToRefresh>
        ) : (
          <section className="rounded-[24px] border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <p className="text-[15px] font-semibold text-foreground">
                Movimentações {!isLoading && <span className="font-normal text-foreground-muted">· {filteredTransacoes.length} {filteredTransacoes.length === 1 ? 'lançamento' : 'lançamentos'}</span>}
              </p>
              <div className="flex items-center gap-3">
                <SortBtn col="data_vencimento">Data</SortBtn>
                <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground-muted hover:text-foreground"><Download className="h-4 w-4" />Exportar</button>
              </div>
            </div>
            {isLoading ? (
              <div className="p-5"><SkeletonTable rows={5} /></div>
            ) : filteredTransacoes.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[15px] text-foreground">Nada por aqui com esses filtros.</p>
                <p className="mt-1 text-[13px] text-foreground-muted">Limpe os filtros ou lance uma entrada ou saída.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" onClick={handleNewSaida} className={btn.outline}><TrendingDown className="h-4 w-4 text-danger-fg" />Saída</button>
                  <button type="button" onClick={handleNewEntrada} className={btn.primary}><Plus className="h-4 w-4" />Entrada</button>
                </div>
              </div>
            ) : (
              <div className="[&>div:last-child>div:last-child]:rounded-b-[24px]">
                {/* cabeçalho de colunas */}
                <div className="grid grid-cols-[22px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_112px_132px_76px] items-center gap-4 border-b border-border px-5 py-2">
                  <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" className={isSomeSelected && !isAllSelected ? 'opacity-50' : ''} />
                  <SortBtn col="descricao">Lançamento</SortBtn>
                  <SortBtn col="categoria">Categoria</SortBtn>
                  <SortBtn col="conta">Conta</SortBtn>
                  <SortBtn col="status">Situação</SortBtn>
                  <SortBtn col="valor" className="justify-end">Valor</SortBtn>
                  <span />
                </div>
                {gruposDia.map(({ data, itens }, gi) => {
                  const e = itens.filter(t => t.tabela_origem !== 'transferencia' && t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
                  const sai = itens.filter(t => t.tabela_origem !== 'transferencia' && t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);
                  const hoje = isToday(parseISO(data));
                  const saldoDia = isSingleAccount ? (closingByDate.get(data) ?? 0) : e - sai;
                  const d = parseISO(data);
                  const rotulo = format(d, d.getFullYear() === new Date().getFullYear() ? "EEEE, dd 'de' MMMM" : "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                  return (
                    <div key={`${data}-${gi}`}>
                      <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-2', hoje ? 'bg-primary/[0.06]' : 'bg-surface-2/70')}>
                        <span className="flex items-center gap-2 text-[12.5px] text-foreground">
                          <span className="first-letter:uppercase">{rotulo}</span>
                          {hoje && <span className="rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-primary-foreground">Hoje</span>}
                        </span>
                        <span className="flex items-center gap-3 text-[12px] tabular-nums">
                          {e > 0 && <span className="text-success-fg">+{formatCurrency(e)}</span>}
                          {sai > 0 && <span className="text-danger-fg">−{formatCurrency(sai)}</span>}
                          <span className="border-l border-border pl-3 text-foreground-muted" title={isSingleAccount ? 'Saldo de fechamento do dia (apenas efetivados)' : 'Saldo do dia (entradas − saídas)'}>
                            {isSingleAccount ? 'saldo' : 'dia'} <span className={cn('font-medium', saldoDia >= 0 ? 'text-foreground' : 'text-danger-fg')}>{formatCurrency(saldoDia)}</span>
                          </span>
                        </span>
                      </div>
                      {itens.map((t) => {
                        const key = `${t.tabela_origem}-${t.id}-${t.tipo}`;
                        const isTransfer = t.tabela_origem === 'transferencia';
                        const st = statusInfo(t);
                        const marcado = isSelected(key);
                        const aberto = !isTransfer && (t.status === 'pendente' || t.status === 'atrasado');
                        const { base, serie } = serieDe(t.descricao);
                        const conta = t.conta_id ? contaById.get(t.conta_id) : undefined;
                        const quem = t.cliente?.nome || (t.fornecedor && !t.fornecedor.startsWith('[') ? t.fornecedor : undefined);
                        return (
                          <div
                            key={key}
                            onClick={() => handleRowClick(t)}
                            className={cn('group grid grid-cols-[22px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_112px_132px_76px] items-center gap-4 border-b border-border px-5 py-3 last:border-b-0 hover:bg-surface-2/50',
                              !isTransfer && 'cursor-pointer', marcado && 'bg-primary/5')}
                          >
                            <span onClick={(ev) => ev.stopPropagation()}>
                              {!isTransfer && (
                                <Checkbox checked={marcado} onCheckedChange={() => toggleSelect(key)} aria-label={`Selecionar ${t.descricao}`}
                                  className={cn('transition-opacity', !marcado && selectedIds.size === 0 && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} />
                              )}
                            </span>
                            <div className="flex min-w-0 items-center gap-3">
                              <TipoIcone t={t} />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-[14.5px] font-medium text-foreground">
                                  <span className="truncate" title={t.descricao}>{base}</span>
                                  {!!t.anexos?.length && <Paperclip className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-label={`${t.anexos.length} anexo(s)`} />}
                                  {serie && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10.5px] text-foreground-muted" title="Recorrente">{serie}</span>}
                                </span>
                                <span className="flex items-center gap-1.5 truncate text-[12.5px] text-foreground-muted">
                                  {isTransfer ? <>{t.conta_origem?.nome ?? '—'} → {t.conta_destino?.nome ?? '—'}</> : quem ? (
                                    <>{t.cliente?.nome ? <User className="h-3 w-3 shrink-0" /> : <Store className="h-3 w-3 shrink-0" />}<span className="truncate">{quem}</span></>
                                  ) : <span className="truncate">{t.tipo === 'entrada' ? 'Receita' : 'Despesa'}</span>}
                                </span>
                              </span>
                            </div>
                            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-foreground">
                              {t.categoria ? <><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.categoria.cor }} /><span className="truncate">{t.categoria.nome}</span></> : <span className="text-foreground-muted">—</span>}
                            </span>
                            <span className="min-w-0 text-[13px] text-foreground-muted">
                              {conta ? <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: conta.cor }} /><span className="truncate">{conta.nome}</span></span> : '—'}
                            </span>
                            <span><span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px]', st.cls)}>{st.txt}</span></span>
                            <span className={cn('whitespace-nowrap text-right font-heading text-[15.5px] font-semibold tabular-nums', isTransfer ? 'text-foreground-muted' : t.tipo === 'entrada' ? 'text-success-fg' : 'text-danger-fg')}>
                              {isTransfer ? '' : t.tipo === 'entrada' ? '+' : '−'}{formatCurrency(t.valor)}
                            </span>
                            <div className="flex items-center justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                              {aberto && (
                                <button type="button" onClick={() => handleMobileConfirm(t)} title={ehFaturaCartao(t) ? 'Pagar fatura' : t.tipo === 'entrada' ? 'Dar baixa (marcar como recebido)' : 'Dar baixa (marcar como pago)'}
                                  aria-label={t.tipo === 'entrada' ? 'Dar baixa — marcar como recebido' : 'Dar baixa — marcar como pago'}
                                  className="grid h-8 w-8 place-items-center rounded-full text-success-fg opacity-0 transition-opacity hover:bg-success-bg focus-visible:opacity-100 group-hover:opacity-100">
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" aria-label="Mais ações" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2 hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                                  {!isTransfer && <DropdownMenuItem onSelect={() => (t.tipo === 'entrada' ? handleEditEntrada(t) : handleEditSaida(t))} className="gap-2.5 rounded-xl py-2 text-[13.5px]"><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>}
                                  {!isTransfer && <DropdownMenuItem onSelect={() => handleDuplicate(t)} className="gap-2.5 rounded-xl py-2 text-[13.5px]"><Copy className="h-4 w-4" />Duplicar</DropdownMenuItem>}
                                  {podeGerarCobranca(t) && <DropdownMenuItem onSelect={() => setCobrancaFor(t)} className="gap-2.5 rounded-xl py-2 text-[13.5px]"><Receipt className="h-4 w-4" />Gerar cobrança</DropdownMenuItem>}
                                  {!isTransfer && <DropdownMenuSeparator />}
                                  <DropdownMenuItem onSelect={() => { setDeletingItem({ id: t.id, tipo: t.tabela_origem }); setDeleteDialogOpen(true); }} className="gap-2.5 rounded-xl py-2 text-[13.5px] text-danger-fg focus:bg-danger-bg focus:text-danger-fg"><Trash2 className="h-4 w-4" />Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ===== Filtros ===== */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[640px]')}>
            <ModalShell>
              <ModalHeader title="Filtros" onClose={() => setFiltersOpen(false)} />
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                <Bloco title="Período">
                  <Segmented<'mes' | 'periodo' | 'tudo'> value={modoPeriodo} onChange={setModoPeriodo} opts={[['mes', 'Mês'], ['periodo', 'Personalizado'], ['tudo', 'Tudo']]} />
                  {modoPeriodo === 'mes' && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-full border border-border bg-surface p-1">
                      <button type="button" aria-label="Mês anterior" onClick={() => navMes(-1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-[14px] text-foreground first-letter:uppercase">{monthLabel}</span>
                      <button type="button" aria-label="Próximo mês" onClick={() => navMes(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  )}
                  {modoPeriodo === 'periodo' && (
                    <div className="mt-3">
                      <DateRangePicker
                        from={dateRangeStart}
                        to={dateRangeEnd}
                        onApply={(de, ate) => { setDateRangeStart(de); setDateRangeEnd(ate); setDateFilterMode('range'); }}
                        onClear={() => setModoPeriodo('mes')}
                      />
                    </div>
                  )}
                </Bloco>
                <Bloco title="Filtrar pela data de">
                  <Segmented<'vencimento' | 'competencia' | 'efetivacao'> value={dataBase} onChange={setDataBase} opts={[['vencimento', 'Vencimento'], ['competencia', 'Competência'], ['efetivacao', 'Pagamento']]} />
                  <p className="mt-2 text-[12px] text-foreground-muted">
                    {dataBase === 'competencia' ? 'Mês a que o lançamento pertence (o mesmo do DRE).' : dataBase === 'efetivacao' ? 'Só o que já foi recebido ou pago, pela data da baixa.' : 'Quando vence. É o padrão do caixa.'}
                  </p>
                </Bloco>
                <Bloco title="Categorias" extra={categoriaFilter.length > 0 ? <button type="button" onClick={() => setCategoriaFilter([])} className="text-[12px] text-foreground-muted hover:text-foreground">Limpar ({categoriaFilter.length})</button> : undefined}>
                  <div className="space-y-3">
                    {categoriaGrupos.map(g => (
                      <div key={g.titulo ?? 'cats'}>
                        {g.titulo && <p className="mb-1.5 text-[11.5px] text-foreground-muted">{g.titulo}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {g.itens.map(c => {
                            const on = categoriaFilter.includes(c.id);
                            return (
                              <button key={c.id} type="button" onClick={() => toggleCategoria(c.id)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]', on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-surface-2')}>
                                <span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => toggleCategoria(SEM_CATEGORIA)} className={cn('h-8 rounded-full border border-dashed px-3 text-[12.5px]', categoriaFilter.includes(SEM_CATEGORIA) ? 'border-foreground bg-foreground text-background' : 'border-border-strong text-foreground-muted')}>Sem categoria</button>
                  </div>
                </Bloco>
              </div>
              <ModalFooter left={<button type="button" onClick={() => { setStatusFilter([]); setCategoriaFilter([]); setDataBase('vencimento'); setModoPeriodo('mes'); }} className={btn.ghost}>Limpar tudo</button>}>
                <button type="button" onClick={() => setFiltersOpen(false)} className={btn.primary}>Ver {filteredTransacoes.length} lançamentos</button>
              </ModalFooter>
            </ModalShell>
          </SheetContent>
        </Sheet>

        {/* ===== Nova / editar ENTRADA ===== */}
        <Sheet open={entradaModalOpen} onOpenChange={setEntradaModalOpen}>
          <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[940px]')}>
            <form onSubmit={handleSubmitEntrada} className="flex max-h-[92dvh] flex-col md:max-h-[88dvh]">
              <ModalHeader
                eyebrow={<span className="flex items-center gap-1.5 text-success-fg"><span className="h-2 w-2 rounded-full bg-success-fg" />Receita</span>}
                title={editingItem ? 'Editar entrada' : 'Nova entrada'}
                onClose={() => setEntradaModalOpen(false)}
              >
                {!editingItem && <Segmented<'entrada' | 'saida'> size="sm" className="hidden sm:flex" value="entrada" onChange={(v) => v === 'saida' && trocarTipo('saida')} opts={[['entrada', 'Entrada'], ['saida', 'Saída']]} />}
              </ModalHeader>
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3 p-4 md:p-5">
                  {!editingItem && <Segmented<'entrada' | 'saida'> className="sm:hidden" value="entrada" onChange={(v) => v === 'saida' && trocarTipo('saida')} opts={[['entrada', 'Entrada'], ['saida', 'Saída']]} />}
                  <Secao n={1} title="O quê">
                    <Campo label="Valor"><ValorInput valor={formEntrada.valor} onChange={(n) => setFormEntrada(prev => ({ ...prev, valor: n }))} tom="entrada" /></Campo>
                    <Campo label="Descrição"><Input value={formEntrada.descricao} onChange={(e) => setFormEntrada(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Ex.: Gestão de redes — novembro" required /></Campo>
                  </Secao>
                  <Secao n={2} title="Quando" extra={<QuickDatas className="hidden sm:flex" onSelect={(d) => setFormEntrada(prev => ({ ...prev, data_competencia: d, data_vencimento: d }))} />}>
                    <div className="grid grid-cols-2 gap-3">
                      <DatePickerField label="Vencimento" value={formEntrada.data_vencimento} onChange={(d) => setFormEntrada(prev => ({ ...prev, data_vencimento: d }))} />
                      <DatePickerField label="Competência (mês do DRE)" value={formEntrada.data_competencia} onChange={(d) => setFormEntrada(prev => ({ ...prev, data_competencia: d }))} />
                    </div>
                    <QuickDatas className="sm:hidden" onSelect={(d) => setFormEntrada(prev => ({ ...prev, data_competencia: d, data_vencimento: d }))} />
                  </Secao>
                  <Secao n={3} title="Quem e onde">
                    <Campo label="Cliente">
                      <Select value={formEntrada.cliente_id || 'none'} onValueChange={(v) => setFormEntrada(prev => ({ ...prev, cliente_id: v === 'none' ? undefined : v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Campo>
                    <div>
                      <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Categoria</span>
                      <Chips opcoes={categoriaOpcoes(categoriasReceita)} valor={formEntrada.categoria_id} onChange={(v) => setFormEntrada(prev => ({ ...prev, categoria_id: v }))} />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Entra na conta</span>
                      {/* Só contas ativas (arquivadas somem), mas mantém a já escolhida ao editar */}
                      <ContasPick contas={contas.filter(c => c.ativa || c.id === formEntrada.conta_id)} valor={formEntrada.conta_id} onChange={(id) => setFormEntrada(prev => ({ ...prev, conta_id: id }))} />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Forma de pagamento</span>
                      <Chips opcoes={FORMA_PAGAMENTO_OPTIONS.filter(o => o.value !== 'cartao_credito' || formEntrada.forma_pagamento === 'cartao_credito').map(o => ({ value: o.value, label: FORMA_LABEL[o.value] ?? o.label }))} valor={formEntrada.forma_pagamento} onChange={(v) => setFormEntrada(prev => ({ ...prev, forma_pagamento: v }))} />
                    </div>
                  </Secao>
                  <Secao n={4} title="Situação">
                    <Segmented<'pendente' | 'recebido' | 'atrasado'>
                      value={formEntrada.status as 'pendente' | 'recebido' | 'atrasado'}
                      onChange={(v) => setFormEntrada(prev => ({ ...prev, status: v, data_recebimento: v === 'recebido' ? (prev.data_recebimento || prev.data_vencimento) : prev.data_recebimento }))}
                      opts={[['pendente', 'A receber'], ['recebido', 'Recebido'], ['atrasado', 'Atrasado']]}
                    />
                    {entradaEfetivada && (<>
                      <DatePickerField label="Recebido em" value={formEntrada.data_recebimento} onChange={(d) => setFormEntrada(prev => ({ ...prev, data_recebimento: d }))} />
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3.5 py-3">
                        <span><span className="block text-[14px] text-foreground">Juros, tarifa ou imposto</span><span className="block text-[12px] text-foreground-muted">Juros/multa cria receita extra; tarifa e imposto criam despesas ligadas a esta</span></span>
                        <Switch checked={mostrarExtrasEntrada} onCheckedChange={(v) => { setExtrasEntrada(v); if (!v) { setEntradaValorJuros(''); setEntradaValorTarifa(''); setEntradaValorImposto(''); } }} />
                      </div>
                      {mostrarExtrasEntrada && (
                        <div className="grid grid-cols-3 gap-2">
                          <Campo label="Juros/multa"><Input type="number" step="0.01" min="0" value={entradaValorJuros} onChange={(e) => setEntradaValorJuros(e.target.value)} placeholder="0,00" /></Campo>
                          <Campo label="Tarifa"><Input type="number" step="0.01" min="0" value={entradaValorTarifa} onChange={(e) => setEntradaValorTarifa(e.target.value)} placeholder="0,00" /></Campo>
                          <Campo label="Imposto"><Input type="number" step="0.01" min="0" value={entradaValorImposto} onChange={(e) => setEntradaValorImposto(e.target.value)} placeholder="0,00" /></Campo>
                        </div>
                      )}
                    </>)}
                  </Secao>
                  {!editingItem && (
                    <Secao n={5} title="Repetir">
                      <Segmented<'unico' | 'recorrente'> value={entradaRecurrence} onChange={setEntradaRecurrence} opts={[['unico', 'Só esta vez'], ['recorrente', 'Repetir']]} />
                      {entradaRecurrence === 'recorrente' && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Segmented<string> value={entradaFrequency} onChange={setEntradaFrequency} opts={RECURRENCE_OPTIONS.map(o => [o.value, o.label] as [string, string])} />
                          <Stepper valor={entradaRepeatTimes} min={2} max={60} onChange={setEntradaRepeatTimes} rotulo={(n) => `${n} vezes`} />
                        </div>
                      )}
                    </Secao>
                  )}
                  {editingItem && editingItem.tabela_origem === 'receitas' && (
                    <LinkedAuxiliaryList origemId={editingItem.id} origemTipo="receita" />
                  )}
                </div>
                <ResumoLateral
                  tom="entrada"
                  valor={formEntrada.valor}
                  subtitulo={formEntrada.descricao || 'Sem descrição'}
                  linhas={[
                    ['Vence', dataBR(formEntrada.data_vencimento)],
                    ['Cliente', clientes.find(c => c.id === formEntrada.cliente_id)?.nome ?? '—'],
                    ['Categoria', nomeCategoria(formEntrada.categoria_id, 'entrada') ?? '—'],
                    ['Conta', nomeConta(formEntrada.conta_id) ?? '—'],
                    ['Situação', formEntrada.status === 'recebido' ? 'recebido' : formEntrada.status === 'atrasado' ? 'atrasado' : 'a receber'],
                    ...(!editingItem && entradaRecurrence === 'recorrente' ? [['Repete', `${entradaRepeatTimes}× ${RECURRENCE_OPTIONS.find(o => o.value === entradaFrequency)?.label.toLowerCase()}`] as [string, string]] : []),
                  ]}
                  nota={entradaEfetivada
                    ? `O saldo da ${nomeConta(formEntrada.conta_id) ?? 'conta'} aumenta na hora.`
                    : !editingItem && entradaRecurrence === 'recorrente'
                      ? `Criamos ${entradaRepeatTimes} lançamentos ${freqPlural[entradaFrequency] ?? ''}; você dá baixa em cada um quando receber.`
                      : 'Fica a receber e aparece na Início e no Calendário até a baixa.'}
                />
              </div>
              <ModalFooter left={editingItem && formEntrada.cliente_id ? (
                <button type="button" onClick={() => {
                  const cliente = clientes.find(c => c.id === formEntrada.cliente_id);
                  setReceiptData({ id: editingItem.id, descricao: formEntrada.descricao, valor: formEntrada.valor, clienteNome: cliente?.nome || '', clienteCnpj: cliente?.cpf_cnpj || undefined, formaPagamento: formEntrada.forma_pagamento, dataVencimento: formEntrada.data_vencimento, dataRecebimento: formEntrada.data_recebimento, tipo: 'receita' });
                  setReceiptOpen(true);
                }} className={btn.ghost}><FileText className="h-4 w-4" />Recibo</button>
              ) : undefined}>
                <button type="button" onClick={() => setEntradaModalOpen(false)} className={btn.outline}>Cancelar</button>
                <button type="submit" disabled={isSaving} className={btn.primary}>
                  {isSaving ? <><LoadingSpinner size="sm" className="mr-1" />Salvando…</> : editingItem ? 'Salvar' : 'Adicionar entrada'}
                </button>
              </ModalFooter>
            </form>
          </SheetContent>
        </Sheet>

        {/* ===== Nova / editar SAÍDA ===== */}
        <Sheet open={saidaModalOpen} onOpenChange={setSaidaModalOpen}>
          <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[940px]')}>
            <form onSubmit={handleSubmitSaida} className="flex max-h-[92dvh] flex-col md:max-h-[88dvh]">
              <ModalHeader
                eyebrow={<span className="flex items-center gap-1.5 text-danger-fg"><span className="h-2 w-2 rounded-full bg-danger-fg" />Despesa</span>}
                title={editingItem ? 'Editar saída' : 'Nova saída'}
                onClose={() => setSaidaModalOpen(false)}
              >
                {!editingItem && <Segmented<'entrada' | 'saida'> size="sm" className="hidden sm:flex" value="saida" onChange={(v) => v === 'entrada' && trocarTipo('entrada')} opts={[['entrada', 'Entrada'], ['saida', 'Saída']]} />}
              </ModalHeader>
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3 p-4 md:p-5">
                  {!editingItem && <Segmented<'entrada' | 'saida'> className="sm:hidden" value="saida" onChange={(v) => v === 'entrada' && trocarTipo('entrada')} opts={[['entrada', 'Entrada'], ['saida', 'Saída']]} />}
                  <Secao n={1} title="O quê">
                    <Campo label="Valor"><ValorInput valor={formSaida.valor} onChange={(n) => setFormSaida(prev => ({ ...prev, valor: n }))} tom="saida" /></Campo>
                    <Campo label="Descrição"><Input value={formSaida.descricao} onChange={(e) => setFormSaida(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Ex.: Meta Ads — cliente Verano" required /></Campo>
                  </Secao>
                  <Secao n={2} title="Quando" extra={<QuickDatas className="hidden sm:flex" onSelect={(d) => setFormSaida(prev => ({ ...prev, data_competencia: d, data_vencimento: d }))} />}>
                    <div className="grid grid-cols-2 gap-3">
                      <DatePickerField label="Vencimento" value={formSaida.data_vencimento} onChange={(d) => setFormSaida(prev => ({ ...prev, data_vencimento: d }))} />
                      <DatePickerField label="Competência (mês do DRE)" value={formSaida.data_competencia} onChange={(d) => setFormSaida(prev => ({ ...prev, data_competencia: d }))} />
                    </div>
                    <QuickDatas className="sm:hidden" onSelect={(d) => setFormSaida(prev => ({ ...prev, data_competencia: d, data_vencimento: d }))} />
                  </Secao>
                  <Secao n={3} title="Quem e onde">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Campo label="Fornecedor"><Input value={formSaida.fornecedor || ''} onChange={(e) => setFormSaida(prev => ({ ...prev, fornecedor: e.target.value }))} placeholder="Ex.: Meta Platforms" /></Campo>
                      <Campo label="Vincular a cliente" hint="Para ver o custo por cliente">
                        <Select value={formSaida.cliente_id || 'none'} onValueChange={(v) => setFormSaida(prev => ({ ...prev, cliente_id: v === 'none' ? undefined : v }))}>
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {clientes.filter(c => c.status === 'ativo' || c.id === formSaida.cliente_id).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Campo>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Categoria</span>
                      <Chips opcoes={categoriaOpcoes(categoriasDespesa)} valor={formSaida.categoria_id} onChange={(v) => setFormSaida(prev => ({ ...prev, categoria_id: v }))} />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Sai da conta</span>
                      <ContasPick
                        contas={contas.filter(c => c.ativa || c.id === formSaida.conta_id)}
                        valor={formSaida.conta_id}
                        onChange={(novaConta) => {
                          const isCartao = activeContas.some(c => c.id === novaConta && c.tipo === 'cartao_credito');
                          setFormSaida(prev => ({
                            ...prev,
                            conta_id: novaConta,
                            // Cartão → forma trava em 'cartao_credito'. Saindo do cartão, limpa se estava travada.
                            forma_pagamento: isCartao ? 'cartao_credito' : (prev.forma_pagamento === 'cartao_credito' ? undefined : prev.forma_pagamento),
                          }));
                        }}
                      />
                    </div>
                    {saidaContaIsCartao ? (
                      <div className="space-y-3 rounded-2xl bg-primary/[0.06] p-3.5">
                        <p className="flex gap-2 text-[12.5px] leading-snug text-foreground">
                          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>Entra na <b className="font-semibold">fatura do cartão</b>. A baixa acontece quando você <b className="font-semibold">pagar a fatura</b> — não precisa marcar Pago/Pendente.</span>
                        </p>
                        {!editingItem && (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[13px] text-foreground">Parcelas
                              <span className="block text-[12px] text-foreground-muted">{saidaParcelas > 1 && formSaida.valor > 0 ? `${saidaParcelas}× de ${formatCurrency(formSaida.valor / saidaParcelas)} · 1ª na fatura atual` : 'À vista (1 parcela)'}</span>
                            </span>
                            <Stepper valor={saidaParcelas} min={1} max={48} onChange={setSaidaParcelas} rotulo={(n) => (n === 1 ? 'à vista' : `${n}×`)} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="mb-1.5 block text-[12.5px] text-foreground-muted">Forma de pagamento</span>
                        {/* 'Cartão Crédito' só aparece quando a conta é um cartão de crédito */}
                        <Chips opcoes={FORMA_PAGAMENTO_OPTIONS.filter(o => o.value !== 'cartao_credito').map(o => ({ value: o.value, label: FORMA_LABEL[o.value] ?? o.label }))} valor={formSaida.forma_pagamento} onChange={(v) => setFormSaida(prev => ({ ...prev, forma_pagamento: v }))} />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[12.5px] text-foreground-muted">Tipo de despesa</span>
                      <Segmented<'fixa' | 'variavel'> className="w-56" value={formSaida.tipo} onChange={(v) => setFormSaida(prev => ({ ...prev, tipo: v }))} opts={DESPESA_TIPO_OPTIONS.map(o => [o.value, o.label] as ['fixa' | 'variavel', string])} />
                    </div>
                  </Secao>
                  {!saidaContaIsCartao && (
                    <Secao n={4} title="Situação">
                      <Segmented<'pendente' | 'pago' | 'atrasado'>
                        value={formSaida.status as 'pendente' | 'pago' | 'atrasado'}
                        onChange={(v) => setFormSaida(prev => ({ ...prev, status: v, data_pagamento: v === 'pago' ? (prev.data_pagamento || prev.data_vencimento) : prev.data_pagamento }))}
                        opts={[['pendente', 'A pagar'], ['pago', 'Pago'], ['atrasado', 'Atrasado']]}
                      />
                      {saidaEfetivada && (<>
                        <DatePickerField label="Pago em" value={formSaida.data_pagamento} onChange={(d) => setFormSaida(prev => ({ ...prev, data_pagamento: d }))} />
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3.5 py-3">
                          <span><span className="block text-[14px] text-foreground">Juros, tarifa ou imposto</span><span className="block text-[12px] text-foreground-muted">Viram despesas automáticas ligadas a esta (imposto na categoria Impostos)</span></span>
                          <Switch checked={mostrarExtrasSaida} onCheckedChange={(v) => { setExtrasSaida(v); if (!v) { setSaidaValorJuros(''); setSaidaValorTarifa(''); setSaidaValorImposto(''); } }} />
                        </div>
                        {mostrarExtrasSaida && (
                          <div className="grid grid-cols-3 gap-2">
                            <Campo label="Juros/multa"><Input type="number" step="0.01" min="0" value={saidaValorJuros} onChange={(e) => setSaidaValorJuros(e.target.value)} placeholder="0,00" /></Campo>
                            <Campo label="Tarifa"><Input type="number" step="0.01" min="0" value={saidaValorTarifa} onChange={(e) => setSaidaValorTarifa(e.target.value)} placeholder="0,00" /></Campo>
                            <Campo label="Imposto"><Input type="number" step="0.01" min="0" value={saidaValorImposto} onChange={(e) => setSaidaValorImposto(e.target.value)} placeholder="0,00" /></Campo>
                          </div>
                        )}
                      </>)}
                    </Secao>
                  )}
                  {/* Recorrência (só ao criar) — não aparece pra cartão (usa Parcelas) */}
                  {!editingItem && !saidaContaIsCartao && (
                    <Secao n={5} title="Repetir">
                      <Segmented<'unico' | 'recorrente'> value={saidaRecurrence} onChange={setSaidaRecurrence} opts={[['unico', 'Só esta vez'], ['recorrente', 'Repetir']]} />
                      {saidaRecurrence === 'recorrente' && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Segmented<string> value={saidaFrequency} onChange={setSaidaFrequency} opts={RECURRENCE_OPTIONS.map(o => [o.value, o.label] as [string, string])} />
                          <Stepper valor={saidaRepeatTimes} min={2} max={60} onChange={setSaidaRepeatTimes} rotulo={(n) => `${n} vezes`} />
                        </div>
                      )}
                    </Secao>
                  )}
                  {editingItem && editingItem.tabela_origem === 'despesas' && (
                    <LinkedAuxiliaryList origemId={editingItem.id} origemTipo="despesa" />
                  )}
                </div>
                <ResumoLateral
                  tom="saida"
                  valor={saidaContaIsCartao && saidaParcelas > 1 && !editingItem ? formSaida.valor / saidaParcelas : formSaida.valor}
                  subtitulo={`${formSaida.descricao || 'Sem descrição'}${saidaContaIsCartao && saidaParcelas > 1 && !editingItem ? ` · ${saidaParcelas}× de ${formatCurrency(formSaida.valor / saidaParcelas)}` : ''}`}
                  linhas={[
                    ['Vence', dataBR(formSaida.data_vencimento)],
                    ['Fornecedor', formSaida.fornecedor && !formSaida.fornecedor.startsWith('[') ? formSaida.fornecedor : '—'],
                    ['Categoria', nomeCategoria(formSaida.categoria_id, 'saida') ?? '—'],
                    ['Conta', nomeConta(formSaida.conta_id) ?? '—'],
                    ['Situação', saidaContaIsCartao ? 'na fatura' : formSaida.status === 'pago' ? 'pago' : formSaida.status === 'atrasado' ? 'atrasado' : 'a pagar'],
                    ...(!editingItem && !saidaContaIsCartao && saidaRecurrence === 'recorrente' ? [['Repete', `${saidaRepeatTimes}× ${RECURRENCE_OPTIONS.find(o => o.value === saidaFrequency)?.label.toLowerCase()}`] as [string, string]] : []),
                  ]}
                  nota={saidaContaIsCartao
                    ? 'A compra entra na fatura do cartão e só sai do banco quando você pagar a fatura.'
                    : saidaEfetivada
                      ? `O saldo da ${nomeConta(formSaida.conta_id) ?? 'conta'} diminui na hora.`
                      : !editingItem && saidaRecurrence === 'recorrente'
                        ? `Criamos ${saidaRepeatTimes} lançamentos ${freqPlural[saidaFrequency] ?? ''}; você dá baixa em cada um quando pagar.`
                        : 'Fica a pagar e aparece na Início e no Calendário até a baixa.'}
                />
              </div>
              <ModalFooter left={editingItem && (formSaida.cliente_id || formSaida.fornecedor) ? (
                <button type="button" onClick={() => {
                  const cliente = clientes.find(c => c.id === formSaida.cliente_id);
                  setReceiptData({ id: editingItem.id, descricao: formSaida.descricao, valor: formSaida.valor, clienteNome: cliente?.nome || formSaida.fornecedor || '', clienteCnpj: cliente?.cpf_cnpj || undefined, dataVencimento: formSaida.data_vencimento, dataPagamento: formSaida.data_pagamento, tipo: 'despesa' });
                  setReceiptOpen(true);
                }} className={btn.ghost}><FileText className="h-4 w-4" />Recibo</button>
              ) : undefined}>
                <button type="button" onClick={() => setSaidaModalOpen(false)} className={btn.outline}>Cancelar</button>
                <button type="submit" disabled={isSaving} className={btn.primary}>
                  {isSaving ? <><LoadingSpinner size="sm" className="mr-1" />Salvando…</> : editingItem ? 'Salvar' : 'Adicionar saída'}
                </button>
              </ModalFooter>
            </form>
          </SheetContent>
        </Sheet>

        {/* Detalhe do lançamento */}
        {detailItem && (() => {
          const cats = detailItem.tipo === 'entrada' ? categoriasReceita : categoriasDespesa;
          const cat = cats.find(c => c.id === detailItem.categoria_id);
          const conta = detailItem.conta_id ? contaById.get(detailItem.conta_id) : undefined;
          const cliente = clientes.find(c => c.id === detailItem.cliente_id);
          const forma = detailItem.forma_pagamento ? (FORMA_LABEL[detailItem.forma_pagamento] ?? detailItem.forma_pagamento) : undefined;
          return (
            <TransactionDetailSheet
              key={`${detailItem.tabela_origem}-${detailItem.id}`}
              transaction={detailItem}
              contaNome={conta?.nome}
              contaCor={conta?.cor}
              categoriaNome={cat?.nome}
              categoriaCor={cat?.cor}
              clienteNome={cliente?.nome}
              formaLabel={forma}
              onOpenChange={(o) => { if (!o) setDetailItem(null); }}
              onEdit={handleEditFromDetail}
              onDelete={handleMobileDelete}
              onGerarCobranca={podeGerarCobranca(detailItem) ? (t) => setCobrancaFor(t) : undefined}
              onAnexosChange={() => { refetchFluxo(); }}
              onCobrancaChange={() => { refetchFluxo(); }}
              onSerieChange={() => { refetchFluxo(); }}
              onPagarFatura={ehFaturaCartao(detailItem) && detailItem.status !== 'pago' ? (t) => abrirPagarFatura(t.id) : undefined}
              onDarBaixa={handleDarBaixa}
              onDuplicate={handleDuplicate}
              onRecibo={temParteParaRecibo(detailItem) ? abrirRecibo : undefined}
            />
          );
        })()}

        {pagarFaturaState && (
          <PagarFaturaDialog
            open
            onOpenChange={(o) => {
              if (o) return;
              setPagarFaturaState(null);
              refetchFluxo();
              syncContas();
            }}
            cartao={pagarFaturaState.cartao}
            fatura={pagarFaturaState.fatura}
            contasBancarias={activeContas.filter((c) => c.tipo !== 'cartao_credito')}
          />
        )}

        {/* Gerar cobrança no Asaas a partir do lançamento */}
        <GerarCobrancaDialog
          transacao={cobrancaFor}
          contas={contas}
          onOpenChange={(o) => { if (!o) setCobrancaFor(null); }}
          onDone={() => { refetchFluxo(); }}
        />

        {/* Recibo */}
        <ReceiptGenerator open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />

        {/* Relatório */}
        <FluxoCaixaReport open={reportOpen} onOpenChange={setReportOpen} transacoes={transacoes} contas={contas} />

        {/* Excluir */}
        <ExcluirSheet
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          titulo={deletingItem?.tipo === 'transferencia' ? 'Excluir esta transferência?' : 'Excluir este lançamento?'}
          descricao={itemExcluir
            ? <><b className="font-medium text-foreground">{itemExcluir.descricao}</b> · {formatCurrency(itemExcluir.valor)} · {formatDate(itemExcluir.data_vencimento)}. Não dá para desfazer.</>
            : 'Esta ação não pode ser desfeita.'}
          onConfirm={handleDelete}
          isLoading={isSaving}
        />
        <ExcluirSheet
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          titulo={`Excluir ${selectedEntradas.length + selectedSaidas.length} lançamentos?`}
          descricao="Todos os lançamentos selecionados serão apagados. Não dá para desfazer."
          confirmLabel="Excluir todos"
          onConfirm={handleBulkDelete}
          isLoading={isSaving}
        />

        {/* Importar */}
        <FileImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={() => {
            setImportDialogOpen(false);
          }}
        />

        {/* Ações em massa */}
        <BarraSelecao
          count={selectedEntradas.length + selectedSaidas.length}
          soma={somaSelecao}
          onClear={clearSelection}
          statusOptions={multiSelectStatusOptions}
          onStatus={handleBulkStatusChange}
          contaOptions={activeContas.map(c => ({ value: c.id, label: c.nome, color: c.cor }))}
          onConta={handleBulkContaChange}
          formaOptions={formaOpcoesBulk}
          onForma={handleBulkForma}
          categoriaOptions={bulkCategoriaTipo ? categoriaOpcoes(bulkCategoriaTipo === 'receitas' ? categoriasReceita : categoriasDespesa) : undefined}
          onCategoria={bulkCategoriaTipo ? handleBulkCategoria : undefined}
          clienteOptions={hasEntradas ? clienteOptions : undefined}
          onCliente={hasEntradas ? handleBulkClienteChange : undefined}
          showFornecedor={hasSaidas}
          onFornecedor={hasSaidas ? handleBulkFornecedorChange : undefined}
          onExport={handleExport}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          disabled={isSaving}
        />

        {/* Transferência */}
        <Sheet open={transferModalOpen} onOpenChange={setTransferModalOpen}>
          <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[720px]')}>
            <ModalShell>
              <ModalHeader eyebrow="Entre suas contas · não entra no DRE" title="Transferir" onClose={() => setTransferModalOpen(false)} />
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
                <ValorInput valor={transferData.valor} onChange={(n) => setTransferData(prev => ({ ...prev, valor: n }))} tom="neutro" autoFocus />
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  {([['Sai de', 'conta_origem_id', 'conta_destino_id'], null, ['Entra em', 'conta_destino_id', 'conta_origem_id']] as const).map((lado, i) => lado === null ? (
                    <button key="swap" type="button" onClick={() => setTransferData(prev => ({ ...prev, conta_origem_id: prev.conta_destino_id, conta_destino_id: prev.conta_origem_id }))} aria-label="Inverter contas"
                      className="mx-auto grid h-10 w-10 place-items-center self-center rounded-full border border-border bg-surface text-foreground-muted hover:text-foreground">
                      <ArrowRightLeft className="h-4 w-4 rotate-90 sm:rotate-0" />
                    </button>
                  ) : (
                    <section key={i} className="rounded-[20px] border border-border bg-surface p-3">
                      <p className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">{lado[0]}</p>
                      <div className="space-y-1.5">
                        {activeContas.map(c => {
                          const sel = transferData[lado[1]] === c.id;
                          const bloqueada = transferData[lado[2]] === c.id;
                          return (
                            <button key={c.id} type="button" disabled={bloqueada} onClick={() => setTransferData(prev => ({ ...prev, [lado[1]]: c.id }))}
                              className={cn('flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-35', sel ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-surface-2')}>
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                              <span className="min-w-0 flex-1 truncate text-[13.5px]">{c.nome}</span>
                              <span className={cn('text-[12px] tabular-nums', sel ? 'text-background/70' : 'text-foreground-muted')}>{c.tipo === 'cartao_credito' ? 'cartão' : formatCurrency(Number(c.saldo_atual || 0))}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 rounded-[20px] border border-border bg-surface p-4 sm:grid-cols-2">
                  <DatePickerField label="Data" value={transferData.data_transferencia} onChange={(d) => setTransferData(prev => ({ ...prev, data_transferencia: d }))} />
                  <Campo label="Descrição (opcional)"><Input value={transferData.descricao || ''} onChange={(e) => setTransferData(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Ex.: Reserva de emergência" /></Campo>
                </div>
                {transferData.conta_origem_id && transferData.conta_destino_id && (() => {
                  const o = contaById.get(transferData.conta_origem_id);
                  const d = contaById.get(transferData.conta_destino_id);
                  if (!o || !d) return null;
                  const so = Number(o.saldo_atual || 0) - (transferData.valor || 0);
                  const sd = Number(d.saldo_atual || 0) + (transferData.valor || 0);
                  return (
                    <div className="rounded-2xl bg-surface-2/70 p-3.5 text-[13px]">
                      <p className="mb-1.5 text-[12px] text-foreground-muted">Depois da transferência</p>
                      <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-foreground"><span className="h-2 w-2 rounded-full" style={{ background: o.cor }} />{o.nome}</span><span className={cn('tabular-nums', so < 0 ? 'text-danger-fg' : 'text-foreground')}>{formatCurrency(so)}</span></div>
                      <div className="mt-1 flex justify-between gap-2"><span className="flex items-center gap-1.5 text-foreground"><span className="h-2 w-2 rounded-full" style={{ background: d.cor }} />{d.nome}</span><span className="tabular-nums text-foreground">{formatCurrency(sd)}</span></div>
                    </div>
                  );
                })()}
              </div>
              <ModalFooter>
                <button type="button" onClick={() => setTransferModalOpen(false)} className={btn.outline}>Cancelar</button>
                <button type="button" onClick={handleTransfer} disabled={!transferData.conta_origem_id || !transferData.conta_destino_id || transferData.valor <= 0} className={btn.primary}>
                  <Check className="h-4 w-4" />Transferir {transferData.valor > 0 ? formatCurrency(transferData.valor) : ''}
                </button>
              </ModalFooter>
            </ModalShell>
          </SheetContent>
        </Sheet>
    </main>
  );
}
