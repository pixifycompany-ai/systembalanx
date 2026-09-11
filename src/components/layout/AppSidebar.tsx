import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  FileText,
  Tag,
  Wallet,
  LogOut,
  BarChart3,
  CalendarDays,
  FileBarChart,
  UserCircle,
  LineChart,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { href: '/', label: 'Início', icon: LayoutDashboard },
      { href: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: ArrowLeftRight },
      { href: '/visao', label: 'Visão', icon: LineChart },
      { href: '/calendario', label: 'Calendário', icon: CalendarDays },
      { href: '/analises', label: 'Análises', icon: BarChart3 },
      { href: '/relatorios', label: 'Relatórios', icon: FileBarChart },
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
      { href: '/contas', label: 'Contas', icon: Wallet },
      { href: '/categorias', label: 'Categorias', icon: Tag },
      { href: '/perfil', label: 'Meu Perfil', icon: UserCircle },
    ],
  },
];

// Estado ativo/hover no capricho AURO (azul), consistente em light e dark.
// `!` vence os defaults do shadcn (data-[active]:bg-sidebar-accent).
// Item ativo: pill com gradiente + borda interna + glow, barra de acento à
// esquerda (before:) e ícone/tipografia em primary.
// Layout no Tailwind; o visual do estado ATIVO (gradiente + glow + barra de
// acento) fica na classe .sb-nav-item do index.css (garante que aplica).
const itemClass =
  'sb-nav-item group/nav relative my-0.5 h-9 rounded-xl px-3 font-medium text-sidebar-foreground/85 transition-all duration-150 ' +
  'hover:bg-sidebar-accent/55 hover:text-foreground ' +
  '[&>a>svg]:h-[18px] [&>a>svg]:w-[18px] [&>a>svg]:transition-colors';

function planLabel(t: ReturnType<typeof useTenant>['activeTenant']): string {
  if (!t) return '';
  if (t.cortesia) return 'Cortesia';
  if (t.status_assinatura === 'ativa') return 'Plano ativo';
  if (t.status_assinatura === 'trial') return 'Em teste';
  if (t.status_assinatura === 'inadimplente') return 'Pagamento pendente';
  return t.status_assinatura || '';
}

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const { profile, avatarSignedUrl } = useProfile();
  const { activeTenant, isSuperadmin } = useTenant();
  const isCollapsed = state === 'collapsed';

  const nome = profile?.nome?.trim() || 'Minha conta';
  const inicial = (profile?.nome?.trim()?.[0] || 'B').toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <PixifyLogo size="sm" iconOnly={isCollapsed} />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="mb-1 h-auto px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={itemClass}>
                        <NavLink to={item.href} end>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isSuperadmin && (
          <SidebarGroup className="py-1.5">
            <SidebarGroupLabel className="mb-1 h-auto px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/45">
              Plataforma
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/superadmin'}
                    tooltip="Superadmin"
                    className={itemClass}
                  >
                    <NavLink to="/superadmin" end>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Superadmin</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-2">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <Link to="/perfil" aria-label="Meu perfil">
              <Avatar url={avatarSignedUrl} inicial={inicial} />
            </Link>
            <SidebarMenuButton tooltip="Sair" onClick={() => signOut()} className="h-8 w-8 justify-center p-0">
              <LogOut className="h-4 w-4" />
            </SidebarMenuButton>
          </div>
        ) : (
          <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 p-2.5">
            <Link to="/perfil" className="flex items-center gap-2.5 group">
              <Avatar url={avatarSignedUrl} inicial={inicial} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-sidebar-foreground group-hover:text-foreground">{nome}</div>
                {activeTenant && (
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] text-sidebar-foreground/60">{activeTenant.nome}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
                        activeTenant.cortesia || activeTenant.status_assinatura === 'ativa'
                          ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
                          : activeTenant.status_assinatura === 'inadimplente'
                          ? 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]'
                          : 'bg-primary/15 text-primary',
                      )}
                    >
                      {planLabel(activeTenant)}
                    </span>
                  </div>
                )}
              </div>
            </Link>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-sidebar-border/50 pt-2">
              <ThemeToggle />
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-sidebar-foreground/70 hover:bg-[hsl(var(--danger))]/10 hover:text-[hsl(var(--danger))]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function Avatar({ url, inicial }: { url: string | null; inicial: string }) {
  if (url) {
    return <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-[11px] object-cover ring-1 ring-sidebar-border" />;
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      style={{ background: 'linear-gradient(140deg, hsl(var(--primary)), hsl(212 87% 42%))' }}
    >
      {inicial}
    </div>
  );
}
