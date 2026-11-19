import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Bell, ChevronRight, EyeOff, Home, LogOut, Moon, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Sparkle } from '@/components/shared/Sparkle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePendencias } from '@/hooks/usePendencias';
import { alternarValores, useValoresOcultos } from '@/lib/ocultarValores';
import { EmpresaSwitcher } from './EmpresaSwitcher';
import { NovoLancamento } from './NovoLancamento';
import { NAV_GRUPOS, NAV_TODOS, ativo, type NavItem } from './navItems';

interface MobileBottomNavProps {
  /** Abre a busca rápida (a mesma do ⌘K). */
  onBusca: () => void;
}

// "+" adaptativo: nas telas de cadastro cria o item daquela tela; nas de finanças abre o seletor.
type FabAction = { kind: 'sheet' } | { kind: 'nav'; label: string; to: string };
function fabForPath(pathname: string): FabAction {
  if (pathname.startsWith('/contratos')) return { kind: 'nav', label: 'Novo contrato', to: '/contratos?action=novo' };
  if (pathname.startsWith('/cobrancas')) return { kind: 'nav', label: 'Nova cobrança', to: '/cobrancas?action=novo' };
  if (pathname.startsWith('/clientes')) return { kind: 'nav', label: 'Novo cliente', to: '/clientes?action=novo' };
  if (pathname.startsWith('/categorias')) return { kind: 'nav', label: 'Nova categoria', to: '/categorias?action=novo' };
  if (pathname.startsWith('/contas')) return { kind: 'nav', label: 'Nova conta', to: '/contas?action=novo' };
  return { kind: 'sheet' };
}

const BARRA = ['/', '/fluxo-caixa'] as const;
// Atalhos do topo do Menu (o que costuma pedir atenção)
const ATALHOS = ['/pendencias', '/calendario', '/cobrancas', '/contas', '/clientes', '/relatorios'];

function GradeIcone() {
  return <span className="grid h-[21px] w-[21px] grid-cols-2 gap-[3px] p-[2px]">{[0, 1, 2, 3].map((k) => <span key={k} className="rounded-[2px] border-[1.6px] border-current" />)}</span>;
}

