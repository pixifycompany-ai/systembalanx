import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { iniciaisEmpresa, statusPlano } from './empresaInfo';

const GRADIENTES = ['from-blue-600 to-indigo-700', 'from-amber-500 to-orange-600', 'from-emerald-500 to-teal-600', 'from-fuchsia-500 to-purple-600'];

function Avatar({ nome, idx, className }: { nome: string; idx: number; className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-[11px] bg-gradient-to-br font-semibold text-white', GRADIENTES[idx % GRADIENTES.length], className)}>
      {iniciaisEmpresa(nome)}
    </span>
  );
}

/** Empresa ativa + troca entre as empresas da conta (memberships). */
export function EmpresaSwitcher({ compacto }: { compacto?: boolean }) {
  const { memberships, activeTenant, trialDias, switchTenant } = useTenant();
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const f = () => setAberto(false);
    window.addEventListener('click', f);
    return () => window.removeEventListener('click', f);
  }, [aberto]);
  if (!activeTenant) return null;
  const idxAtivo = Math.max(0, memberships.findIndex((m) => m.tenant_id === activeTenant.id));
  const st = statusPlano(activeTenant, trialDias);
  const varias = memberships.length > 1;

  const conteudo = (
    <>
      <Avatar nome={activeTenant.nome} idx={idxAtivo} className="h-9 w-9 text-[12.5px]" />
      {!compacto && (<>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-foreground">{activeTenant.nome}</span>
          {st.txt && <span className="flex items-center gap-1 text-[11.5px] text-foreground-muted"><span className={cn('h-1.5 w-1.5 rounded-full', st.cor)} />{st.txt}</span>}
        </span>
        {varias && <ChevronDown className="h-4 w-4 text-foreground-muted" />}
      </>)}
    </>
  );
  const cls = cn('flex w-full items-center gap-2.5 rounded-2xl text-left transition-colors hover:bg-surface-2', compacto ? 'justify-center p-1' : 'border border-border bg-surface p-2');

  if (!varias) {
    return <Link to="/perfil" title={activeTenant.nome} className={cls}>{conteudo}</Link>;
  }
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setAberto((v) => !v)} title="Trocar de empresa" aria-expanded={aberto} className={cls}>{conteudo}</button>
      {aberto && (
        <div className={cn('absolute z-50 rounded-2xl border border-border bg-surface p-1.5 shadow-xl', compacto ? 'left-full top-0 ml-2 w-64' : 'left-0 right-0 top-full mt-1.5')}>
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Suas empresas</p>
          {memberships.map((m, k) => {
            const s = statusPlano(m.tenant, null);
            const atual = m.tenant_id === activeTenant.id;
            return (
              <button key={m.tenant_id} type="button" onClick={() => { setAberto(false); if (!atual) void switchTenant(m.tenant_id); }} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2">
                <Avatar nome={m.tenant.nome} idx={k} className="h-8 w-8 text-[11.5px]" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] text-foreground">{m.tenant.nome}</span><span className="block text-[11.5px] text-foreground-muted">{s.txt}</span></span>
                {atual && <Check className="h-4 w-4 text-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
