import { useState, useEffect } from 'react';
import { useActionParam } from '@/hooks/useActionParam';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EmpresaFonteBadge, EMPRESA_FONTE_OPTIONS, type EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';
import {
  fetchCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  CATEGORIA_CORES,
  GRUPO_DRE_RECEITA,
  GRUPO_DRE_DESPESA,
  grupoDreLabel,
  type Categoria,
  type CategoriaFormData,
  type GrupoDRE,
} from '@/api/categorias';

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receita' | 'despesa'>('receita');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  useActionParam('novo', () => handleNew());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CategoriaFormData>({
    nome: '',
    tipo: 'receita',
    cor: '#3B82F6',
    empresa_fonte: null,
    grupo_dre: null,
  });

  // Load categories
  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      setIsLoading(true);
      const data = await fetchCategorias();
      setCategorias(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao carregar categorias',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter by tab
  const filteredCategorias = categorias.filter(c => c.tipo === activeTab);

  // Open modal for new category
  const handleNew = () => {
    setEditingCategoria(null);
    setFormData({
      nome: '',
      tipo: activeTab,
      cor: '#3B82F6',
      empresa_fonte: null,
      grupo_dre: null,
    });
    setModalOpen(true);
  };

  // Open modal for editing — todas as categorias são editáveis
  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nome: categoria.nome,
      tipo: categoria.tipo,
      cor: categoria.cor,
      empresa_fonte: categoria.empresa_fonte ?? null,
      grupo_dre: categoria.grupo_dre ?? null,
    });
    setModalOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da categoria é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    
    try {
      if (editingCategoria) {
        const updated = await updateCategoria(editingCategoria.id, formData);
        setCategorias(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast({ title: 'Categoria atualizada com sucesso!' });
      } else {
        const created = await createCategoria(formData);
        setCategorias(prev => [...prev, created]);
        toast({ title: 'Categoria criada com sucesso!' });
      }
      
      setModalOpen(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar categoria',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete — todas as categorias podem ser excluídas
  const handleDelete = async () => {
    if (!deletingId) return;

    setIsSaving(true);
    try {
      await deleteCategoria(deletingId);
      setCategorias(prev => prev.filter(c => c.id !== deletingId));
      toast({ title: 'Categoria excluída com sucesso!' });
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir categoria',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setDeletingId(null);
    }
  };

  const askDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  return (
    <main className="container py-4 md:py-6">
        <MobilePageHeader
          eyebrow="Sistema"
          title="Categorias"
          actions={
            <Button onClick={handleNew} aria-label="Nova Categoria">
              <Plus className="h-4 w-4" />Nova categoria
            </Button>
          }
        />

        {/* Tabs segmentadas */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'receita' | 'despesa')}>
          <TabsList className="grid w-full grid-cols-2 md:inline-grid md:w-auto">
            <TabsTrigger value="receita" className="gap-1.5 md:px-6">
              <TrendingUp className="h-4 w-4" />
              Receitas
            </TabsTrigger>
            <TabsTrigger value="despesa" className="gap-1.5 md:px-6">
              <TrendingDown className="h-4 w-4" />
              Despesas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receita" className="mt-4 md:mt-6">
            <CategoriaLista
              tipo="receita"
              categorias={filteredCategorias}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={askDelete}
              onNew={handleNew}
            />
          </TabsContent>

          <TabsContent value="despesa" className="mt-4 md:mt-6">
            <CategoriaLista
              tipo="despesa"
              categorias={filteredCategorias}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={askDelete}
              onNew={handleNew}
            />
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <Sheet open={modalOpen} onOpenChange={setModalOpen}>
          <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[480px] sm:mx-auto">
            <div className="pb-1">
              <div className="text-[13px] text-foreground-muted">Cadastro</div>
              <h2 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-foreground">
                {editingCategoria ? 'Editar categoria' : 'Nova categoria'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 pt-4">
              <FormSection title="Identificação">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Consultoria"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['despesa', 'receita'] as const).map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        disabled={!!editingCategoria}
                        onClick={() => setFormData(prev => ({ ...prev, tipo: tp, grupo_dre: null }))}
                        className={cn(
                          'no-touch-min h-10 rounded-full border text-[13px] font-semibold transition-colors disabled:opacity-50',
                          formData.tipo === tp
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-surface text-foreground hover:border-border-strong',
                        )}
                      >
                        {tp === 'despesa' ? 'Despesa' : 'Receita'}
                      </button>
                    ))}
                  </div>
                </div>
              </FormSection>

              <FormSection title="Classificação">
                <div className="space-y-2">
                  <Label htmlFor="grupo_dre">Grupo no DRE</Label>
                  <Select
                    value={formData.grupo_dre ?? '_none'}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, grupo_dre: v === '_none' ? null : (v as GrupoDRE) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="A classificar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">A classificar</SelectItem>
                      {(formData.tipo === 'receita' ? GRUPO_DRE_RECEITA : GRUPO_DRE_DESPESA).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-foreground-muted">
                    Define em qual linha do DRE (Relatórios) esta categoria é somada. Distribuição de Lucros fica abaixo do resultado.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa_fonte">Marca</Label>
                  <Select
                    value={formData.empresa_fonte ?? '_geral'}
                    onValueChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        empresa_fonte: v === '_geral' ? null : (v as EmpresaFonte),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Geral (sem marca)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_geral">Geral (sem marca)</SelectItem>
                      {EMPRESA_FONTE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-foreground-muted">
                    Marca padrão herdada por receitas/despesas dessa categoria. Pode ser sobrescrita no lançamento.
                  </p>
                </div>
              </FormSection>

              <FormSection title="Aparência">
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIA_CORES.map(cor => (
                      <button
                        key={cor.value}
                        type="button"
                        aria-label={cor.label}
                        className={cn(
                          'no-touch-min h-9 w-9 rounded-full transition-transform',
                          formData.cor === cor.value
                            ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface'
                            : 'hover:scale-105'
                        )}
                        style={{ backgroundColor: cor.value }}
                        onClick={() => setFormData(prev => ({ ...prev, cor: cor.value }))}
                        title={cor.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2 border-t border-border pt-3.5">
                  <Label>Pré-visualização</Label>
                  <div className="flex items-center gap-3 rounded-[16px] border border-border bg-surface px-3 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: formData.cor }} />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
                      {formData.nome || 'Nome da categoria'}
                    </span>
                    <span className="truncate text-[12px] text-foreground-muted">{grupoDreLabel(formData.grupo_dre)}</span>
                  </div>
                </div>
              </FormSection>

              <div className="flex items-center gap-2.5 pt-1">
                {editingCategoria && (
                  <Button
                    type="button"
                    variant="danger-ghost"
                    size="lg"
                    className="px-4"
                    onClick={() => { setDeletingId(editingCategoria.id); setModalOpen(false); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                )}
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={isSaving} className="flex-[1.6]">
                  {isSaving ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Salvando...
                    </>
                  ) : (
                    editingCategoria ? 'Atualizar' : 'Criar'
                  )}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Categoria"
          description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="destructive"
          isLoading={isSaving}
          onConfirm={handleDelete}
        />
    </main>
  );
}

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted';

/** Bloco de campos do formulário: label de seção em caixa alta + campos agrupados. */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className={cn(SECTION_LABEL, 'px-1')}>{title}</h3>
      <div className="space-y-3.5 rounded-[20px] border border-border p-4">{children}</div>
    </section>
  );
}

// Lista de categorias agrupada por grupo do DRE (ordem do DRE; "A classificar" por último)
function CategoriaLista({
  tipo,
  categorias,
  isLoading,
  onEdit,
  onDelete,
  onNew,
}: {
  tipo: 'receita' | 'despesa';
  categorias: Categoria[];
  isLoading: boolean;
  onEdit: (categoria: Categoria) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid items-start gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-surface-2" />
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="flex animate-pulse items-center gap-3 border-b border-border py-3.5 last:border-b-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-surface-2" />
                  <div className="h-3 flex-1 rounded-full bg-surface-2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="rounded-[20px] border border-border bg-surface md:rounded-3xl">
        <EmptyState
          title="Nenhuma categoria encontrada"
          description="Crie sua primeira categoria personalizada."
          action={
            <Button onClick={onNew}>
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          }
        />
      </div>
    );
  }

  const opcoes = tipo === 'receita' ? GRUPO_DRE_RECEITA : GRUPO_DRE_DESPESA;
  type Grupo = { key: string; label: string; pendente?: boolean; itens: Categoria[] };
  const grupos: Grupo[] = opcoes
    .map((o): Grupo => ({ key: o.value, label: o.label, itens: categorias.filter((c) => c.grupo_dre === o.value) }))
    .concat([{
      key: '_none',
      label: 'A classificar',
      pendente: true,
      itens: categorias.filter((c) => !c.grupo_dre || !opcoes.some((o) => o.value === c.grupo_dre)),
    }])
    .filter((g) => g.itens.length > 0);

  return (
    <div className="grid items-start gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
      {grupos.map((g) => (
        <section key={g.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 px-0.5 pb-1.5 pt-1">
            <span className={cn(SECTION_LABEL, 'truncate', g.pendente && 'text-[hsl(var(--warning-fg))]')}>{g.label}</span>
            <span className="shrink-0 text-[12px] text-foreground-muted">
              {g.itens.length} {g.itens.length === 1 ? 'categoria' : 'categorias'}
            </span>
          </div>
          <div className="rounded-[20px] border border-border bg-surface px-3.5">
            {g.itens.map((categoria) => (
              <div
                key={categoria.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(categoria)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(categoria); }
                }}
                className="group flex cursor-pointer items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"
                  style={{ backgroundColor: `color-mix(in srgb, ${categoria.cor} 14%, transparent)` }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoria.cor }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-foreground">{categoria.nome}</span>
                    {categoria.empresa_fonte && <EmpresaFonteBadge empresa={categoria.empresa_fonte} className="shrink-0" />}
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 truncate text-[12px]',
                      categoria.grupo_dre ? 'text-foreground-muted' : 'font-medium text-[hsl(var(--warning-fg))]',
                    )}
                  >
                    DRE: {grupoDreLabel(categoria.grupo_dre)}{categoria.is_padrao ? ' · padrão' : ''}
                  </div>
                </div>
                <div className="-mr-1.5 flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label={`Editar ${categoria.nome}`}
                    onClick={() => onEdit(categoria)}
                    className="no-touch-min grid h-8 w-8 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir ${categoria.nome}`}
                    onClick={() => onDelete(categoria.id)}
                    className="no-touch-min grid h-8 w-8 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-danger-bg hover:text-[hsl(var(--danger-fg))]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
