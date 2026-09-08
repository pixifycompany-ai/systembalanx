import { useState, useMemo } from 'react';
import { IconButton } from '@/components/shared/IconButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { MobileDespesasList } from '@/components/despesas/MobileDespesasList';
import { StatusBadge, CategoryBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner, SkeletonTable } from '@/components/shared/LoadingSpinner';
import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { getDisplayStatus } from '@/utils/statusHelpers';
import { exportDespesas } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useDespesas, type DespesaFormData } from '@/hooks/useDespesas';
import { useContas } from '@/hooks/useContas';
import { useClientes } from '@/hooks/useClientes';
import { Plus, Pencil, Trash2, TrendingDown, Clock, CheckCircle, Upload, ArrowUpDown, ChevronUp, ChevronDown, Wallet, Filter, FileText } from 'lucide-react';
import { DESPESA_STATUS_OPTIONS, DESPESA_TIPO_OPTIONS } from '@/types/finance';
import { FileImportDialog } from '@/components/import/FileImportDialog';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReceiptGenerator, type ReceiptData } from '@/components/shared/ReceiptGenerator';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { createAuxiliaryTransactions } from '@/hooks/useAuxiliaryTransactions';
import { supabase } from '@/integrations/supabase/client';

type SortField = 'fornecedor' | 'descricao' | 'valor' | 'data_vencimento' | 'status';
type SortDirection = 'asc' | 'desc';

