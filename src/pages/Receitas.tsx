import { useState, useMemo } from 'react';
import { IconButton } from '@/components/shared/IconButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { MobileReceitasList } from '@/components/receitas/MobileReceitasList';
import { StatusBadge } from '@/components/shared/StatusBadge';
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
import { exportReceitas } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useReceitas, type ReceitaFormData } from '@/hooks/useReceitas';
import { useClientes } from '@/hooks/useClientes';
import { useContas } from '@/hooks/useContas';
import { Plus, Pencil, Trash2, TrendingUp, Clock, CheckCircle, Upload, ArrowUpDown, ChevronUp, ChevronDown, Wallet, Filter, FileText } from 'lucide-react';
import { RECEITA_STATUS_OPTIONS, FORMA_PAGAMENTO_OPTIONS } from '@/types/finance';
import { FileImportDialog } from '@/components/import/FileImportDialog';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReceiptGenerator, type ReceiptData } from '@/components/shared/ReceiptGenerator';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { createAuxiliaryTransactions } from '@/hooks/useAuxiliaryTransactions';
import { supabase } from '@/integrations/supabase/client';

type SortField = 'cliente' | 'descricao' | 'valor' | 'data_vencimento' | 'status';
type SortDirection = 'asc' | 'desc';

export default function Receitas() {
  const isMobile = useIsMobile();
  const { 
    receitas,
    categorias,
    isLoading, 
    createReceita, 
    updateReceita, 
    updateMultipleStatus,
    updateMultipleCategoria,
    updateMultipleCliente,
    deleteReceita, 
    deleteMultipleReceitas 
  } = useReceitas();
  
  const { clientes } = useClientes();
  const { contas, getActiveContas } = useContas();
  const activeContas = getActiveContas();
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clienteFilter, setClienteFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingReceita, setEditingReceita] = useState<{ id: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    cliente_id: string;
    categoria_id: string;
    conta_id: string;
    descricao: string;
    valor: string;
    data_competencia: string;
    data_vencimento: string;
    data_recebimento: string;
    status: 'pendente' | 'recebido' | 'atrasado';
    forma_pagamento: string;
    empresa_fonte: '' | 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO';
    valor_juros: string;
    valor_tarifa: string;
  }>({
    cliente_id: '',
    categoria_id: '',
    conta_id: '',
    descricao: '',
    valor: '',
    data_competencia: '',
    data_vencimento: '',
    data_recebimento: '',
    status: 'pendente',
    forma_pagamento: '',
    empresa_fonte: '',
    valor_juros: '',
    valor_tarifa: '',
  });

  // Generate dynamic month options based on data
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    
    // Get all dates from receitas
    const allDates = receitas
      .map(r => r.data_vencimento)
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
    // Future months only show if you scroll up via the "Todos" filter.
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
  }, [receitas]);

  // Calculate totals
  const totals = useMemo(() => {
    const recebido = receitas
      .filter(r => r.status === 'recebido')
      .reduce((sum, r) => sum + Number(r.valor), 0);
    const pendente = receitas
      .filter(r => r.status === 'pendente' || r.status === 'atrasado')
      .reduce((sum, r) => sum + Number(r.valor), 0);
    const total = receitas.reduce((sum, r) => sum + Number(r.valor), 0);
    return { recebido, pendente, total };
  }, [receitas]);

  // Filter and sort receitas
  const filteredReceitas = useMemo(() => {
    let filtered = receitas.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesCliente = clienteFilter === 'all' || r.cliente_id === clienteFilter;
      const matchesSearch = !searchTerm || 
        r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Month filter
      let matchesMonth = true;
      if (monthFilter !== 'all' && r.data_vencimento) {
        const vencimento = parseISO(r.data_vencimento);
        const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
        const monthEnd = endOfMonth(monthStart);
        matchesMonth = vencimento >= monthStart && vencimento <= monthEnd;
      }
      
      return matchesStatus && matchesCliente && matchesSearch && matchesMonth;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'cliente':
          comparison = (a.cliente?.nome || '').localeCompare(b.cliente?.nome || '');
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
          const statusOrder = { recebido: 0, pendente: 1, atrasado: 2 };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [receitas, statusFilter, clienteFilter, monthFilter, searchTerm, sortField, sortDirection]);

  // Calculate subtotal of filtered items
  const filteredSubtotal = useMemo(() => {
    return filteredReceitas.reduce((sum, r) => sum + Number(r.valor), 0);
  }, [filteredReceitas]);

  // Check if filters are applied
  const hasFilters = statusFilter !== 'all' || clienteFilter !== 'all' || monthFilter !== 'all' || searchTerm !== '';

  // Filter and sort receitas
  const sortedReceitas = useMemo(() => {
    const filtered = [...filteredReceitas];

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'cliente':
          comparison = (a.cliente?.nome || '').localeCompare(b.cliente?.nome || '');
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
          const statusOrder = { recebido: 0, pendente: 1, atrasado: 2 };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [filteredReceitas, sortField, sortDirection]);

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
    items: sortedReceitas,
    getItemId: (item) => item.id,
  });

  // Bulk delete
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = async () => {
    setIsSaving(true);
    const success = await deleteMultipleReceitas(Array.from(selectedIds));
    if (success) {
      setBulkDeleteDialogOpen(false);
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    setIsSaving(true);
    const success = await updateMultipleStatus(Array.from(selectedIds), newStatus as 'pendente' | 'recebido' | 'atrasado');
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

  const handleBulkClienteChange = async (clienteId: string) => {
    setIsSaving(true);
    const success = await updateMultipleCliente(Array.from(selectedIds), clienteId);
    if (success) {
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleExport = () => {
    const dataToExport = selectedItems.map(r => ({
      cliente: r.cliente?.nome || '-',
      descricao: r.descricao,
      valor: Number(r.valor),
      data_vencimento: r.data_vencimento || '-',
      status: r.status,
    }));
    exportReceitas(dataToExport);
  };

  // Open modal for new receita
  const handleNew = () => {
    setEditingReceita(null);
    setFormData({
      cliente_id: '',
      categoria_id: '',
      conta_id: '',
      descricao: '',
      valor: '',
      data_competencia: new Date().toISOString().split('T')[0],
      data_vencimento: '',
      data_recebimento: '',
      status: 'pendente',
      forma_pagamento: '',
      empresa_fonte: '',
      valor_juros: '',
      valor_tarifa: '',
    });
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (receita: typeof receitas[0]) => {
    setEditingReceita({ id: receita.id });
    setFormData({
      cliente_id: receita.cliente_id || '',
      categoria_id: receita.categoria_id || '',
      conta_id: receita.conta_id || '',
      descricao: receita.descricao,
      valor: String(receita.valor),
      data_competencia: receita.data_competencia,
      data_vencimento: receita.data_vencimento || '',
      data_recebimento: receita.data_recebimento || '',
      status: receita.status,
      forma_pagamento: receita.forma_pagamento || '',
      empresa_fonte: ((receita as any).empresa_fonte as '' | 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO') || '',
      valor_juros: '',
      valor_tarifa: '',
    });
    setModalOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.cliente_id || !formData.descricao || !formData.valor) return;

    setIsSaving(true);
    
    const data: ReceitaFormData = {
      cliente_id: formData.cliente_id,
      categoria_id: formData.categoria_id || undefined,
      conta_id: formData.conta_id || undefined,
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      data_competencia: formData.data_competencia,
      data_vencimento: formData.data_vencimento,
      data_recebimento: formData.data_recebimento || undefined,
      status: formData.status,
      forma_pagamento: formData.forma_pagamento || undefined,
      empresa_fonte: formData.empresa_fonte || null,
    };
    
    if (editingReceita) {
      await updateReceita(editingReceita.id, data);
    } else {
      await createReceita(data);
    }

    // Create auxiliary transactions for juros/tarifa when status is 'recebido'
    if (formData.status === 'recebido') {
      const valorJuros = parseFloat(formData.valor_juros) || 0;
      const valorTarifa = parseFloat(formData.valor_tarifa) || 0;
      if (valorJuros > 0 || valorTarifa > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await createAuxiliaryTransactions({
            tipo: 'receita',
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
    const success = await deleteReceita(deletingId);
    if (success) {
      setDeleteDialogOpen(false);
    }
    setIsSaving(false);
    setDeletingId(null);
  };

  const activeClientes = clientes.filter(c => c.status === 'ativo');

  return (
    <main className="container py-4 md:py-6">
        {/* Page Header */}
        <MobilePageHeader
          eyebrow="Recebimentos"
          title="Receitas"
          actions={
            <>
              <IconButton label="Importar receitas" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4" />
              </IconButton>
              <IconButton label="Nova Receita" emphasis="primary" onClick={handleNew}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </>
          }
        />

        {/* Summary — 3 KPIs compactos (igual mockup) */}
        <KpiTriple
          items={[
            { label: 'Recebido', value: totals.recebido, tone: 'green' },
            { label: 'Pendente', value: totals.pendente, tone: 'amber' },
            { label: 'Total', value: totals.total, tone: 'steel' },
          ]}
        />

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <Input
            type="search"
            placeholder="Buscar por descrição ou cliente..."
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
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {activeClientes.map(cliente => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome}
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
                {RECEITA_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subtotal when filters applied */}
          {hasFilters && sortedReceitas.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                Subtotal filtrado: <span className="font-semibold text-foreground">{formatCurrency(filteredSubtotal)}</span>
                <span className="ml-2">({sortedReceitas.length} {sortedReceitas.length === 1 ? 'item' : 'itens'})</span>
              </span>
            </div>
          )}
        </div>

        {/* Table / Mobile List */}
        {isMobile ? (
          <MobileReceitasList
            receitas={sortedReceitas as any}
            isLoading={isLoading}
            onEdit={(r: any) => handleEdit(r)}
            onConfirm={async (id) => { await updateReceita(id, { status: 'recebido', data_recebimento: new Date().toISOString().split('T')[0] } as any); }}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onNew={handleNew}
          />
        ) : (
        <div className="metric-card overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : sortedReceitas.length === 0 ? (
            <EmptyState
              title="Nenhuma receita encontrada"
              description="Crie sua primeira receita para começar a acompanhar seus recebimentos."
              action={
                <Button onClick={handleNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Receita
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
                      <button onClick={() => handleSort('cliente')} className="flex items-center hover:text-foreground transition-colors">
                        Cliente <SortIcon field="cliente" />
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
                  {sortedReceitas.map(receita => (
                    <tr key={receita.id} className={isSelected(receita.id) ? 'bg-primary/5' : ''}>
                      <td>
                        <Checkbox
                          checked={isSelected(receita.id)}
                          onCheckedChange={() => toggleSelect(receita.id)}
                          aria-label={`Selecionar ${receita.descricao}`}
                        />
                      </td>
                      <td className="font-medium">{receita.cliente?.nome || '-'}</td>
                      <td className="max-w-[200px] truncate">{receita.descricao}</td>
                      <td className="value-positive tabular-nums">
                        {formatCurrency(Number(receita.valor))}
                      </td>
                      <td>{formatDate(receita.data_vencimento)}</td>
                      <td>
                        <StatusBadge status={getDisplayStatus(receita.status, receita.data_vencimento)} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(receita)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingId(receita.id); setDeleteDialogOpen(true); }}>
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
                {editingReceita ? 'Editar Receita' : 'Nova Receita'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente_id">Cliente *</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cliente_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="conta_id">Conta</Label>
                  <Select
                    value={formData.conta_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, conta_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conta" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Gestão de Redes Sociais - Janeiro"
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
                  <Label htmlFor="data_recebimento">Data Recebimento</Label>
                  <DatePickerField
                    label=""
                    value={formData.data_recebimento}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_recebimento: d }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'pendente' | 'recebido' | 'atrasado') => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECEITA_STATUS_OPTIONS.filter(o => o.value !== 'cancelado').map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select
                    value={formData.forma_pagamento}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, forma_pagamento: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMA_PAGAMENTO_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Juros/Multa e Tarifa Bancária - shown when status is 'recebido' */}
              {formData.status === 'recebido' && (
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
                    Juros/Multa cria uma receita extra. Tarifa bancária cria uma despesa automática.
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4">
                {editingReceita && formData.cliente_id && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const cliente = clientes.find(c => c.id === formData.cliente_id);
                      if (!cliente) return;
                      setReceiptData({
                        id: editingReceita.id,
                        descricao: formData.descricao,
                        valor: parseFloat(formData.valor) || 0,
                        clienteNome: cliente.nome,
                        clienteCnpj: cliente.cpf_cnpj || undefined,
                        formaPagamento: formData.forma_pagamento || undefined,
                        dataVencimento: formData.data_vencimento || undefined,
                        dataRecebimento: formData.data_recebimento || undefined,
                        tipo: 'receita',
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
                      editingReceita ? 'Atualizar' : 'Criar'
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
          title="Excluir Receita"
          description="Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={isSaving}
        />

        {/* Bulk Delete Confirmation */}
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title="Excluir Receitas"
          description={`Tem certeza que deseja excluir ${selectedIds.size} receitas? Esta ação não pode ser desfeita.`}
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
          statusOptions={RECEITA_STATUS_OPTIONS.filter(o => o.value !== 'cancelado').map(o => ({ value: o.value, label: o.label }))}
          onStatusChange={handleBulkStatusChange}
          categoriaOptions={categorias.map(c => ({ value: c.id, label: c.nome, color: c.cor }))}
          onCategoriaChange={handleBulkCategoriaChange}
          clienteOptions={activeClientes.map(c => ({ value: c.id, label: c.nome }))}
          onClienteChange={handleBulkClienteChange}
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
