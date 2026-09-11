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
// `!` para vencer os defaults do shadcn (data-[active]:bg-sidebar-accent).
// Barra de acento à esquerda via before: aparece só no item ativo.
const itemClass =
  'group/nav relative h-9 rounded-lg font-normal text-sidebar-foreground/80 transition-all ' +
  'before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity ' +
  'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground ' +
  'data-[active=true]:!bg-primary/10 data-[active=true]:!text-primary data-[active=true]:font-semibold data-[active=true]:before:opacity-100 ' +
  '[&>a>svg]:transition-colors data-[active=true]:[&>a>svg]:text-primary';

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
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55">
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
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55">
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
    return <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border" />;
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
      style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.55))' }}
    >
      {inicial}
    </div>
  );
}
