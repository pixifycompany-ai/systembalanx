// Pixify Company - Categorias API

import { supabase } from '@/integrations/supabase/client';
import type { EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';

export interface Categoria {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  is_padrao: boolean;
  user_id: string | null;
  empresa_fonte: EmpresaFonte | null;
  created_at: string;
}

export type CategoriaFormData = Pick<Categoria, 'nome' | 'tipo' | 'cor'> & {
  empresa_fonte?: EmpresaFonte | null;
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
  const { data, error } = await supabase
    .from('categorias')
    .update({
      nome: formData.nome,
      cor: formData.cor,
      empresa_fonte: formData.empresa_fonte ?? null,
    } as never)
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