export default function Despesas() {
  const isMobile = useIsMobile();
  const { 
    despesas, 
    categorias,
    isLoading, 
    createDespesa,
    createDespesaParcelada,
    updateDespesa,
    updateMultipleStatus,
    updateMultipleCategoria,
    updateMultipleFornecedor,
    deleteDespesa, 
    deleteMultipleDespesas 
  } = useDespesas();

  const { getActiveContas } = useContas();
  const activeContas = getActiveContas();
  const { clientes } = useClientes();
  
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<{ id: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    categoria_id: string;
    conta_id: string;
    cliente_id: string;
    fornecedor: string;
    descricao: string;
    valor: string;
    data_competencia: string;
    data_vencimento: string;
    data_pagamento: string;
    status: 'pendente' | 'pago' | 'atrasado';
    tipo: 'fixa' | 'variavel';
    empresa_fonte: '' | 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO';
    valor_juros: string;
    valor_tarifa: string;
    parcelas?: string;
  }>({
    categoria_id: '',
    conta_id: '',
    cliente_id: '',
    fornecedor: '',
    descricao: '',
    valor: '',
    data_competencia: '',
    data_vencimento: '',
    data_pagamento: '',
    status: 'pendente',
    tipo: 'variavel',
    empresa_fonte: '',
    valor_juros: '',
    valor_tarifa: '',
  });

  // Generate dynamic month options based on data
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    
    // Get all dates from despesas
    const allDates = despesas
      .map(d => d.data_vencimento)
      .filter(Boolean)
      .map(d => parseISO(d));
    
    if (allDates.length === 0) {
      // Fallback: last 12 months
      for (let i = 0; i < 12; i++) {
        const date = subMonths(today, i);
        const value = format(date, 'yyyy-MM');
        const label = format(date, 'MMMM yyyy', { locale: ptBR });
        options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
      }
      return options;
    }
    
    // Find min and max dates
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Always start the list from the current month at the top.
    const actualMax = today;

    // Generate months from max to min
    let current = startOfMonth(actualMax);
    const minMonth = startOfMonth(minDate);
    
    while (current >= minMonth) {
      const value = format(current, 'yyyy-MM');
      const label = format(current, 'MMMM yyyy', { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
      current = subMonths(current, 1);
    }
    
    return options;
  }, [despesas]);

  // Calculate totals
  const totals = useMemo(() => {
    const pago = despesas
      .filter(d => d.status === 'pago')
      .reduce((sum, d) => sum + Number(d.valor), 0);
    const pendente = despesas
      .filter(d => d.status === 'pendente' || d.status === 'atrasado')
      .reduce((sum, d) => sum + Number(d.valor), 0);
    const total = despesas.reduce((sum, d) => sum + Number(d.valor), 0);
    return { pago, pendente, total };
  }, [despesas]);

  // Filter despesas
  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => {
      const matchesCategoria = categoriaFilter === 'all' || d.categoria_id === categoriaFilter;
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchesSearch = !searchTerm || 
        d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.fornecedor && d.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Month filter
      let matchesMonth = true;
      if (monthFilter !== 'all' && d.data_vencimento) {
        const vencimento = parseISO(d.data_vencimento);
        const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
        const monthEnd = endOfMonth(monthStart);
        matchesMonth = vencimento >= monthStart && vencimento <= monthEnd;
      }
      
      return matchesCategoria && matchesStatus && matchesSearch && matchesMonth;
    });
  }, [despesas, categoriaFilter, statusFilter, monthFilter, searchTerm]);

  // Calculate subtotal of filtered items
  const filteredSubtotal = useMemo(() => {
    return filteredDespesas.reduce((sum, d) => sum + Number(d.valor), 0);
  }, [filteredDespesas]);

  // Check if filters are applied
  const hasFilters = statusFilter !== 'all' || categoriaFilter !== 'all' || monthFilter !== 'all' || searchTerm !== '';

  // Sort filtered despesas
  const sortedDespesas = useMemo(() => {
    const sorted = [...filteredDespesas];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'fornecedor':
          comparison = (a.fornecedor || '').localeCompare(b.fornecedor || '');
          break;
        case 'descricao':
          comparison = a.descricao.localeCompare(b.descricao);
          break;
        case 'valor':
          comparison = Number(a.valor) - Number(b.valor);
          break;
        case 'data_vencimento':
          comparison = (a.data_vencimento || '').localeCompare(b.data_vencimento || '');
          break;
        case 'status':
          const statusOrder = { pago: 0, pendente: 1, atrasado: 2 };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredDespesas, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />;
  };

  // Multi-select
  const {
    selectedIds,
    selectedItems,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useMultiSelect({
    items: sortedDespesas,
    getItemId: (item) => item.id,
  });

  // Bulk delete
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = async () => {
    setIsSaving(true);
    const success = await deleteMultipleDespesas(Array.from(selectedIds));
    if (success) {
      setBulkDeleteDialogOpen(false);
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    setIsSaving(true);
    const success = await updateMultipleStatus(Array.from(selectedIds), newStatus as 'pendente' | 'pago' | 'atrasado');
    if (success) {
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleBulkCategoriaChange = async (categoriaId: string) => {
    setIsSaving(true);
    const success = await updateMultipleCategoria(Array.from(selectedIds), categoriaId);
    if (success) {
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleBulkFornecedorChange = async (fornecedor: string) => {
    setIsSaving(true);
    const success = await updateMultipleFornecedor(Array.from(selectedIds), fornecedor);
    if (success) {
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleExport = () => {
    const dataToExport = selectedItems.map(d => ({
      fornecedor: d.fornecedor || '',
      descricao: d.descricao,
      valor: Number(d.valor),
      categoria: d.categoria?.nome || '-',
      data_vencimento: d.data_vencimento || '-',
      status: d.status,
    }));
    exportDespesas(dataToExport);
  };

  // Open modal for new despesa
  const handleNew = () => {
    setEditingDespesa(null);
    setFormData({
      categoria_id: '',
      conta_id: '',
      cliente_id: '',
      fornecedor: '',
      descricao: '',
      valor: '',
      data_competencia: new Date().toISOString().split('T')[0],
      data_vencimento: '',
      data_pagamento: '',
      status: 'pendente',
      tipo: 'variavel',
      empresa_fonte: '',
      valor_juros: '',
      valor_tarifa: '',
    });
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (despesa: typeof despesas[0]) => {
    setEditingDespesa({ id: despesa.id });
    setFormData({
      categoria_id: despesa.categoria_id || '',
      conta_id: despesa.conta_id || '',
      cliente_id: (despesa as any).cliente_id || '',
      fornecedor: despesa.fornecedor || '',
      descricao: despesa.descricao,
      valor: String(despesa.valor),
      data_competencia: despesa.data_competencia,
      data_vencimento: despesa.data_vencimento || '',
      data_pagamento: despesa.data_pagamento || '',
      status: despesa.status,
      tipo: despesa.tipo,
      empresa_fonte: ((despesa as any).empresa_fonte as '' | 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO') || '',
      valor_juros: '',
      valor_tarifa: '',
    });
    setModalOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descricao || !formData.valor) return;

    setIsSaving(true);
    
    const data: DespesaFormData = {
      categoria_id: formData.categoria_id || undefined,
      conta_id: formData.conta_id || undefined,
      cliente_id: formData.cliente_id || undefined,
      fornecedor: formData.fornecedor || undefined,
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      data_competencia: formData.data_competencia,
      data_vencimento: formData.data_vencimento,
      data_pagamento: formData.data_pagamento || undefined,
      status: formData.status,
      tipo: formData.tipo,
      empresa_fonte: formData.empresa_fonte || null,
    };
    
    if (editingDespesa) {
      await updateDespesa(editingDespesa.id, data);
    } else {
      const contaSel = activeContas.find(c => c.id === formData.conta_id) as any;
      const nParcelas = parseInt(formData.parcelas || '1', 10) || 1;
      if (contaSel?.tipo === 'cartao_credito' && nParcelas > 1) {
        await createDespesaParcelada(data, nParcelas);
      } else {
        await createDespesa(data);
      }
    }

    // Create auxiliary transactions for juros/tarifa when status is 'pago'
    if (formData.status === 'pago') {
      const valorJuros = parseFloat(formData.valor_juros) || 0;
      const valorTarifa = parseFloat(formData.valor_tarifa) || 0;
      if (valorJuros > 0 || valorTarifa > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await createAuxiliaryTransactions({
            tipo: 'despesa',
            descricaoOrigem: formData.descricao,
            valorJuros,
            valorTarifa,
            data_competencia: formData.data_competencia,
            data_vencimento: formData.data_vencimento,
            conta_id: formData.conta_id || undefined,
            cliente_id: formData.cliente_id || undefined,
            user_id: user.id,
          });
        }
      }
    }
    
    setModalOpen(false);
    setIsSaving(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingId) return;
    
    setIsSaving(true);
    const success = await deleteDespesa(deletingId);
    if (success) {
      setDeleteDialogOpen(false);
    }
    setIsSaving(false);
    setDeletingId(null);
  };

  return (
    <main className="container py-4 md:py-6">
        {/* Page Header */}
        <MobilePageHeader
          eyebrow="Pagamentos"
          title="Despesas"
          actions={
            <>
              <IconButton label="Importar despesas" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4" />
              </IconButton>
              <IconButton label="Nova Despesa" emphasis="primary" onClick={handleNew}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </>
          }
        />

        {/* Summary — 3 KPIs compactos (igual mockup) */}
        <KpiTriple
          items={[
            { label: 'Pago', value: totals.pago, tone: 'green' },
            { label: 'Pendente', value: totals.pendente, tone: 'amber' },
            { label: 'Total', value: totals.total, tone: 'red' },
          ]}
        />

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <Input
            type="search"
            placeholder="Buscar por descrição ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <div className="grid grid-cols-3 gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Filtrar por mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {DESPESA_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subtotal when filters applied */}
          {hasFilters && sortedDespesas.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <Filter className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">
                Subtotal filtrado: <span className="font-semibold text-foreground">{formatCurrency(filteredSubtotal)}</span>
                <span className="ml-2">({sortedDespesas.length} {sortedDespesas.length === 1 ? 'item' : 'itens'})</span>
              </span>
            </div>
          )}
        </div>

        {/* Table / Mobile List */}
        {isMobile ? (
          <MobileDespesasList
            despesas={sortedDespesas as any}
            isLoading={isLoading}
            onEdit={(d: any) => handleEdit(d)}
            onConfirm={async (id) => { await updateDespesa(id, { status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] } as any); }}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onNew={handleNew}
          />
        ) : (
        <div className="metric-card overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : sortedDespesas.length === 0 ? (
            <EmptyState
              emoji="💸"
              title="Nenhuma despesa encontrada"
              description="Registre suas despesas para controlar seus gastos."
              action={
                <Button onClick={handleNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Despesa
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos"
                        className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      />
                    </th>
                    <th>
                      <button onClick={() => handleSort('fornecedor')} className="flex items-center hover:text-foreground transition-colors">
                        Fornecedor <SortIcon field="fornecedor" />
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('descricao')} className="flex items-center hover:text-foreground transition-colors">
                        Descrição <SortIcon field="descricao" />
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('valor')} className="flex items-center hover:text-foreground transition-colors">
                        Valor <SortIcon field="valor" />
                      </button>
                    </th>
                    <th>Categoria</th>
                    <th>
                      <button onClick={() => handleSort('data_vencimento')} className="flex items-center hover:text-foreground transition-colors">
                        Vencimento <SortIcon field="data_vencimento" />
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('status')} className="flex items-center hover:text-foreground transition-colors">
                        Status <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDespesas.map(despesa => (
                    <tr key={despesa.id} className={isSelected(despesa.id) ? 'bg-primary/5' : ''}>
                      <td>
                        <Checkbox
                          checked={isSelected(despesa.id)}
                          onCheckedChange={() => toggleSelect(despesa.id)}
                          aria-label={`Selecionar ${despesa.descricao}`}
                        />
                      </td>
                      <td className="font-medium">
                        {(despesa as any).cliente?.nome 
                          ? <span>{(despesa as any).cliente.nome}{despesa.fornecedor ? <span className="text-muted-foreground text-xs ml-1">({despesa.fornecedor})</span> : ''}</span>
                          : despesa.fornecedor || '-'
                        }
                      </td>
                      <td className="max-w-[200px] truncate">{despesa.descricao}</td>
                      <td className="value-negative tabular-nums">
                        {formatCurrency(Number(despesa.valor))}
                      </td>
                      <td>
                        <CategoryBadge 
                          name={despesa.categoria?.nome || '-'} 
                          color={despesa.categoria?.cor}
                        />
                      </td>
                      <td>{formatDate(despesa.data_vencimento || '')}</td>
                      <td>
                        <StatusBadge status={getDisplayStatus(despesa.status, despesa.data_vencimento)} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(despesa)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingId(despesa.id); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Create/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>
                {editingDespesa ? 'Editar Despesa' : 'Nova Despesa'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria_id">Categoria</Label>
                  <Select
                    value={formData.categoria_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cat.cor }}
                            />
                            {cat.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conta_id">Conta</Label>
                  <Select
                    value={formData.conta_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, conta_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeContas.map(conta => (
                        <SelectItem key={conta.id} value={conta.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: conta.cor }}
                            />
                            {conta.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!editingDespesa && (() => {
                const contaSel = activeContas.find(c => c.id === formData.conta_id) as any;
                if (contaSel?.tipo !== 'cartao_credito') return null;
                const n = parseInt(formData.parcelas || '1', 10) || 1;
                const totalNum = parseFloat(formData.valor) || 0;
                return (
                  <div className="space-y-2">
                    <Label htmlFor="parcelas">Parcelas (cartão)</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      max="48"
                      step="1"
                      value={formData.parcelas ?? '1'}
                      onChange={(e) => setFormData(prev => ({ ...prev, parcelas: e.target.value }))}
                      placeholder="1"
                    />
                    {n > 1 && totalNum > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {n}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.round((totalNum / n) * 100) / 100)}
                        {' '}· 1ª na fatura atual, as demais nas próximas
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: 'fixa' | 'variavel') => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESPESA_TIPO_OPTIONS.filter(o => o.value !== 'investimento').map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente_id">Vincular a Cliente</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cliente_id: value === '_none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {clientes.filter(c => c.status === 'ativo').map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input
                  id="fornecedor"
                  value={formData.fornecedor}
                  onChange={(e) => setFormData(prev => ({ ...prev, fornecedor: e.target.value }))}
                  placeholder="Ex: Adobe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Assinatura Creative Cloud"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_competencia">Data Competência *</Label>
                  <DatePickerField
                    label=""
                    value={formData.data_competencia}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_competencia: d }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_vencimento">Data Vencimento</Label>
                  <DatePickerField
                    label=""
                    value={formData.data_vencimento}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_vencimento: d }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_pagamento">Data Pagamento</Label>
                  <DatePickerField
                    label=""
                    value={formData.data_pagamento}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_pagamento: d }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'pendente' | 'pago' | 'atrasado') => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESPESA_STATUS_OPTIONS.filter(o => o.value !== 'cancelado').map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Juros/Multa e Tarifa Bancária - shown when status is 'pago' */}
              {formData.status === 'pago' && (
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-amber-700 dark:text-amber-400">Juros/Multa (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor_juros}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor_juros: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-red-700 dark:text-red-400">Tarifa Bancária (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor_tarifa}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor_tarifa: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Juros/Multa e Tarifa Bancária criam despesas extras automaticamente.
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4">
                {editingDespesa && (formData.fornecedor || formData.cliente_id) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const clienteNome = formData.cliente_id
                        ? clientes.find(c => c.id === formData.cliente_id)?.nome || formData.fornecedor || '-'
                        : formData.fornecedor || '-';
                      const clienteObj = formData.cliente_id
                        ? clientes.find(c => c.id === formData.cliente_id)
                        : undefined;
                      setReceiptData({
                        id: editingDespesa.id,
                        descricao: formData.descricao,
                        valor: parseFloat(formData.valor) || 0,
                        clienteNome,
                        clienteCnpj: clienteObj?.cpf_cnpj || undefined,
                        dataVencimento: formData.data_vencimento || undefined,
                        dataPagamento: formData.data_pagamento || undefined,
                        tipo: 'despesa',
                      });
                      setReceiptOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    Gerar Recibo
                  </Button>
                )}
                <div className="flex gap-3 ml-auto">
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Salvando...
                      </>
                    ) : (
                      editingDespesa ? 'Atualizar' : 'Criar'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Despesa"
          description="Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={isSaving}
        />

        {/* Bulk Delete Confirmation */}
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title="Excluir Despesas"
          description={`Tem certeza que deseja excluir ${selectedIds.size} despesas? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir Todas"
          variant="destructive"
          onConfirm={handleBulkDelete}
          isLoading={isSaving}
        />

        {/* Multi-select bar */}
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          onExport={handleExport}
          statusOptions={DESPESA_STATUS_OPTIONS.filter(o => o.value !== 'cancelado').map(o => ({ value: o.value, label: o.label }))}
          onStatusChange={handleBulkStatusChange}
          categoriaOptions={categorias.map(c => ({ value: c.id, label: c.nome, color: c.cor }))}
          onCategoriaChange={handleBulkCategoriaChange}
          showFornecedor={true}
          onFornecedorChange={handleBulkFornecedorChange}
        />

        {/* Import Dialog */}
        <FileImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={() => {}}
        />

        {/* Receipt Generator */}
        <ReceiptGenerator
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          data={receiptData}
        />
    </main>
  );
}
