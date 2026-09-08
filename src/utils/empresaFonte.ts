// Resolve a marca (empresa_fonte) de uma transação seguindo a ordem:
// 1. override manual no próprio lançamento
// 2. marca padrão da categoria vinculada
// 3. (fallback de compatibilidade) marca do cliente vinculado
// 4. null = "Geral" / sem marca
//
// Esta função é a fonte única de verdade — sempre use ela em widgets,
// filtros e relatórios segmentados por marca.

import type { EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';

export type EmpresaFonteResolved = EmpresaFonte | null;

interface TransactionLike {
  empresa_fonte?: EmpresaFonte | string | null;
  categoria?: { empresa_fonte?: EmpresaFonte | string | null } | null;
  cliente?: { empresa_fonte?: EmpresaFonte | string | null } | null;
}

const VALID = new Set<string>(['PIXIFY', 'REVVUE', 'CLARIO', 'TABELIO']);

const sanitize = (v: unknown): EmpresaFonteResolved => {
  if (typeof v !== 'string') return null;
  return VALID.has(v) ? (v as EmpresaFonte) : null;
};

export function resolveEmpresaFonte(tx: TransactionLike): EmpresaFonteResolved {
  return (
    sanitize(tx.empresa_fonte) ??
    sanitize(tx.categoria?.empresa_fonte) ??
    sanitize(tx.cliente?.empresa_fonte) ??
    null
  );
}
