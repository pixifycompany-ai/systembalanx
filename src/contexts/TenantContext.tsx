import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// A tabela nova ainda não está nos tipos gerados — usamos um client "solto" p/ ela.
const sb = supabase as any;

export type TenantTipo = 'pessoal' | 'agencia';
export type Papel = 'owner' | 'admin' | 'financeiro' | 'membro';

export interface Tenant {
  id: string;
  nome: string;
  tipo: TenantTipo;
  plano: string;
  status_assinatura: string;
  cortesia: boolean;
  acesso_liberado_ate: string | null;
  asaas_customer_id: string | null;
  created_at: string;
}

export interface Membership {
  tenant_id: string;
  papel: Papel;
  tenant: Tenant;
}

interface TenantContextType {
  memberships: Membership[];
  activeTenant: Tenant | null;
  role: Papel | null;
  isSuperadmin: boolean;
  canWrite: boolean;
  loading: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setActiveId(null);
      setIsSuperadmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: mems }, { data: superadmin }, { data: profile }] = await Promise.all([
        sb.from('tenant_members').select('tenant_id, papel, tenant:tenants(*)').eq('user_id', user.id),
        sb.rpc('is_platform_admin'),
        sb.from('profiles').select('current_tenant_id').eq('user_id', user.id).maybeSingle(),
      ]);
      const list: Membership[] = (mems || []).filter((m: any) => m.tenant);
      setMemberships(list);
      setIsSuperadmin(Boolean(superadmin));
      const current = profile?.current_tenant_id as string | undefined;
      const active = list.find((m) => m.tenant_id === current) || list[0] || null;
      setActiveId(active?.tenant_id ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!user) return;
    setActiveId(tenantId);
    await sb.from('profiles').update({ current_tenant_id: tenantId }).eq('user_id', user.id);
  }, [user]);

  const activeMembership = memberships.find((m) => m.tenant_id === activeId) || null;
  const role = activeMembership?.papel ?? null;
  const canWrite = role === 'owner' || role === 'admin' || role === 'financeiro' || isSuperadmin;

  return (
    <TenantContext.Provider
      value={{
        memberships,
        activeTenant: activeMembership?.tenant ?? null,
        role,
        isSuperadmin,
        canWrite,
        loading,
        switchTenant,
        refresh: load,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}
