import { useState, useMemo } from 'react';
import { useActionParam } from '@/hooks/useActionParam';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { ClienteCard } from '@/components/clientes/ClienteCard';
import { ClienteAvatar } from '@/components/clientes/ClienteAvatar';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { formatPhone, formatCPFCNPJ, maskCpfCnpj, onlyDigits } from '@/utils/formatters';
import { exportClientes } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useClientes, type ClienteFormData } from '@/hooks/useClientes';
import { Plus, Pencil, Trash2, LayoutGrid, List, Search, MoreHorizontal, Check } from 'lucide-react';
import { CLIENTE_TIPO_OPTIONS } from '@/types/finance';
import { cn } from '@/lib/utils';

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted';
const CHOICE_BASE = 'no-touch-min h-10 rounded-full border text-[13px] font-semibold transition-colors';
const CHOICE_ON = 'border-foreground bg-foreground text-background';
const CHOICE_OFF = 'border-border bg-surface text-foreground hover:border-border-strong';

/** Bloco de campos do formulário: label de seção em caixa alta + campos agrupados. */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className={cn(SECTION_LABEL, 'px-1')}>{title}</h3>
      <div className="space-y-3.5 rounded-[20px] border border-border p-4">{children}</div>
    </section>
  );
}

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
  useActionParam('novo', () => handleNew());
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
    canal_cobranca: 'whatsapp',
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

  const { selectedIds, selectedItems, isSelected, isAllSelected, toggleSelect, toggleSelectAll, clearSelection } = useMultiSelect({
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
      canal_cobranca: 'whatsapp',
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
      canal_cobranca: cliente.canal_cobranca || 'whatsapp',
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

  // Mobile: lista agrupada por status (mantém a ordem alfabética do hook dentro do grupo)
  const gruposMobile = [
    { key: 'ativo', label: 'Ativos', itens: filteredClientes.filter((c) => c.status === 'ativo') },
    { key: 'inativo', label: 'Inativos', itens: filteredClientes.filter((c) => c.status !== 'ativo') },
  ].filter((g) => g.itens.length > 0);

  const askDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  return (
    <main className="container py-4 md:py-6">
      <MobilePageHeader
        eyebrow="Gestão"
        title="Clientes"
        actions={
          <>
            {/* Alternância grade/lista (desktop) */}
            <div className="hidden h-10 items-center gap-1 rounded-full border border-border bg-surface p-1 md:inline-flex">
              <button
                type="button"
                aria-label="Visualização em grade"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={cn(
                  'no-touch-min grid h-8 w-8 place-items-center rounded-full transition-colors',
                  viewMode === 'grid' ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Visualização em lista"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={cn(
                  'no-touch-min grid h-8 w-8 place-items-center rounded-full transition-colors',
                  viewMode === 'list' ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={handleNew} aria-label="Novo Cliente">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo cliente</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </>
        }
      />

      {/* Busca + filtros em pílulas */}
      <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            type="search"
            placeholder="Buscar nome, email ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-full border-border bg-surface pl-10 pr-4"
          />
        </div>
        <ScrollPills className="md:flex-wrap md:justify-end">
          {([['all', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos']] as const).map(([v, l]) => (
            <Pill key={v} active={statusFilter === v} onClick={() => setStatusFilter(v)}>
              {l}
            </Pill>
          ))}
          <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 self-center bg-border" />
          <Pill active={empresaFilter === 'all'} onClick={() => setEmpresaFilter('all')}>
            Todas as marcas
          </Pill>
          {EMPRESA_FONTE_OPTIONS.map((o) => (
            <Pill key={o.value} active={empresaFilter === o.value} onClick={() => setEmpresaFilter(o.value)}>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: `hsl(var(--brand-${o.value.toLowerCase()}))` }}
              />
              {o.label}
            </Pill>
          ))}
        </ScrollPills>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <>
          <div className="space-y-2 md:hidden">
            <div className="h-3 w-20 rounded-full bg-surface-2" />
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 border-b border-border py-3 last:border-b-0">
                  <div className="h-10 w-10 rounded-[13px] bg-surface-2" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded-full bg-surface-2" />
                    <div className="h-2.5 w-1/3 rounded-full bg-surface-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-[20px] border border-border bg-surface" />
            ))}
          </div>
        </>
      ) : filteredClientes.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Adicione seu primeiro cliente para começar a gerenciar suas receitas."
            action={
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4" />
                Novo Cliente
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* MOBILE: lista agrupada por status */}
          <div className="space-y-4 md:hidden">
            {gruposMobile.map((g) => (
              <section key={g.key}>
                <div className="flex items-baseline justify-between px-0.5 pb-1.5 pt-1">
                  <span className={SECTION_LABEL}>{g.label}</span>
                  <span className="text-[12px] text-foreground-muted">
                    {g.itens.length} {g.itens.length === 1 ? 'cliente' : 'clientes'}
                  </span>
                </div>
                <div className="rounded-[20px] border border-border bg-surface px-3.5">
                  {g.itens.map((cliente) => {
                    const selected = isSelected(cliente.id);
                    return (
                      <div
                        key={cliente.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleEdit(cliente)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(cliente); }
                        }}
                        className="flex cursor-pointer items-center gap-3 border-b border-border py-3 last:border-b-0"
                      >
                        <button
                          type="button"
                          aria-label={`Selecionar ${cliente.nome}`}
                          aria-pressed={selected}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(cliente.id); }}
                          className="no-touch-min shrink-0 rounded-[13px]"
                        >
                          <ClienteAvatar nome={cliente.nome} selected={selected} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[14px] font-semibold text-foreground">{cliente.nome}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-foreground-muted">
                            {cliente.empresa_fonte ? `${cliente.empresa_fonte} · ` : ''}
                            {cliente.telefone
                              ? formatPhone(cliente.telefone)
                              : cliente.email || (cliente.tipo === 'PJ' ? 'Empresa' : 'Pessoa Física')}
                          </div>
                        </div>
                        <StatusBadge status={cliente.status} className="shrink-0" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Ações"
                              onClick={(e) => e.stopPropagation()}
                              className="no-touch-min -mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleEdit(cliente)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleSelect(cliente.id)}>
                              <Check className="mr-2 h-3.5 w-3.5" /> {selected ? 'Desmarcar' : 'Selecionar'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => askDelete(cliente.id)} className="text-danger-fg focus:text-danger-fg">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* DESKTOP */}
          <div className="hidden md:block">
            {viewMode === 'list' ? (
              <SectionCard
                flush
                title="Todos os clientes"
                description={`${filteredClientes.length} ${filteredClientes.length === 1 ? 'cliente' : 'clientes'}`}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 pl-6">
                        <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" />
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                      <TableHead className="w-24 pr-6 text-right">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow
                        key={cliente.id}
                        data-state={isSelected(cliente.id) ? 'selected' : undefined}
                        onClick={() => handleEdit(cliente)}
                        className="cursor-pointer border-b-0 border-t border-border"
                      >
                        <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected(cliente.id)}
                            onCheckedChange={() => toggleSelect(cliente.id)}
                            aria-label={`Selecionar ${cliente.nome}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <ClienteAvatar nome={cliente.nome} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{cliente.nome}</p>
                              <p className="truncate text-[12px] text-foreground-muted">
                                {cliente.tipo === 'PJ' ? 'Empresa' : 'Pessoa Física'}
                                {cliente.cpf_cnpj && <span className="tabular-nums"> · {formatCPFCNPJ(cliente.cpf_cnpj)}</span>}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0 text-[13px]">
                            <p className="max-w-[260px] truncate text-foreground">{cliente.email || '—'}</p>
                            {cliente.telefone && (
                              <p className="tabular-nums text-[12px] text-foreground-muted">{formatPhone(cliente.telefone)}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <EmpresaFonteBadge empresa={cliente.empresa_fonte} />
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status={cliente.status} />
                        </TableCell>
                        <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={() => handleEdit(cliente)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="danger-ghost" size="icon" className="h-8 w-8" aria-label="Excluir" onClick={() => askDelete(cliente.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            ) : (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredClientes.map((cliente) => (
                  <ClienteCard
                    key={cliente.id}
                    cliente={cliente}
                    isSelected={isSelected(cliente.id)}
                    onToggleSelect={() => toggleSelect(cliente.id)}
                    onEdit={() => handleEdit(cliente)}
                    onDelete={() => askDelete(cliente.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Sheet open={modalOpen} onOpenChange={setModalOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[520px] sm:mx-auto">
          <div className="pb-1">
            <div className="text-[13px] text-foreground-muted">Cadastro</div>
            <h2 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-foreground">
              {editingCliente ? 'Editar cliente' : 'Novo cliente'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <FormSection title="Identificação">
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
                <Label>Tipo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CLIENTE_TIPO_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, tipo: o.value as 'PF' | 'PJ' }))}
                      className={cn(CHOICE_BASE, formData.tipo === o.value ? CHOICE_ON : CHOICE_OFF)}
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
                  inputMode="numeric"
                  value={maskCpfCnpj(formData.cpf_cnpj || '', formData.tipo)}
                  onChange={(e) => setFormData((p) => ({ ...p, cpf_cnpj: onlyDigits(e.target.value).slice(0, p.tipo === 'PJ' ? 14 : 11) }))}
                  placeholder={formData.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={formData.tipo === 'PJ' ? 18 : 14}
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
                <Label>Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['ativo', 'inativo'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, status: s }))}
                      className={cn(CHOICE_BASE, formData.status === s ? CHOICE_ON : CHOICE_OFF)}
                    >
                      {s === 'ativo' ? 'Ativo' : 'Inativo'}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title="Contato">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-3">
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
            </FormSection>

            <FormSection title="Cobrança">
              <div className="space-y-2">
                <Label>Cobrança preferida por</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['ambos', 'Ambos']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setFormData((p) => ({ ...p, canal_cobranca: v }))}
                      className={cn(CHOICE_BASE, (formData.canal_cobranca || 'whatsapp') === v ? CHOICE_ON : CHOICE_OFF)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <div className="flex gap-2.5 pt-1">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" className="flex-[2]" disabled={isSaving}>
                {isSaving ? 'Salvando…' : editingCliente ? 'Atualizar' : 'Criar'}
              </Button>
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
