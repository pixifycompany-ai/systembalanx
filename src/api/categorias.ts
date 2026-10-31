// Pixify Company - Categorias API

import { supabase } from '@/integrations/supabase/client';
import type { EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';

export type GrupoDRE =
  | 'rec_servico' | 'rec_outra'
  | 'imposto' | 'custo_variavel' | 'desp_comercial' | 'desp_administrativa'
  | 'desp_pessoal' | 'desp_operacional' | 'distribuicao_lucro';

export interface Categoria {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  is_padrao: boolean;
  user_id: string | null;
  empresa_fonte: EmpresaFonte | null;
  grupo_dre: GrupoDRE | null;
  created_at: string;
}

export type CategoriaFormData = Pick<Categoria, 'nome' | 'tipo' | 'cor'> & {
  empresa_fonte?: EmpresaFonte | null;
  grupo_dre?: GrupoDRE | null;
};

// Opções de grupo no DRE, separadas por tipo de categoria.
export const GRUPO_DRE_RECEITA: { value: GrupoDRE; label: string }[] = [
  { value: 'rec_servico', label: 'Prestação de Serviços' },
  { value: 'rec_outra', label: 'Outras Receitas' },
];
export const GRUPO_DRE_DESPESA: { value: GrupoDRE; label: string }[] = [
  { value: 'imposto', label: 'Deduções da Receita (Impostos)' },
  { value: 'custo_variavel', label: 'Custos Variáveis' },
  { value: 'desp_comercial', label: 'Despesas Comerciais / Marketing' },
  { value: 'desp_administrativa', label: 'Despesas Administrativas' },
  { value: 'desp_pessoal', label: 'Despesas com Pessoal' },
  { value: 'desp_operacional', label: 'Outras Despesas Operacionais' },
  { value: 'distribuicao_lucro', label: 'Distribuição de Lucros (abaixo da linha)' },
];
export const grupoDreLabel = (g: GrupoDRE | null | undefined): string => {
  if (!g) return 'A classificar';
  return [...GRUPO_DRE_RECEITA, ...GRUPO_DRE_DESPESA].find((o) => o.value === g)?.label ?? 'A classificar';
};

/**
 * Fetch all categories (default + user's own)
 */
export async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('is_padrao', { ascending: false })
    .order('nome', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Não foi possível carregar as categorias');
  }

  return (data || []) as Categoria[];
}

/**
 * Fetch categories by type
 */
export async function fetchCategoriasByTipo(tipo: 'receita' | 'despesa'): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('tipo', tipo)
    .order('is_padrao', { ascending: false })
    .order('nome', { ascending: true });

  if (error) {
    console.error('Error fetching categories by type:', error);
    throw new Error('Não foi possível carregar as categorias');
  }

  return (data || []) as Categoria[];
}

/**
 * Create a new category
 */
export async function createCategoria(formData: CategoriaFormData): Promise<Categoria> {
  const { data: userData } = await supabase.auth.getUser();
  
  if (!userData.user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('categorias')
    .insert({
      nome: formData.nome,
      tipo: formData.tipo,
      cor: formData.cor,
      is_padrao: false,
      user_id: userData.user.id,
      empresa_fonte: formData.empresa_fonte ?? null,
      grupo_dre: formData.grupo_dre ?? null,
    } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    throw new Error('Não foi possível criar a categoria');
  }

  return data as Categoria;
}

/**
 * Update a category
 */
export async function updateCategoria(id: string, formData: Partial<CategoriaFormData>): Promise<Categoria> {
  // Monta o payload só com os campos enviados, pra não apagar o que não veio.
  const payload: Record<string, unknown> = {};
  if (formData.nome !== undefined) payload.nome = formData.nome;
  if (formData.cor !== undefined) payload.cor = formData.cor;
  if (formData.empresa_fonte !== undefined) payload.empresa_fonte = formData.empresa_fonte ?? null;
  if (formData.grupo_dre !== undefined) payload.grupo_dre = formData.grupo_dre ?? null;

  const { data, error } = await supabase
    .from('categorias')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    throw new Error('Não foi possível atualizar a categoria');
  }

  return data as Categoria;
}

/**
 * Delete a category
 */
export async function deleteCategoria(id: string): Promise<void> {
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting category:', error);
    throw new Error('Não foi possível excluir a categoria');
  }
}

// Color options for category badge
export const CATEGORIA_CORES = [
  { value: '#10B981', label: 'Verde' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#F97316', label: 'Laranja' },
  { value: '#F59E0B', label: 'Amarelo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#6B7280', label: 'Cinza' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#06B6D4', label: 'Ciano' },
];
