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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Tag, TrendingUp, TrendingDown } from 'lucide-react';
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Categorias</h1>
            <p className="text-sm text-muted-foreground">Gerencie as categorias de receitas e despesas</p>
          </div>
          <IconButton label="Nova Categoria" emphasis="primary" onClick={handleNew}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>

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
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Consultoria"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: 'receita' | 'despesa') => 
                    setFormData(prev => ({ ...prev, tipo: value }))
                  }
                  disabled={!!editingCategoria}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Receita
                      </div>
                    </SelectItem>
                    <SelectItem value="despesa">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Despesa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                        "w-8 h-8 rounded-full border-2 transition-all",
                        formData.cor === cor.value 
                          ? "border-foreground scale-110" 
                          : "border-transparent hover:scale-105"
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
                    editingCategoria ? 'Atualizar' : 'Criar'
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
        emoji="🏷️"
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
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categorias.map(categoria => (
        <div 
          key={categoria.id} 
          className="metric-card group hover:border-primary/30 transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${categoria.cor}20` }}
              >
                <Tag className="h-5 w-5" style={{ color: categoria.cor }} />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{categoria.nome}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {categoria.tipo === 'receita' ? 'Receita' : 'Despesa'}
                  </p>
                  {categoria.empresa_fonte ? (
                    <EmpresaFonteBadge empresa={categoria.empresa_fonte} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">· Geral</span>
                  )}
                </div>
              </div>
            </div>
            {categoria.is_padrao && (
              <Badge variant="secondary" className="gap-1 text-xs">
                Padrão
              </Badge>
            )}
          </div>

          {/* Color Preview */}
          <div className="mb-4">
            <Badge 
              className="text-white"
              style={{ backgroundColor: categoria.cor }}
            >
              {categoria.nome}
            </Badge>
          </div>

          {/* Actions — todas categorias editáveis */}
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(categoria)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(categoria.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
