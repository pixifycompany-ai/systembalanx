import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon, DocumentTextIcon, ChartBarIcon, Squares2X2Icon, PlusIcon,
  WalletIcon, CalendarDaysIcon, DocumentChartBarIcon, PresentationChartLineIcon,
  UsersIcon, TagIcon, Cog6ToothIcon, ChevronRightIcon, MoonIcon,
  ChevronUpIcon, ChevronDownIcon, ArrowsUpDownIcon,
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
import { Sparkle } from '@/components/shared/Sparkle';
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
      { href: '/iara', label: 'IARA · Assistente', icon: Sparkle },
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

      {/* FAB Action Sheet — seletor "Novo lançamento" (igual mockup) */}
      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-[26px] border-t border-border/60 bg-surface/[0.78] backdrop-blur-2xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
          <SheetHeader className="text-left space-y-0 pb-3.5">
            <span className="text-[11px] font-medium text-foreground-muted">Adicionar</span>
            <SheetTitle className="text-[19px] font-[670] tracking-[-0.02em]">Novo lançamento</SheetTitle>
          </SheetHeader>

          <div className="flex gap-2.5">
            {[
              { label: 'Receita', icon: ChevronUpIcon, tint: 'bg-[hsl(var(--success)/0.24)] text-[hsl(var(--success))]', onClick: onNewEntrada },
              { label: 'Despesa', icon: ChevronDownIcon, tint: 'bg-[hsl(var(--danger)/0.24)] text-[hsl(var(--danger))]', onClick: onNewSaida },
              { label: 'Transferência', icon: ArrowsUpDownIcon, tint: 'bg-primary/25 text-[hsl(var(--primary))]', onClick: onNewTransferencia },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => { setFabOpen(false); t.onClick(); }}
                className="auro-card flex flex-1 flex-col items-center gap-2.5 rounded-2xl border border-border/60 bg-surface/55 px-2 py-4 backdrop-blur-xl transition-transform active:scale-[0.97]"
              >
                <span className={cn('grid h-11 w-11 place-items-center rounded-[14px]', t.tint)}>
                  <t.icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <span className="text-[12.5px] font-semibold text-foreground">{t.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setFabOpen(false); navigate('/lancar-voz'); }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/55 py-3 text-[13px] font-semibold text-foreground backdrop-blur-xl transition-transform active:scale-[0.99]"
          >
            <MicrophoneIcon className="h-4 w-4 text-primary" />
            Lançar por voz
          </button>
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
