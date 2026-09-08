import { useState, useMemo } from 'react';
import { IconButton } from '@/components/shared/IconButton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { ClienteCard } from '@/components/clientes/ClienteCard';
import { EmpresaFonteBadge, EMPRESA_FONTE_OPTIONS, type EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';
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
import { formatPhone } from '@/utils/formatters';
import { exportClientes } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useClientes, type ClienteFormData } from '@/hooks/useClientes';
import { Plus, Pencil, Trash2, Building2, User, LayoutGrid, List } from 'lucide-react';
import { CLIENTE_TIPO_OPTIONS } from '@/types/finance';
import { cn } from '@/lib/utils';

export default function Clientes() {
  const {
    clientes,
    isLoading,
    createCliente,
    updateCliente,
    deleteCliente,
    deleteMultipleClientes,
  } = useClientes();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [empresaFilter, setEmpresaFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<{ id: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<ClienteFormData>({
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    tipo: 'PJ',
    endereco: '',
    status: 'ativo',
    empresa_fonte: 'PIXIFY',
  });

  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesEmpresa = empresaFilter === 'all' || c.empresa_fonte === empresaFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        c.nome.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.cpf_cnpj && c.cpf_cnpj.includes(term));
      return matchesStatus && matchesEmpresa && matchesSearch;
    });
  }, [clientes, statusFilter, empresaFilter, searchTerm]);

  const { selectedIds, selectedItems, isSelected, toggleSelect, clearSelection } = useMultiSelect({
    items: filteredClientes,
    getItemId: (item) => item.id,
  });

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = async () => {
    setIsSaving(true);
    const success = await deleteMultipleClientes(Array.from(selectedIds));
    if (success) {
      setBulkDeleteDialogOpen(false);
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleExport = () => {
    const dataToExport = selectedItems.map((c) => ({
      nome: c.nome,
      email: c.email || '',
      telefone: c.telefone || '',
      cpf_cnpj: c.cpf_cnpj || '',
      tipo: c.tipo,
      status: c.status,
    }));
    exportClientes(dataToExport);
  };

  const handleNew = () => {
    setEditingCliente(null);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      cpf_cnpj: '',
      tipo: 'PJ',
      endereco: '',
      status: 'ativo',
      empresa_fonte: 'PIXIFY',
    });
    setModalOpen(true);
  };

  const handleEdit = (cliente: typeof clientes[0]) => {
    setEditingCliente({ id: cliente.id });
    setFormData({
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      cpf_cnpj: cliente.cpf_cnpj || '',
      tipo: cliente.tipo,
      endereco: cliente.endereco || '',
      status: cliente.status,
      empresa_fonte: cliente.empresa_fonte || 'PIXIFY',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;
    setIsSaving(true);
    if (editingCliente) {
      await updateCliente(editingCliente.id, formData);
    } else {
      await createCliente(formData);
    }
    setModalOpen(false);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsSaving(true);
    const success = await deleteCliente(deletingId);
    if (success) setDeleteDialogOpen(false);
    setIsSaving(false);
    setDeletingId(null);
  };

  return (
    <main className="container py-3 md:py-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 mb-4 md:mb-6">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-semibold text-foreground">Clientes</h1>
          <p className="text-xs md:text-sm text-foreground-muted mt-0.5">Gerencie sua base de clientes</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <div className="hidden md:flex border border-border rounded-md">
            <IconButton label="Visualização em grade" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} className="rounded-r-none border-0" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="h-4 w-4" />
            </IconButton>
            <IconButton label="Visualização em lista" variant={viewMode === 'list' ? 'secondary' : 'ghost'} className="rounded-l-none border-0" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </IconButton>
          </div>
          <IconButton label="Novo Cliente" emphasis="primary" onClick={handleNew}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 md:mb-6">
        <Input
          type="search"
          placeholder="Buscar nome, email ou documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:w-72"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as marcas</SelectItem>
            {EMPRESA_FONTE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4 animate-pulse h-44" />
          ))}
        </div>
      ) : filteredClientes.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="Nenhum cliente encontrado"
          description="Adicione seu primeiro cliente para começar a gerenciar suas receitas."
          action={
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          }
        />
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="space-y-2">
          {filteredClientes.map((cliente) => (
            <div
              key={cliente.id}
              className={cn(
                'bg-surface border border-border rounded-lg p-3 flex items-center gap-3 hover:border-border-strong transition-colors',
                isSelected(cliente.id) && 'ring-2 ring-ring'
              )}
            >
              <Checkbox
                checked={isSelected(cliente.id)}
                onCheckedChange={() => toggleSelect(cliente.id)}
                aria-label={`Selecionar ${cliente.nome}`}
              />
              <div
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                  cliente.tipo === 'PJ' ? 'bg-info-bg text-info-fg' : 'bg-surface-2 text-foreground-muted'
                )}
              >
                {cliente.tipo === 'PJ' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{cliente.nome}</p>
                  <EmpresaFonteBadge empresa={cliente.empresa_fonte} />
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  {cliente.email && <span className="truncate">{cliente.email}</span>}
                  {cliente.email && cliente.telefone && <span>·</span>}
                  {cliente.telefone && <span className="font-mono">{formatPhone(cliente.telefone)}</span>}
                </div>
              </div>
              <StatusBadge status={cliente.status} />
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cliente)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setDeletingId(cliente.id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid View — modern cards */
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredClientes.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              isSelected={isSelected(cliente.id)}
              onToggleSelect={() => toggleSelect(cliente.id)}
              onEdit={() => handleEdit(cliente)}
              onDelete={() => {
                setDeletingId(cliente.id);
                setDeleteDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do cliente ou empresa"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Empresa-fonte *</Label>
                <Select
                  value={formData.empresa_fonte || 'PIXIFY'}
                  onValueChange={(v: EmpresaFonte) => setFormData((p) => ({ ...p, empresa_fonte: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPRESA_FONTE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: `hsl(var(--brand-${o.value.toLowerCase()}))` }}
                          />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v: 'PF' | 'PJ') => setFormData((p) => ({ ...p, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENTE_TIPO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">{formData.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
                <Input
                  id="cpf_cnpj"
                  value={formData.cpf_cnpj || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, cpf_cnpj: e.target.value.replace(/\D/g, '') }))}
                  placeholder={formData.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={formData.tipo === 'PJ' ? 14 : 11}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v: 'ativo' | 'inativo') => setFormData((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="(00) 00000-0000"
                  maxLength={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco || ''}
                onChange={(e) => setFormData((p) => ({ ...p, endereco: e.target.value }))}
                placeholder="Rua, número, cidade - estado"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Salvando...
                  </>
                ) : editingCliente ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isSaving}
      />

      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Excluir Clientes"
        description={`Tem certeza que deseja excluir ${selectedIds.size} clientes? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir Todos"
        variant="destructive"
        onConfirm={handleBulkDelete}
        isLoading={isSaving}
      />

      <MultiSelectBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteDialogOpen(true)}
        onExport={handleExport}
      />
    </main>
  );
}
