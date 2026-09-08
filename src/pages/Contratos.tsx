import { useState, useMemo, useEffect } from 'react';
import { IconButton } from '@/components/shared/IconButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MobileContratosList } from '@/components/contratos/MobileContratosList';
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
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportContratos } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useContratos, type ContratoFormData } from '@/hooks/useContratos';
import { useContratoParcelas, gerarParcelas, type ParcelaFormData } from '@/hooks/useContratoParcelas';
import { useClientes } from '@/hooks/useClientes';
import { Plus, Pencil, Trash2, FileText, RefreshCw, Upload, Calendar, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContractImportDialog } from '@/components/import/ContractImportDialog';
import { useContratoAditivos, type AditivoFormData } from '@/hooks/useContratoAditivos';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { findPossibleDuplicate, findDuplicateGroups, type DuplicateMatch, type DuplicateGroup } from '@/utils/contractDuplicates';
import { isContratoAtivoHoje } from '@/utils/contractUtils';
import { AlertTriangle } from 'lucide-react';

const RECORRENCIA_OPTIONS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'unico', label: 'Único' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'encerrado', label: 'Encerrado' },
] as const;

export default function Contratos() {
  const isMobile = useIsMobile();
  const { 
    contratos, 
    isLoading, 
    createContrato, 
    updateContrato, 
    deleteContrato, 
    deleteMultipleContratos,
    inactivateContrato,
    refetch: refetchContratos,
  } = useContratos();
  
  const { createParcelas, deleteParcelas } = useContratoParcelas();
  const { clientes } = useClientes();
  
  // Aditivos state
  const [editingContratoId, setEditingContratoId] = useState<string | undefined>(undefined);
  const { aditivos, isLoading: aditivosLoading, createAditivo, deleteAditivo } = useContratoAditivos(editingContratoId);
  const [showAditivoForm, setShowAditivoForm] = useState(false);
  const [aditivoData, setAditivoData] = useState<{ valor_novo: string; data_vigencia: string; motivo: string }>({
    valor_novo: '',
    data_vigencia: '',
    motivo: '',
  });
  
  const [statusFilter, setStatusFilter] = useState<string>('ativo');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<{ id: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<ContratoFormData | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    cliente_id: string;
    descricao: string;
    valor: string;
    data_inicio: string;
    data_fim: string;
    dia_vencimento: string;
    recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico';
    status: 'ativo' | 'cancelado' | 'encerrado';
    num_parcelas: string;
    data_inativacao: string;
  }>({
    cliente_id: '',
    descricao: '',
    valor: '',
    data_inicio: '',
    data_fim: '',
    dia_vencimento: '',
    recorrencia: 'mensal',
    status: 'ativo',
    num_parcelas: '1',
    data_inativacao: '',
  });

  // Parcelas state for unique contracts
  const [parcelas, setParcelas] = useState<ParcelaFormData[]>([]);

  // Generate parcelas when num_parcelas or valor changes for unique contracts
  useEffect(() => {
    if (formData.recorrencia === 'unico' && formData.valor && formData.data_inicio) {
      const numParcelas = parseInt(formData.num_parcelas) || 1;
      const valorTotal = parseFloat(formData.valor) || 0;
      const primeiroVencimento = new Date(formData.data_inicio);
      
      if (numParcelas > 0 && valorTotal > 0 && !isNaN(primeiroVencimento.getTime())) {
        const novasParcelas = gerarParcelas(valorTotal, numParcelas, primeiroVencimento);
        setParcelas(novasParcelas);
      }
    }
  }, [formData.recorrencia, formData.num_parcelas, formData.valor, formData.data_inicio]);

  // Filter contratos
  const filteredContratos = useMemo(() => {
    return contratos.filter(c => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesSearch = !searchTerm || 
        c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [contratos, statusFilter, searchTerm]);

  // Calculate totals using actual vigência (status + dates) so MRR matches reality
  const totals = useMemo(() => {
    const vigentes = filteredContratos.filter(c => isContratoAtivoHoje(c as any));
    const mrrTotal = vigentes
      .filter(c => c.recorrencia === 'mensal')
      .reduce((sum, c) => sum + Number(c.valor), 0);
    const ativos = vigentes.length;
    const valorTotal = vigentes.reduce((sum, c) => sum + Number(c.valor), 0);
    return { mrrTotal, ativos, valorTotal };
  }, [filteredContratos]);

  // Detect already-existing duplicate active contracts so user can sanitize
  const duplicateGroups = useMemo(() => findDuplicateGroups(contratos), [contratos]);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [keepContratoId, setKeepContratoId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const openMergeDialog = (group: DuplicateGroup) => {
    setMergeGroup(group);
    // Sugere manter o mais recente (já vem ordenado).
    setKeepContratoId(group.contratos[0]?.id || null);
  };

  const handleMergeDuplicates = async () => {
    if (!mergeGroup || !keepContratoId) return;
    const keeper = mergeGroup.contratos.find(c => c.id === keepContratoId);
    if (!keeper) return;
    setIsMerging(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const losers = mergeGroup.contratos.filter(c => c.id !== keeper.id);
      for (const loser of losers) {
        const valorLoser = Number(loser.valor);
        const valorKeeper = Number(keeper.valor);
        // Se valores são diferentes, registra como histórico no contrato mantido.
        if (Math.abs(valorLoser - valorKeeper) > 0.01) {
          await createAditivo(keeper.id, valorKeeper, {
            valor_novo: valorKeeper, // mantém valor atual do keeper como vigente
            data_vigencia: today,
            motivo: `Mesclagem: contrato duplicado "${loser.descricao}" (R$ ${valorLoser.toFixed(2)}) inativado`,
          });
        }
        await inactivateContrato(loser.id, today, 'encerrado');
      }
      await refetchContratos();
      setMergeGroup(null);
      setKeepContratoId(null);
    } finally {
      setIsMerging(false);
    }
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
    items: filteredContratos,
    getItemId: (item) => item.id,
  });

  // Bulk delete
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = async () => {
    setIsSaving(true);
    const success = await deleteMultipleContratos(Array.from(selectedIds));
    if (success) {
      setBulkDeleteDialogOpen(false);
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleExport = () => {
    const dataToExport = selectedItems.map(c => ({
      numero_contrato: c.id.slice(0, 8),
      cliente: c.cliente?.nome || '-',
      tipo: c.recorrencia,
      valor_mensal: Number(c.valor),
      data_inicio: c.data_inicio,
      status: c.status,
    }));
    exportContratos(dataToExport);
  };

  // Open modal for new contrato
  const handleNew = () => {
    setEditingContrato(null);
    setEditingContratoId(undefined);
    setFormData({
      cliente_id: '',
      descricao: '',
      valor: '',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: '',
      dia_vencimento: '10',
      recorrencia: 'mensal',
      status: 'ativo',
      num_parcelas: '1',
      data_inativacao: '',
    });
    setParcelas([]);
    setShowAditivoForm(false);
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (contrato: typeof contratos[0]) => {
    setEditingContrato({ id: contrato.id });
    setEditingContratoId(contrato.id);
    setFormData({
      cliente_id: contrato.cliente_id,
      descricao: contrato.descricao,
      valor: String(contrato.valor),
      data_inicio: contrato.data_inicio,
      data_fim: contrato.data_fim || '',
      dia_vencimento: contrato.dia_vencimento ? String(contrato.dia_vencimento) : '',
      recorrencia: contrato.recorrencia,
      status: contrato.status,
      num_parcelas: '1',
      data_inativacao: contrato.data_inativacao || '',
    });
    setParcelas([]);
    setShowAditivoForm(false);
    setAditivoData({ valor_novo: '', data_vigencia: '', motivo: '' });
    setModalOpen(true);
  };

  const handleSaveAditivo = async () => {
    if (!editingContratoId || !aditivoData.valor_novo || !aditivoData.data_vigencia) return;
    setIsSaving(true);
    const success = await createAditivo(
      editingContratoId,
      parseFloat(formData.valor),
      {
        valor_novo: parseFloat(aditivoData.valor_novo),
        data_vigencia: aditivoData.data_vigencia,
        motivo: aditivoData.motivo || undefined,
      }
    );
    if (success) {
      setFormData(prev => ({ ...prev, valor: aditivoData.valor_novo }));
      setShowAditivoForm(false);
      setAditivoData({ valor_novo: '', data_vigencia: '', motivo: '' });
      refetchContratos();
    }
    setIsSaving(false);
  };

  // Persist contrato — extracted so we can call it after duplicate dialog
  const persistContrato = async (data: ContratoFormData) => {
    setIsSaving(true);
    let contratoResult;
    if (editingContrato) {
      contratoResult = await updateContrato(editingContrato.id, data);
    } else {
      contratoResult = await createContrato(data);
    }

    if (contratoResult && !editingContrato && formData.recorrencia === 'unico' && parcelas.length > 0) {
      await createParcelas(contratoResult.id, parcelas);
    }

    setModalOpen(false);
    setIsSaving(false);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cliente_id || !formData.descricao || !formData.valor) return;

    if (formData.recorrencia !== 'unico' && !formData.dia_vencimento) {
      return;
    }

    const dataInativacao = formData.status !== 'ativo'
      ? (formData.data_inativacao || new Date().toISOString().split('T')[0])
      : undefined;

    const data: ContratoFormData = {
      cliente_id: formData.cliente_id,
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim || undefined,
      dia_vencimento: formData.recorrencia !== 'unico'
        ? parseInt(formData.dia_vencimento) || undefined
        : undefined,
      recorrencia: formData.recorrencia,
      status: formData.status,
      data_inativacao: dataInativacao,
    };

    // Duplicate detection — only on creation of active recurring/unique contracts
    if (!editingContrato && data.status === 'ativo') {
      const match = findPossibleDuplicate(
        { cliente_id: data.cliente_id, descricao: data.descricao, recorrencia: data.recorrencia, valor: data.valor },
        contratos
      );
      if (match) {
        setDuplicateMatch(match);
        setPendingSubmitData(data);
        return;
      }
    }

    await persistContrato(data);
  };

  // Confirm duplicate dialog actions
  const handleApplyAsAditivo = async () => {
    if (!duplicateMatch || !pendingSubmitData) return;
    setIsSaving(true);
    const ok = await createAditivo(
      duplicateMatch.contrato.id,
      Number(duplicateMatch.contrato.valor),
      {
        valor_novo: pendingSubmitData.valor,
        data_vigencia: pendingSubmitData.data_inicio,
        motivo: 'Reajuste de valor',
      }
    );
    if (ok) {
      await refetchContratos();
      setDuplicateMatch(null);
      setPendingSubmitData(null);
      setModalOpen(false);
    }
    setIsSaving(false);
  };

  const handleCreateAnyway = async () => {
    if (!pendingSubmitData) return;
    const data = pendingSubmitData;
    setDuplicateMatch(null);
    setPendingSubmitData(null);
    await persistContrato(data);
  };


  // Handle delete
  const handleDelete = async () => {
    if (!deletingId) return;
    
    setIsSaving(true);
    const success = await deleteContrato(deletingId);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus contratos e acordos</p>
          </div>
          <div className="flex gap-1.5">
            <IconButton label="Importar contrato (PDF)" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
            </IconButton>
            <IconButton label="Novo Contrato" emphasis="primary" onClick={handleNew}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="metric-card metric-card-positive">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">MRR Total</span>
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-primary tabular-nums">
              {formatCurrency(totals.mrrTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Receita recorrente mensal</p>
          </div>
          
          <div className="metric-card metric-card-info">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Contratos Ativos</span>
              <FileText className="h-4 w-4 text-info" />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{totals.ativos}</p>
            <p className="text-xs text-muted-foreground mt-1">contratos em vigor</p>
          </div>
          
          <div className="metric-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Valor Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {formatCurrency(totals.valorTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">soma dos contratos ativos</p>
          </div>
        </div>

        {/* Banner: existing duplicate active contracts */}
        {duplicateGroups.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {duplicateGroups.length === 1
                    ? '1 possível contrato duplicado'
                    : `${duplicateGroups.length} possíveis contratos duplicados`} inflando o MRR
                </p>
                <p className="text-xs text-muted-foreground">
                  Mescle para manter apenas um contrato vigente por serviço/cliente. Os demais serão encerrados.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {duplicateGroups.map((group, idx) => (
                <div
                  key={`${group.cliente_id}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border bg-background p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{group.cliente_nome}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {group.contratos.map(c => `${c.descricao} (${formatCurrency(Number(c.valor))})`).join(' • ')}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openMergeDialog(group)} className="shrink-0">
                    Resolver
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            type="search"
            placeholder="Buscar por descrição ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sm:w-80"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table / Mobile List */}
        {isMobile ? (
          <MobileContratosList
            contratos={filteredContratos as any}
            isLoading={isLoading}
            onEdit={(c: any) => handleEdit(c)}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onNew={handleNew}
          />
        ) : (
        <div className="metric-card overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : filteredContratos.length === 0 ? (
            <EmptyState
              emoji="📄"
              title="Nenhum contrato encontrado"
              description="Crie seu primeiro contrato para acompanhar seus acordos com clientes."
              action={
                <Button onClick={handleNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Contrato
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full min-w-[1200px] [&_th]:px-5 [&_td]:px-5">
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
                    <th className="min-w-[240px]">Cliente</th>
                    <th className="hidden md:table-cell min-w-[280px]">Descrição</th>
                    <th className="hidden sm:table-cell w-[130px]">Recorrência</th>
                    <th className="w-[140px] text-right">Valor</th>
                    <th className="hidden md:table-cell w-[120px]">Início</th>
                    <th className="w-[110px]">Status</th>
                    <th className="w-[100px] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContratos.map(contrato => (
                    <tr key={contrato.id} className={cn(
                      contrato.recorrencia === 'mensal' && 'bg-primary/5',
                      isSelected(contrato.id) && 'ring-2 ring-primary'
                    )}>
                      <td>
                        <Checkbox
                          checked={isSelected(contrato.id)}
                          onCheckedChange={() => toggleSelect(contrato.id)}
                          aria-label={`Selecionar ${contrato.descricao}`}
                        />
                      </td>
                      <td className="font-medium">{contrato.cliente?.nome || '-'}</td>
                      <td className="max-w-[200px] truncate hidden md:table-cell">{contrato.descricao}</td>
                      <td className="hidden sm:table-cell">
                        <StatusBadge status={contrato.recorrencia} />
                      </td>
                      <td className="tabular-nums text-right">
                        <span className="value-positive">{formatCurrency(Number(contrato.valor))}</span>
                      </td>
                      <td className="hidden md:table-cell">{formatDate(contrato.data_inicio)}</td>
                      <td>
                        <StatusBadge status={contrato.status} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(contrato)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingId(contrato.id); setDeleteDialogOpen(true); }}>
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
          <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingContrato ? 'Editar Contrato' : 'Novo Contrato'}
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
                    <SelectValue placeholder="Selecione" />
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

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição do contrato..."
                  rows={2}
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
                  <Label htmlFor="recorrencia">Recorrência</Label>
                  <Select
                    value={formData.recorrencia}
                    onValueChange={(value: typeof formData.recorrencia) => setFormData(prev => ({ ...prev, recorrencia: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORRENCIA_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional: Dia de Vencimento for recurring contracts */}
              {formData.recorrencia !== 'unico' && (
                <div className="space-y-2">
                  <Label htmlFor="dia_vencimento" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Dia de Vencimento *
                  </Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, dia_vencimento: e.target.value }))}
                    placeholder="Ex: 10"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Dia do mês para cobrança (1-31)
                  </p>
                </div>
              )}

              {/* Conditional: Parcelas for unique contracts */}
              {formData.recorrencia === 'unico' && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="num_parcelas" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Número de Parcelas
                    </Label>
                    <Input
                      id="num_parcelas"
                      type="number"
                      min="1"
                      max="60"
                      value={formData.num_parcelas}
                      onChange={(e) => setFormData(prev => ({ ...prev, num_parcelas: e.target.value }))}
                    />
                  </div>

                  {parcelas.length > 0 && (
                    <div className="space-y-2">
                      <Label>Parcelas</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left">#</th>
                              <th className="px-3 py-2 text-left">Vencimento</th>
                              <th className="px-3 py-2 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelas.map((parcela, index) => (
                              <tr key={index} className="border-t">
                                <td className="px-3 py-2 text-muted-foreground">
                                  {parcela.numero_parcela}/{parcelas.length}
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="date"
                                    value={parcela.data_vencimento}
                                    onChange={(e) => {
                                      const newParcelas = [...parcelas];
                                      newParcelas[index] = { ...newParcelas[index], data_vencimento: e.target.value };
                                      setParcelas(newParcelas);
                                    }}
                                    className="h-8 w-full"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={parcela.valor}
                                    onChange={(e) => {
                                      const newParcelas = [...parcelas];
                                      newParcelas[index] = { ...newParcelas[index], valor: parseFloat(e.target.value) || 0 };
                                      setParcelas(newParcelas);
                                    }}
                                    className="h-8 w-24 text-right"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted">
                            <tr className="border-t font-medium">
                              <td colSpan={2} className="px-3 py-2">Total</td>
                              <td className="px-3 py-2 text-right">
                                {formatCurrency(parcelas.reduce((sum, p) => sum + p.valor, 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data Início *"
                  value={formData.data_inicio}
                  onChange={(d) => setFormData(prev => ({ ...prev, data_inicio: d }))}
                  required
                />
                <DatePickerField
                  label="Data Fim"
                  value={formData.data_fim}
                  onChange={(d) => setFormData(prev => ({ ...prev, data_fim: d }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: typeof formData.status) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data de Inativação - only when status is not ativo */}
              {formData.status !== 'ativo' && (
                <div className="space-y-2">
                  <DatePickerField
                    label="Data de Inativação"
                    value={formData.data_inativacao}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_inativacao: d }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data efetiva de encerramento/cancelamento. Se não informada, será usada a data atual.
                  </p>
                </div>
              )}

              {editingContrato && (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <TrendingUp className="h-4 w-4" />
                      Histórico de Reajustes
                    </Label>
                    {!showAditivoForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextMonth = new Date();
                          nextMonth.setMonth(nextMonth.getMonth() + 1);
                          nextMonth.setDate(1);
                          setAditivoData({
                            valor_novo: '',
                            data_vigencia: nextMonth.toISOString().split('T')[0],
                            motivo: '',
                          });
                          setShowAditivoForm(true);
                        }}
                        className="gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Novo Reajuste
                      </Button>
                    )}
                  </div>

                  {showAditivoForm && (
                    <div className="space-y-3 border rounded-md p-3 bg-background">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Novo Reajuste</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAditivoForm(false)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Novo Valor *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={aditivoData.valor_novo}
                            onChange={(e) => setAditivoData(prev => ({ ...prev, valor_novo: e.target.value }))}
                            placeholder="0,00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vigência a partir de *</Label>
                          <DatePickerField
                            label=""
                            value={aditivoData.data_vigencia}
                            onChange={(d) => setAditivoData(prev => ({ ...prev, data_vigencia: d }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Motivo</Label>
                        <Input
                          value={aditivoData.motivo}
                          onChange={(e) => setAditivoData(prev => ({ ...prev, motivo: e.target.value }))}
                          placeholder="Ex: mais usuários + novo serviço"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveAditivo}
                        disabled={isSaving || !aditivoData.valor_novo || !aditivoData.data_vigencia}
                        className="w-full"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar Reajuste'}
                      </Button>
                    </div>
                  )}

                  {aditivosLoading ? (
                    <p className="text-xs text-muted-foreground">Carregando...</p>
                  ) : aditivos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum reajuste registrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {aditivos.map(aditivo => (
                        <div key={aditivo.id} className="flex items-center justify-between text-sm border rounded-md p-2 bg-background">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground line-through tabular-nums">
                                {formatCurrency(Number(aditivo.valor_anterior))}
                              </span>
                              <span className="text-foreground">→</span>
                              <span className="font-semibold text-primary tabular-nums">
                                {formatCurrency(Number(aditivo.valor_novo))}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>A partir de {formatDate(aditivo.data_vigencia)}</span>
                              {aditivo.motivo && <span>• {aditivo.motivo}</span>}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => deleteAditivo(aditivo.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
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
                    editingContrato ? 'Atualizar' : 'Criar'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Contrato"
          description="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={isSaving}
        />

        {/* Bulk Delete Confirmation */}
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title="Excluir Contratos"
          description={`Tem certeza que deseja excluir ${selectedIds.size} contratos? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir Todos"
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
        />

        {/* Contract Import Dialog */}
        <ContractImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={() => {
            // Refetch will happen automatically via React Query
          }}
        />

        {/* Duplicate contract detection dialog */}
        <Dialog
          open={!!duplicateMatch}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateMatch(null);
              setPendingSubmitData(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Contrato similar já existe</DialogTitle>
            </DialogHeader>
            {duplicateMatch && pendingSubmitData && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Encontramos um contrato ativo parecido para <strong>{duplicateMatch.contrato.cliente?.nome}</strong>:
                </p>
                <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
                  <div className="font-medium">{duplicateMatch.contrato.descricao}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Valor atual:</span>
                    <span className="tabular-nums">{formatCurrency(Number(duplicateMatch.contrato.valor))}</span>
                    {!duplicateMatch.sameValue && (
                      <>
                        <span>→</span>
                        <span className="font-semibold tabular-nums text-primary">
                          {formatCurrency(pendingSubmitData.valor)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {duplicateMatch.sameValue ? (
                  <p className="text-sm">
                    O valor é igual ao do contrato existente. Tem certeza que deseja criar um novo contrato?
                  </p>
                ) : (
                  <p className="text-sm">
                    Parece um <strong>reajuste de valor</strong>. Recomendamos registrar como Aditivo no contrato existente para preservar o histórico e não duplicar o MRR.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {!duplicateMatch.sameValue && (
                    <Button onClick={handleApplyAsAditivo} disabled={isSaving} className="w-full">
                      {isSaving ? 'Aplicando...' : 'Registrar como Aditivo (recomendado)'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleCreateAnyway} disabled={isSaving} className="w-full">
                    Criar novo contrato mesmo assim
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setDuplicateMatch(null); setPendingSubmitData(null); }}
                    disabled={isSaving}
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Merge duplicate contracts dialog */}
        <Dialog
          open={!!mergeGroup}
          onOpenChange={(open) => {
            if (!open) { setMergeGroup(null); setKeepContratoId(null); }
          }}
        >
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Mesclar contratos duplicados</DialogTitle>
            </DialogHeader>
            {mergeGroup && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Escolha qual contrato de <strong>{mergeGroup.cliente_nome}</strong> deve permanecer ativo. Os demais serão <strong>encerrados</strong> e seus lançamentos pendentes futuros serão removidos.
                </p>
                <div className="space-y-2">
                  {mergeGroup.contratos.map(c => (
                    <label
                      key={c.id}
                      className={cn(
                        'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                        keepContratoId === c.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                      )}
                    >
                      <input
                        type="radio"
                        name="keepContrato"
                        checked={keepContratoId === c.id}
                        onChange={() => setKeepContratoId(c.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{c.descricao}</div>
                        <div className="text-xs text-muted-foreground">
                          Início {formatDate(c.data_inicio)} • {formatCurrency(Number(c.valor))}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dica: mantenha o contrato com o valor mais atual. Se algum reajuste do encerrado fizer sentido como histórico, ele será anotado como aditivo.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { setMergeGroup(null); setKeepContratoId(null); }} disabled={isMerging}>
                    Cancelar
                  </Button>
                  <Button onClick={handleMergeDuplicates} disabled={isMerging || !keepContratoId}>
                    {isMerging ? 'Mesclando...' : 'Mesclar contratos'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

    </main>
  );
}

