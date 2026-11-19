import type { Tenant } from '@/contexts/TenantContext';

export function iniciaisEmpresa(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'B';
}

export function statusPlano(t: Tenant | null, trialDias: number | null): { txt: string; cor: string } {
  if (!t) return { txt: '', cor: 'bg-foreground-muted' };
  if (t.cortesia) return { txt: 'Cortesia', cor: 'bg-success-fg' };
  if (t.status_assinatura === 'ativa') return { txt: 'Plano ativo', cor: 'bg-success-fg' };
  if (t.status_assinatura === 'trial') return { txt: trialDias != null ? `Em teste · ${trialDias} ${trialDias === 1 ? 'dia' : 'dias'}` : 'Em teste', cor: 'bg-info-fg' };
  if (t.status_assinatura === 'inadimplente') return { txt: 'Pagamento pendente', cor: 'bg-danger-fg' };
  return { txt: t.status_assinatura || '', cor: 'bg-foreground-muted' };
}

