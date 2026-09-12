import { useState, useEffect } from 'react';
import { IconButton } from '@/components/shared/IconButton';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Tag, TrendingUp, TrendingDown } from 'lucide-react';
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
  type Categoria,
  type CategoriaFormData,
} from '@/api/categorias';

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receita' | 'despesa'>('receita');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
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

  return (
    <main className="container py-4 md:py-6">
        {/* Page Header */}
        <MobilePageHeader
          eyebrow="Organização"
          title="Categorias"
          actions={
            <IconButton label="Nova Categoria" emphasis="primary" onClick={handleNew}>
              <Plus className="h-4 w-4" />
            </IconButton>
          }
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'receita' | 'despesa')}>
          <TabsList className="mb-6">
            <TabsTrigger value="receita" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Receitas
            </TabsTrigger>
            <TabsTrigger value="despesa" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Despesas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receita" className="mt-0">
            <CategoriaGrid
              categorias={filteredCategorias}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={(id) => {
                setDeletingId(id);
                setDeleteDialogOpen(true);
              }}
              onNew={handleNew}
            />
          </TabsContent>

          <TabsContent value="despesa" className="mt-0">
            <CategoriaGrid
              categorias={filteredCategorias}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={(id) => {
                setDeletingId(id);
                setDeleteDialogOpen(true);
              }}
              onNew={handleNew}
            />
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <Sheet open={modalOpen} onOpenChange={setModalOpen}>
          <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[480px] sm:mx-auto">
            <div className="pb-1">
              <div className="text-[11.5px] font-medium text-foreground-muted">Cadastro</div>
              <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
                {editingCategoria ? 'Editar categoria' : 'Nova categoria'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-3">
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
                      onClick={() => setFormData(prev => ({ ...prev, tipo: tp }))}
                      className={cn(
                        'no-touch-min rounded-xl border py-2.5 text-sm font-semibold capitalize transition-colors disabled:opacity-50',
                        formData.tipo === tp ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted',
                      )}
                    >
                      {tp === 'despesa' ? 'Despesa' : 'Receita'}
                    </button>
                  ))}
                </div>
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
                <p className="text-[11px] text-muted-foreground">
                  Marca padrão herdada por receitas/despesas dessa categoria. Pode ser sobrescrita no lançamento.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIA_CORES.map(cor => (
                    <button
                      key={cor.value}
                      type="button"
                      className={cn(
                        "h-10 w-10 rounded-[12px] transition-all",
                        formData.cor === cor.value
                          ? "ring-2 ring-white ring-offset-2 ring-offset-transparent scale-105"
                          : "hover:scale-105"
                      )}
                      style={{ backgroundColor: cor.value }}
                      onClick={() => setFormData(prev => ({ ...prev, cor: cor.value }))}
                      title={cor.label}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <div className="flex items-center gap-2">
                  <Badge 
                    className="text-white"
                    style={{ backgroundColor: formData.cor }}
                  >
                    {formData.nome || 'Nome da categoria'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                {editingCategoria && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                    onClick={() => { setDeletingId(editingCategoria.id); setModalOpen(false); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white">
                  {isSaving ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
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

// Category Grid Component
function CategoriaGrid({
  categorias,
  isLoading,
  onEdit,
  onDelete,
  onNew,
}: {
  categorias: Categoria[];
  isLoading: boolean;
  onEdit: (categoria: Categoria) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="h-6 w-24 bg-muted rounded mb-2" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <EmptyState
        title="Nenhuma categoria encontrada"
        description="Crie sua primeira categoria personalizada."
        action={
          <Button onClick={onNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Categoria
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {categorias.map(categoria => (
        <button
          key={categoria.id}
          onClick={() => onEdit(categoria)}
          className="text-left cursor-pointer rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl p-3.5 transition-colors hover:border-primary/40"
        >
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-foreground/5">
            <Tag className="h-[18px] w-[18px] text-foreground/75" />
          </div>
          <div className="mt-2.5 text-[13px] font-semibold text-foreground truncate">{categoria.nome}</div>
          <div className="mt-0.5 text-[11px] text-foreground-muted truncate">
            {categoria.tipo === 'receita' ? 'Receita' : 'Despesa'}{categoria.is_padrao ? ' · padrão' : ''}
          </div>
        </button>
      ))}
    </div>
  );
}
