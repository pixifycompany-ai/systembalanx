import type { ContratoDB } from '@/hooks/useContratos';

export function normalizeDescricao(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Palavras genéricas que NÃO devem servir como evidência de mesmo serviço.
const STOPWORDS = new Set([
  'DE','DA','DO','DOS','DAS','E','A','O','OS','AS','EM','PARA','POR','COM','SEM',
  'MENSALIDADE','MENSAL','ASSINATURA','CONTRATO','SERVICO','SERVICOS',
  'PLATAFORMA','PLANO','PACOTE','TAXA','VALOR','CLIENTE',
]);

export function significantTokens(s: string): string[] {
  return normalizeDescricao(s)
    .split(' ')
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

export function shareSignificantToken(a: string, b: string): boolean {
  const ta = new Set(significantTokens(a));
  if (ta.size === 0) return false;
  for (const t of significantTokens(b)) {
    if (ta.has(t)) return true;
  }
  return false;
}

/** Considera duplicado quando há boa similaridade textual OU compartilham token significativo. */
export function isLikelyDuplicatePair(a: string, b: string): boolean {
  const na = normalizeDescricao(a);
  const nb = normalizeDescricao(b);
  if (na === nb) return true;
  if (similarity(na, nb) >= 0.75) return true;
  return shareSignificantToken(a, b);
}

export interface DuplicateCandidate {
  cliente_id: string;
  descricao: string;
  recorrencia: string;
  valor: number;
}

export interface DuplicateMatch {
  contrato: ContratoDB;
  sameValue: boolean;
  similarity: number;
}

export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  contratos: ContratoDB[],
  excludeId?: string
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  const cNorm = normalizeDescricao(candidate.descricao);

  for (const c of contratos) {
    if (excludeId && c.id === excludeId) continue;
    if (c.cliente_id !== candidate.cliente_id) continue;
    if (c.status !== 'ativo') continue;
    if (c.recorrencia !== candidate.recorrencia) continue;

    if (!isLikelyDuplicatePair(c.descricao, candidate.descricao)) continue;

    const sim = similarity(normalizeDescricao(c.descricao), cNorm);
    if (!best || sim > best.similarity) {
      best = {
        contrato: c,
        sameValue: Math.abs(Number(c.valor) - candidate.valor) < 0.01,
        similarity: sim,
      };
    }
  }
  return best;
}

export interface DuplicateGroup {
  cliente_id: string;
  cliente_nome: string;
  recorrencia: string;
  contratos: ContratoDB[];
}

/** Agrupa contratos ativos que parecem ser o mesmo serviço (mesmo cliente + recorrência). */
export function findDuplicateGroups(contratos: ContratoDB[]): DuplicateGroup[] {
  const ativos = contratos.filter(c => c.status === 'ativo');
  const buckets = new Map<string, ContratoDB[]>();
  for (const c of ativos) {
    const key = `${c.cliente_id}|${c.recorrencia}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }

  const groups: DuplicateGroup[] = [];
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    // Union-find sobre o critério de similaridade/token.
    const parent = list.map((_, i) => i);
    const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (a: number, b: number) => { parent[find(a)] = find(b); };
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (isLikelyDuplicatePair(list[i].descricao, list[j].descricao)) {
          union(i, j);
        }
      }
    }
    const clusters = new Map<number, ContratoDB[]>();
    for (let i = 0; i < list.length; i++) {
      const root = find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(list[i]);
    }
    for (const cluster of clusters.values()) {
      if (cluster.length >= 2) {
        // Mais recente primeiro (provavelmente é o "vencedor" sugerido).
        cluster.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        groups.push({
          cliente_id: cluster[0].cliente_id,
          cliente_nome: cluster[0].cliente?.nome || '—',
          recorrencia: cluster[0].recorrencia,
          contratos: cluster,
        });
      }
    }
  }
  return groups;
}
