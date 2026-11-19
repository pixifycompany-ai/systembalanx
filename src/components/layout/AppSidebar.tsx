import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronsLeft, ChevronsRight, Eye, EyeOff, LogOut, Moon, Plus, Search, ShieldCheck, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTenant } from '@/contexts/TenantContext';
import { useProfile } from '@/hooks/useProfile';
import { usePendencias } from '@/hooks/usePendencias';
import { alternarValores, useValoresOcultos } from '@/lib/ocultarValores';
import { EmpresaSwitcher } from './EmpresaSwitcher';
import { NAV_GRUPOS, NAV_TOPO, ativo, type NavItem } from './navItems';

const CHAVE_RECOLHIDA = 'balanx.sidebar.recolhida';
const lerRecolhida = () => { try { return localStorage.getItem(CHAVE_RECOLHIDA) === '1'; } catch { return false; } };

function Item({ it, atual, recolhida, badge, onClick }: { it: NavItem; atual: boolean; recolhida: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={recolhida ? it.label : undefined}
      aria-label={recolhida ? it.label : undefined}
      aria-current={atual ? 'page' : undefined}
      className={cn('relative flex h-9 w-full items-center gap-3 rounded-xl text-[13.5px] transition-colors', recolhida ? 'justify-center px-0' : 'px-3',
        atual ? 'bg-foreground font-medium text-background' : 'text-foreground-muted hover:bg-surface-2 hover:text-foreground')}
    >
      <it.icon className="h-[18px] w-[18px] shrink-0" />
      {!recolhida && <span className="min-w-0 flex-1 truncate text-left">{it.label}</span>}
      {!!badge && (recolhida
        ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning-fg" />
        : <span className={cn('rounded-full px-1.5 py-px text-[10.5px] font-medium tabular-nums', atual ? 'bg-background/15 text-background' : 'bg-warning-bg text-warning-fg')}>{badge > 99 ? '99+' : badge}</span>)}
    </button>
  );
}

