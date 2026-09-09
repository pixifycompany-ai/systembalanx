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
import { Sheet, SheetContent } from '@/components/ui/sheet';
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
          <p className="text-xs text-foreground-muted mb-0.5 font-medium">Base</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Clientes</h1>
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
      <div className="flex flex-col gap-2 mb-4 md:mb-6">
        <Input
          type="search"
          placeholder="Buscar nome, email ou documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-full text-xs">
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
      <Sheet open={modalOpen} onOpenChange={setModalOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[520px] sm:mx-auto">
          <div className="pb-1">
            <div className="text-[11.5px] font-medium text-foreground-muted">Cadastro</div>
            <h2 className="mt-0.5 text-[22px] font-[670] tracking-[-0.02em] text-foreground">
              {editingCliente ? 'Editar cliente' : 'Novo cliente'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Loja Verano"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Marca (empresa-fonte)</Label>
              <Select
                value={formData.empresa_fonte || 'PIXIFY'}
                onValueChange={(v: EmpresaFonte) => setFormData((p) => ({ ...p, empresa_fonte: v }))}
              >
                <SelectTrigger>
                  {(() => {
                    const sel = EMPRESA_FONTE_OPTIONS.find(o => o.value === (formData.empresa_fonte || 'PIXIFY'));
                    return sel
                      ? <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(var(--brand-${sel.value.toLowerCase()}))` }} />{sel.label}</span>
                      : <SelectValue />;
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {EMPRESA_FONTE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(var(--brand-${o.value.toLowerCase()}))` }} />
                        {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {CLIENTE_TIPO_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, tipo: o.value as 'PF' | 'PJ' }))}
                    className={cn(
                      'no-touch-min rounded-xl border py-2.5 text-sm font-semibold transition-colors',
                      formData.tipo === o.value ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

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
              <Label>Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['ativo', 'inativo'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, status: s }))}
                    className={cn(
                      'no-touch-min rounded-xl border py-2.5 text-sm font-semibold capitalize transition-colors',
                      formData.status === s ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted',
                    )}
                  >
                    {s === 'ativo' ? 'Ativo' : 'Inativo'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contato@…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="(11) …"
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

            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="flex-[0_0_34%] rounded-[14px] bg-surface-2 py-3 text-[13px] font-semibold text-foreground">
                Cancelar
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13px] font-semibold text-white disabled:opacity-50">
                {isSaving ? 'Salvando…' : editingCliente ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

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
