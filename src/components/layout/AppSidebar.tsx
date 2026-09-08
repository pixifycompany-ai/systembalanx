import { useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import { useAuth } from '@/contexts/AuthContext';
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

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <PixifyLogo size="sm" iconOnly={isCollapsed} />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {navGroups.map((group, idx) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
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
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <SidebarMenuButton
            tooltip="Sair"
            onClick={() => signOut()}
            className="h-8 w-8 p-0 justify-center"
          >
            <LogOut className="h-4 w-4" />
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
