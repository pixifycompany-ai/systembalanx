import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon, DocumentTextIcon, ChartBarIcon, Squares2X2Icon, PlusIcon,
  SparklesIcon, WalletIcon, CalendarDaysIcon, DocumentChartBarIcon, PresentationChartLineIcon,
  UsersIcon, TagIcon, Cog6ToothIcon, ChevronRightIcon, MoonIcon,
  ArrowsRightLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeSolid, DocumentTextIcon as DocumentSolid,
  ChartBarIcon as ChartSolid, Squares2X2Icon as GridSolid,
} from '@heroicons/react/24/solid';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';
import { useTenant } from '@/contexts/TenantContext';
import { ShieldCheckIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onNewEntrada: () => void;
  onNewSaida: () => void;
  onNewTransferencia: () => void;
}

const mainItems = [
  { href: '/', label: 'Início', icon: HomeIcon, iconSolid: HomeSolid },
  { href: '/fluxo-caixa', label: 'Lançamentos', icon: DocumentTextIcon, iconSolid: DocumentSolid },
  { href: '__fab__', label: '', icon: PlusIcon, iconSolid: PlusIcon },
  { href: '/visao', label: 'Visão', icon: ChartBarIcon, iconSolid: ChartSolid },
  { href: '__more__', label: 'Menu', icon: Squares2X2Icon, iconSolid: GridSolid },
];

const moreSections = [
  {
    label: 'Financeiro',
    items: [
      { href: '/iara', label: 'IARA · Assistente', icon: SparklesIcon },
      { href: '/contas', label: 'Contas', icon: WalletIcon },
      { href: '/calendario', label: 'Calendário', icon: CalendarDaysIcon },
      { href: '/relatorios', label: 'Relatórios', icon: DocumentChartBarIcon },
      { href: '/analises', label: 'Análises (deep-dive)', icon: PresentationChartLineIcon },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/clientes', label: 'Clientes', icon: UsersIcon },
      { href: '/contratos', label: 'Contratos', icon: DocumentTextIcon },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/categorias', label: 'Categorias', icon: TagIcon },
      { href: '/perfil', label: 'Meu Perfil', icon: Cog6ToothIcon },
    ],
  },
];

const allMoreHrefs = moreSections.flatMap(s => s.items.map(i => i.href));

export function MobileBottomNav({ onNewEntrada, onNewSaida, onNewTransferencia }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isSuperadmin } = useTenant();
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const handleNavClick = (href: string) => {
    if (href === '__more__') { setMoreOpen(true); return; }
    if (href === '__fab__') { setFabOpen(true); return; }
    navigate(href);
  };

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <>
      <nav
        className="fixed left-1/2 z-50 flex md:hidden items-center gap-1.5 px-2.5 py-2 rounded-[24px] border border-border/60 bg-card/70 backdrop-blur-2xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]"
        style={{ bottom: 'calc(0.9rem + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)' }}
      >
        {mainItems.map((item) => {
          if (item.href === '__fab__') {
            return (
              <button
                key="fab"
                onClick={() => setFabOpen(true)}
                aria-label="Novo lançamento"
                className="mx-0.5 flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.45)] active:scale-95 transition-transform"
              >
                <PlusIcon className="h-6 w-6" strokeWidth={2.4} />
              </button>
            );
          }

          const active = item.href === '__more__'
            ? allMoreHrefs.some(h => isActive(h))
            : isActive(item.href);
          const Icon = active ? item.iconSolid : item.icon;

          return (
            <button
              key={item.href}
              onClick={() => handleNavClick(item.href)}
              aria-label={item.label}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                active ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
            </button>
          );
        })}
      </nav>

      {/* FAB Action Sheet */}
      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader>
            <SheetTitle>Novo Lançamento</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <button
              onClick={() => { setFabOpen(false); navigate('/lancar-voz'); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors border border-primary/20"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                <MicrophoneIcon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Por voz</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); onNewEntrada(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-sm font-medium">Receita</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); onNewSaida(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-sm font-medium">Despesa</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); onNewTransferencia(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted-foreground/10">
                <ArrowsRightLeftIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Transferência</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* More Menu Sheet — grupos iOS (igual mockup: setgroup + setrow) */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" showHandle={false} className="h-[100dvh] rounded-none pb-safe pt-safe flex flex-col border-0">
          <SheetHeader className="shrink-0 text-left space-y-0">
            <span className="text-xs font-medium text-foreground-muted">Tudo do BALANX</span>
            <SheetTitle className="text-2xl font-semibold tracking-tight">Menu</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto pt-3 pb-6">
            {moreSections.map((section) => (
              <div key={section.label}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted mt-3.5 mb-2 px-0.5">
                  {section.label}
                </p>
                <div className="mb-3.5 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <button
                        key={item.href}
                        onClick={() => { setMoreOpen(false); navigate(item.href); }}
                        className="flex items-center gap-3 w-full px-4 py-3.5 text-left border-b border-border/50 last:border-b-0 transition-colors hover:bg-white/5"
                      >
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-foreground-muted')} />
                        <span className={cn('flex-1 text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>{item.label}</span>
                        <ChevronRightIcon className="h-4 w-4 text-foreground-muted/60 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Plataforma (só superadmin) */}
            {isSuperadmin && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted mt-3.5 mb-2 px-0.5">
                  Plataforma
                </p>
                <div className="mb-3.5 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl">
                  <button
                    onClick={() => { setMoreOpen(false); navigate('/superadmin'); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors hover:bg-white/5"
                  >
                    <ShieldCheckIcon className="h-[18px] w-[18px] shrink-0 text-primary" />
                    <span className="flex-1 text-sm font-medium text-foreground">Superadmin</span>
                    <ChevronRightIcon className="h-4 w-4 text-foreground-muted/60 shrink-0" />
                  </button>
                </div>
              </>
            )}

            {/* Sistema · preferências */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted mt-3.5 mb-2 px-0.5">
              Preferências
            </p>
            <div className="mb-3.5 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl">
              <div className="flex items-center gap-3 w-full px-4 py-3.5">
                <MoonIcon className="h-[18px] w-[18px] shrink-0 text-foreground-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Tema</div>
                  <div className="text-[11px] text-foreground-muted">{theme === 'dark' ? 'Escuro (AURO)' : 'Claro'}</div>
                </div>
                <Switch aria-label="Alternar tema" checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
