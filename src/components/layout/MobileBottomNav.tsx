import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, Plus, LineChart, MoreHorizontal, Users, FileText, Tag, Settings, ArrowLeftRight, TrendingUp, TrendingDown, CalendarDays, FileBarChart, Wallet, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onNewEntrada: () => void;
  onNewSaida: () => void;
  onNewTransferencia: () => void;
}

const mainItems = [
  { href: '/', label: 'Início', icon: LayoutDashboard },
  { href: '/fluxo-caixa', label: 'Lançamentos', icon: List },
  { href: '__fab__', label: '', icon: Plus },
  { href: '/visao', label: 'Visão', icon: LineChart },
  { href: '__more__', label: 'Menu', icon: MoreHorizontal },
];

const moreSections = [
  {
    label: 'Financeiro',
    items: [
      { href: '/contas', label: 'Contas', icon: Wallet },
      { href: '/calendario', label: 'Calendário', icon: CalendarDays },
      { href: '/relatorios', label: 'Relatórios', icon: FileBarChart },
      { href: '/analises', label: 'Análises (deep-dive)', icon: BarChart3 },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/contratos', label: 'Contratos', icon: FileText },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/categorias', label: 'Categorias', icon: Tag },
      { href: '/perfil', label: 'Meu Perfil', icon: Settings },
    ],
  },
];

const allMoreHrefs = moreSections.flatMap(s => s.items.map(i => i.href));

export function MobileBottomNav({ onNewEntrada, onNewSaida, onNewTransferencia }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-end justify-around border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
        {mainItems.map((item) => {
          if (item.href === '__fab__') {
            return (
              <button
                key="fab"
                onClick={() => setFabOpen(true)}
                aria-label="Novo lançamento"
                className="relative -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
              >
                <Plus className="h-5 w-5" />
              </button>
            );
          }

          const active = item.href === '__more__'
            ? allMoreHrefs.some(h => isActive(h))
            : isActive(item.href);

          return (
            <button
              key={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 px-1 min-w-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && <div className="h-0.5 w-4 rounded-full bg-primary" />}
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
          <div className="grid grid-cols-3 gap-3 py-4">
            <button
              onClick={() => { setFabOpen(false); onNewEntrada(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-sm font-medium">Receita</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); onNewSaida(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-sm font-medium">Despesa</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); onNewTransferencia(); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted-foreground/10">
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Transferência</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* More Menu Sheet — full-height vertical list */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-[100dvh] rounded-none pb-safe pt-safe flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {moreSections.map((section) => (
              <div key={section.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {section.label}
                </p>
                <div className="flex flex-col gap-2">
                  {section.items.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => { setMoreOpen(false); navigate(item.href); }}
                      className={cn(
                        "flex items-center gap-3 w-full p-4 rounded-xl transition-colors text-left",
                        isActive(item.href) ? "bg-primary/10 text-primary" : "bg-secondary hover:bg-accent text-foreground"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60 shrink-0">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