export function MobileBottomNav({ onBusca }: MobileBottomNavProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isSuperadmin } = useTenant();
  const { signOut } = useAuth();
  const { total: totalPendencias } = usePendencias();
  const oculto = useValoresOcultos();
  const [menuOpen, setMenuOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);

  const fab = fabForPath(pathname);
  const handleFab = () => { if (fab.kind === 'nav') navigate(fab.to); else setNovoOpen(true); };
  const ir = (href: string) => { setMenuOpen(false); navigate(href); };
  const noMenu = !['/', '/iara'].includes(pathname) && !pathname.startsWith('/fluxo-caixa');
  const porHref = (h: string) => NAV_TODOS.find((x) => x.href === h)!;
  const badgeDe = (h: string) => (h === '/pendencias' && totalPendencias ? (totalPendencias > 99 ? '99+' : String(totalPendencias)) : null);

  const BotaoBarra = ({ rot, ativoAgora, onClick, children }: { rot: string; ativoAgora: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-label={rot} aria-current={ativoAgora ? 'page' : undefined}
      className={cn('flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] transition-colors', ativoAgora ? 'text-foreground' : 'text-foreground-muted')}>
      {children}
      <span className={cn(ativoAgora && 'font-medium')}>{rot}</span>
      <span className={cn('h-1 w-1 rounded-full', ativoAgora ? 'bg-foreground' : 'bg-transparent')} />
    </button>
  );

  return (
    <>
      <nav
        className="fixed left-1/2 z-50 flex w-[min(92%,390px)] -translate-x-1/2 items-center justify-between rounded-full border border-border bg-surface/90 p-1.5 shadow-[0_16px_36px_-16px_hsl(224_55%_10%/0.45)] backdrop-blur md:hidden"
        style={{ bottom: 'calc(0.9rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <BotaoBarra rot="Início" ativoAgora={ativo(pathname, BARRA[0])} onClick={() => navigate('/')}><Home className="h-[21px] w-[21px]" /></BotaoBarra>
        <BotaoBarra rot="Caixa" ativoAgora={ativo(pathname, BARRA[1])} onClick={() => navigate('/fluxo-caixa')}><ArrowLeftRight className="h-[21px] w-[21px]" /></BotaoBarra>
        <button type="button" onClick={handleFab} aria-label={fab.kind === 'nav' ? fab.label : 'Novo lançamento'}
          className="mx-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform active:scale-95">
          <Plus className="h-6 w-6" />
        </button>
        <BotaoBarra rot="IARA" ativoAgora={ativo(pathname, '/iara')} onClick={() => navigate('/iara')}><Sparkle className="h-[21px] w-[21px]" /></BotaoBarra>
        <BotaoBarra rot="Menu" ativoAgora={noMenu} onClick={() => setMenuOpen(true)}>
          <span className="relative"><GradeIcone />{totalPendencias > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger-fg ring-2 ring-surface" />}</span>
        </BotaoBarra>
      </nav>

      <NovoLancamento open={novoOpen} onOpenChange={setNovoOpen} />

      {/* Menu do celular (tela cheia) */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" showHandle={false} showClose={false} className="bottom-auto left-0 right-0 top-0 flex h-lvh w-auto max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom md:hidden">
          <div className="flex items-center justify-between px-5 pb-2 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
            <div>
              <p className="text-[12px] text-foreground-muted">Tudo do BALANX</p>
              <SheetTitle className="font-heading text-[32px] font-light leading-none tracking-[-0.04em] text-foreground">Menu</SheetTitle>
            </div>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border"><X className="h-5 w-5" /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-10 pt-2">
            <EmpresaSwitcher />
            <button type="button" onClick={() => { setMenuOpen(false); onBusca(); }} className="flex h-11 w-full items-center gap-2.5 rounded-full border border-border bg-surface px-4 text-[14px] text-foreground-muted">
              <Search className="h-4 w-4" />Buscar ou perguntar à IARA
            </button>

            <div className="grid grid-cols-3 gap-2">
              {ATALHOS.map((h) => {
                const it = porHref(h);
                const b = badgeDe(h);
                return (
                  <button key={h} type="button" onClick={() => ir(h)}
                    className={cn('relative flex flex-col items-start gap-2 rounded-[20px] border p-3 text-left', ativo(pathname, h) ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground')}>
                    <it.icon className="h-5 w-5" />
                    <span className="text-[12.5px] leading-tight">{it.label}</span>
                    {b && <span className="absolute right-2 top-2 rounded-full bg-warning-bg px-1.5 text-[10px] text-warning-fg">{b}</span>}
                  </button>
                );
              })}
            </div>

            {[...NAV_GRUPOS, ...(isSuperadmin ? [{ label: 'Plataforma', items: [{ href: '/superadmin', label: 'Superadmin', icon: ShieldCheck } as NavItem] }] : [])].map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">{g.label}</p>
                <div className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
                  {g.items.map((it) => (
                    <button key={it.href} type="button" onClick={() => ir(it.href)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                      <span className={cn('grid h-8 w-8 place-items-center rounded-full', ativo(pathname, it.href) ? 'bg-foreground text-background' : 'bg-surface-2 text-foreground-muted')}><it.icon className="h-4 w-4" /></span>
                      <span className="flex-1 text-[14.5px] text-foreground">{it.label}</span>
                      <ChevronRight className="h-4 w-4 text-foreground-subtle" />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Preferências</p>
              <div className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
                <label className="flex items-center gap-3 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-foreground-muted"><Moon className="h-4 w-4" /></span><span className="flex-1 text-[14.5px] text-foreground">Tema escuro</span><Switch aria-label="Tema escuro" checked={theme === 'dark'} onCheckedChange={toggleTheme} /></label>
                <label className="flex items-center gap-3 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-foreground-muted"><EyeOff className="h-4 w-4" /></span><span className="flex-1"><span className="block text-[14.5px] text-foreground">Ocultar valores</span><span className="block text-[12px] text-foreground-muted">Esconde os R$ ao abrir o app</span></span><Switch aria-label="Ocultar valores" checked={oculto} onCheckedChange={alternarValores} /></label>
                <button type="button" onClick={() => ir('/perfil')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left"><span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-foreground-muted"><Bell className="h-4 w-4" /></span><span className="flex-1 text-[14.5px] text-foreground">Notificações</span><ChevronRight className="h-4 w-4 text-foreground-subtle" /></button>
              </div>
            </div>

            <button type="button" onClick={() => { setMenuOpen(false); void signOut(); }} className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface text-[14px] text-danger-fg"><LogOut className="h-4 w-4" />Sair da conta</button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
