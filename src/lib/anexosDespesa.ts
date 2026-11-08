import { supabase } from '@/integrations/supabase/client';

/** Boleto, nota etc. anexado a uma despesa a pagar. Some sozinho quando a despesa é paga. */
export interface AnexoDespesa { path: string; nome: string; tipo?: string }

export const MAX_ANEXOS_DESPESA = 5;
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024;
export const ANEXO_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const BUCKET = 'anexos-despesas';

// despesas.anexos e anexos_lixeira ainda não estão nos tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function anexosDe(d: { anexos?: unknown } | null | undefined): AnexoDespesa[] {
  const arr = Array.isArray(d?.anexos) ? (d!.anexos as AnexoDespesa[]) : [];
  return arr.filter((a) => a?.path);
}

async function lerDespesa(id: string) {
  const { data, error } = await db.from('despesas').select('tenant_id, anexos').eq('id', id).single();
  if (error) throw error;
  return { tenantId: data.tenant_id as string, anexos: anexosDe(data) };
}

/** Sobe os arquivos e grava na despesa. Devolve a lista final (ou lança erro). */
export async function anexarArquivos(despesaId: string, files: File[]): Promise<{ anexos: AnexoDespesa[]; ignorados: number }> {
  const { tenantId, anexos } = await lerDespesa(despesaId);
  if (!tenantId) throw new Error('Despesa sem conta vinculada.');
  const tiposOk = ANEXO_ACCEPT.split(',');
  for (const f of files) {
    if (f.type && !tiposOk.includes(f.type)) throw new Error(`"${f.name}": envie PDF ou imagem.`);
    if (f.size > ANEXO_MAX_BYTES) throw new Error(`"${f.name}" passa de 10 MB.`);
  }
  const livres = MAX_ANEXOS_DESPESA - anexos.length;
  if (livres <= 0) throw new Error(`Limite de ${MAX_ANEXOS_DESPESA} anexos por despesa.`);
  const lote = files.slice(0, livres);
  const novos: AnexoDespesa[] = [];
  try {
    for (const [i, f] of lote.entries()) {
      const ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
      const path = `${tenantId}/${despesaId}/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
      if (error) throw error;
      novos.push({ path, nome: f.name, tipo: f.type || undefined });
    }
    const final = [...anexos, ...novos];
    const { error } = await db.from('despesas').update({ anexos: final }).eq('id', despesaId);
    if (error) throw error;
    return { anexos: final, ignorados: files.length - lote.length };
  } catch (e) {
    if (novos.length) await supabase.storage.from(BUCKET).remove(novos.map((n) => n.path));
    throw e;
  }
}

export async function removerAnexo(despesaId: string, path: string): Promise<AnexoDespesa[]> {
  const { anexos } = await lerDespesa(despesaId);
  const final = anexos.filter((a) => a.path !== path);
  const { error } = await db.from('despesas').update({ anexos: final }).eq('id', despesaId);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([path]);
  return final;
}

export async function urlAnexo(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl || null;
}

/**
 * Apaga do Storage os anexos de despesas já pagas/excluídas (a fila é preenchida
 * por trigger no banco). Best-effort: se falhar, tenta de novo na próxima carga.
 */
export async function limparLixeiraAnexos() {
  try {
    const { data } = await db.from('anexos_lixeira').select('id, path').limit(200);
    if (!data?.length) return;
    const { error } = await supabase.storage.from(BUCKET).remove(data.map((r: { path: string }) => r.path));
    if (error) return;
    await db.from('anexos_lixeira').delete().in('id', data.map((r: { id: string }) => r.id));
  } catch { /* tenta de novo na próxima carga */ }
}