/** Menu lateral do desktop (o celular usa a barra de baixo). */
export function AppSidebar({ onBusca, onNovo }: { onBusca: () => void; onNovo: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSuperadmin } = useTenant();
  const { profile, avatarSignedUrl } = useProfile();
  const { total: totalPendencias } = usePendencias();
  const oculto = useValoresOcultos();
  const [recolhida, setRecolhida] = useState(lerRecolhida);
  const [usuario, setUsuario] = useState(false);

  useEffect(() => { try { localStorage.setItem(CHAVE_RECOLHIDA, recolhida ? '1' : '0'); } catch { /* sem storage */ } }, [recolhida]);
  useEffect(() => {
    if (!usuario) return;
    const f = () => setUsuario(false);
    window.addEventListener('click', f);
    return () => window.removeEventListener('click', f);
  }, [usuario]);

  const nome = profile?.nome?.trim() || 'Minha conta';
  const inicial = (profile?.nome?.trim()?.[0] || 'B').toUpperCase();
  const badgeDe = (href: string) => (href === '/pendencias' ? totalPendencias : undefined);
  const Sep = () => <div className="mx-auto mb-1.5 h-px w-6 bg-border" />;

  // O body tem overflow-x:hidden, então sticky não prende: a barra é fixed e um
  // espaçador do mesmo tamanho reserva o lugar dela no layout.
  return (
    <>
    <div aria-hidden className={cn('hidden shrink-0 transition-[width] duration-200 md:block', recolhida ? 'w-[76px]' : 'w-[264px]')} />
    <aside className={cn('fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col border-r border-border bg-surface/95 backdrop-blur transition-[width] duration-200 md:flex', recolhida ? 'w-[76px]' : 'w-[264px]')}>
      <div className={cn('flex items-center gap-2 px-4 pb-3 pt-4', recolhida && 'flex-col px-2')}>
        <PixifyLogo size="sm" iconOnly={recolhida} />
        <button type="button" onClick={() => setRecolhida((v) => !v)} aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'} title={recolhida ? 'Expandir' : 'Recolher'}
          className={cn('grid h-8 w-8 place-items-center rounded-lg text-foreground-muted hover:bg-surface-2 hover:text-foreground', !recolhida && 'ml-auto')}>
          {recolhida ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn('space-y-2 px-3', recolhida && 'px-2')}>
        <EmpresaSwitcher compacto={recolhida} />
        <div className={cn('flex gap-2', recolhida && 'flex-col')}>
          <button type="button" onClick={onBusca} title="Buscar ou perguntar (⌘K)" aria-label="Buscar"
            className={cn('flex h-10 items-center gap-2 rounded-full border border-border bg-surface text-[13px] text-foreground-muted hover:text-foreground', recolhida ? 'w-full justify-center' : 'min-w-0 flex-1 px-3.5')}>
            <Search className="h-4 w-4 shrink-0" />{!recolhida && <><span className="flex-1 truncate text-left">Buscar</span><kbd className="rounded-md border border-border px-1.5 text-[10.5px]">⌘K</kbd></>}
          </button>
          <button type="button" onClick={onNovo} title="Novo lançamento" aria-label="Novo lançamento"
            className={cn('flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground text-[13.5px] font-medium text-background hover:opacity-90', recolhida ? 'w-full' : 'px-4')}>
            <Plus className="h-4 w-4" />{!recolhida && 'Novo'}
          </button>
        </div>
      </div>

      <nav className={cn('mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3', recolhida && 'px-2')} aria-label="Menu principal">
        <div className="space-y-0.5">
          {NAV_TOPO.map((it) => <Item key={it.href} it={it} atual={ativo(pathname, it.href)} recolhida={recolhida} badge={badgeDe(it.href)} onClick={() => navigate(it.href)} />)}
        </div>
        {NAV_GRUPOS.map((g) => (
          <div key={g.label} className="space-y-0.5">
            {recolhida ? <Sep /> : <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-foreground-subtle">{g.label}</p>}
            {g.items.map((it) => <Item key={it.href} it={it} atual={ativo(pathname, it.href)} recolhida={recolhida} onClick={() => navigate(it.href)} />)}
          </div>
        ))}
        {isSuperadmin && (
          <div className="space-y-0.5">
            {recolhida ? <Sep /> : <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-foreground-subtle">Plataforma</p>}
            <Item it={{ href: '/superadmin', label: 'Superadmin', icon: ShieldCheck }} atual={ativo(pathname, '/superadmin')} recolhida={recolhida} onClick={() => navigate('/superadmin')} />
          </div>
        )}
      </nav>

      {/* usuário */}
      <div className={cn('relative border-t border-border p-3', recolhida && 'px-2')} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setUsuario((v) => !v)} aria-expanded={usuario} aria-label="Menu da conta"
          className={cn('flex w-full items-center gap-2.5 rounded-2xl p-1.5 text-left hover:bg-surface-2', recolhida && 'justify-center')}>
          {avatarSignedUrl
            ? <img src={avatarSignedUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border" />
            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-semibold text-foreground ring-1 ring-border">{inicial}</span>}
          {!recolhida && <><span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] text-foreground">{nome}</span><span className="block truncate text-[11.5px] text-foreground-muted">{user?.email}</span></span><ChevronDown className="h-4 w-4 text-foreground-muted" /></>}
        </button>
        {usuario && (
          <div className={cn('absolute bottom-full z-50 mb-2 rounded-2xl border border-border bg-surface p-1.5 shadow-xl', recolhida ? 'left-2 w-64' : 'left-3 right-3')}>
            <button type="button" onClick={() => { setUsuario(false); navigate('/perfil'); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><UserCircle className="h-4 w-4 text-foreground-muted" />Meu perfil</button>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-foreground hover:bg-surface-2"><Moon className="h-4 w-4 text-foreground-muted" /><span className="flex-1">Tema escuro</span><Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} aria-label="Tema escuro" /></label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-foreground hover:bg-surface-2">{oculto ? <EyeOff className="h-4 w-4 text-foreground-muted" /> : <Eye className="h-4 w-4 text-foreground-muted" />}<span className="flex-1">Ocultar valores</span><Switch checked={oculto} onCheckedChange={alternarValores} aria-label="Ocultar valores" /></label>
            <div className="my-1 h-px bg-border" />
            <button type="button" onClick={() => { setUsuario(false); void signOut(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-danger-fg hover:bg-danger-bg"><LogOut className="h-4 w-4" />Sair</button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
