// Itens do menu (sidebar, menu do celular, busca rápida e breadcrumb) num lugar só.
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, BarChart3, CalendarDays, FileBarChart, FileText, FolderOpen, Home, LineChart,
  ListChecks, Mic, Receipt, Settings, Tag, Upload, Users, Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Sparkle } from '@/components/shared/Sparkle';

export type NavIcon = ComponentType<{ className?: string }>;
export interface NavItem { href: string; label: string; icon: NavIcon }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_TOPO: NavItem[] = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/iara', label: 'IARA', icon: Sparkle },
  { href: '/pendencias', label: 'Pendências', icon: ListChecks },
];

export const NAV_GRUPOS: NavGroup[] = [
  { label: 'Dinheiro', items: [
    { href: '/fluxo-caixa', label: 'Fluxo de caixa', icon: ArrowLeftRight },
    { href: '/calendario', label: 'Calendário', icon: CalendarDays },
    { href: '/contas', label: 'Contas e cartões', icon: Wallet },
  ] },
  { label: 'Clientes', items: [
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/contratos', label: 'Contratos', icon: FileText },
    { href: '/cobrancas', label: 'Cobranças', icon: Receipt },
    { href: '/documentos', label: 'Documentos', icon: FolderOpen },
  ] },
  { label: 'Análise', items: [
    { href: '/visao', label: 'Visão do negócio', icon: LineChart },
    { href: '/analises', label: 'Análises', icon: BarChart3 },
    { href: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  ] },
  { label: 'Ajustes', items: [
    { href: '/categorias', label: 'Categorias', icon: Tag },
    { href: '/perfil', label: 'Meu perfil e empresa', icon: Settings },
  ] },
];

export const NAV_TODOS: NavItem[] = [...NAV_TOPO, ...NAV_GRUPOS.flatMap((g) => g.items)];

/** Grupo e nome da tela para o breadcrumb do topo. */
export function rotaInfo(pathname: string): { grupo: string; label: string } | null {
  if (pathname === '/') return null;
  if (pathname.startsWith('/superadmin')) return { grupo: 'Plataforma', label: 'Superadmin' };
  if (pathname.startsWith('/lancar-voz')) return { grupo: 'Dinheiro', label: 'Lançar por voz' };
  if (pathname.startsWith('/assinatura')) return { grupo: 'Ajustes', label: 'Assinatura' };
  for (const it of NAV_TOPO) if (it.href !== '/' && pathname.startsWith(it.href)) return { grupo: 'Principal', label: it.label };
  for (const g of NAV_GRUPOS) for (const it of g.items) if (pathname.startsWith(it.href)) return { grupo: g.label, label: it.label };
  return null;
}

export const ativo = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

/** Ações de "Novo" (botão da sidebar, + do celular e busca rápida). */
export interface NovoAcao { label: string; desc: string; to: string; icon: NavIcon; tom: string; destaque?: boolean }
export const NOVO_ACOES: NovoAcao[] = [
  { label: 'Entrada', desc: 'Receita recebida ou a receber', to: '/fluxo-caixa?action=nova-entrada', icon: ArrowUpRight, tom: 'text-success-fg', destaque: true },
  { label: 'Saída', desc: 'Despesa paga ou a pagar', to: '/fluxo-caixa?action=nova-saida', icon: ArrowDownRight, tom: 'text-danger-fg', destaque: true },
  { label: 'Transferência', desc: 'Entre suas contas', to: '/fluxo-caixa?action=nova-transferencia', icon: ArrowLeftRight, tom: 'text-info-fg', destaque: true },
  { label: 'Cobrança', desc: 'Pix, boleto ou cartão no Asaas', to: '/cobrancas?action=novo', icon: Receipt, tom: 'text-primary' },
  { label: 'Lançar por voz', desc: 'Fale e a IARA preenche', to: '/lancar-voz', icon: Mic, tom: 'text-foreground' },
  { label: 'Subir extrato ou print', desc: 'A IARA lê e você revisa', to: '/fluxo-caixa?action=importar', icon: Upload, tom: 'text-foreground' },
];

/** Número que aparece ao lado de um item do menu (pílula; bolinha no modo recolhido). */
export interface BadgeMenu { txt: string; tom: 'warn' | 'danger' | 'info' }
export const TOM_BADGE: Record<BadgeMenu['tom'], { pilula: string; ponto: string }> = {
  warn: { pilula: 'bg-warning-bg text-warning-fg', ponto: 'bg-warning-fg' },
  danger: { pilula: 'bg-danger-bg text-danger-fg', ponto: 'bg-danger-fg' },
  info: { pilula: 'bg-info-bg text-info-fg', ponto: 'bg-info-fg' },
};
const ate99 = (n: number) => (n > 99 ? '99+' : String(n));

/** Pendências (amarelo), cobranças vencidas (vermelho) e o que vence hoje no Calendário (azul). */
export function badgeDoMenu(href: string, c: { pendencias: number; cobrancasVencidas: number; calendarioHoje: number }): BadgeMenu | null {
  if (href === '/pendencias' && c.pendencias > 0) return { txt: ate99(c.pendencias), tom: 'warn' };
  if (href === '/cobrancas' && c.cobrancasVencidas > 0) return { txt: ate99(c.cobrancasVencidas), tom: 'danger' };
  if (href === '/calendario' && c.calendarioHoje > 0) return { txt: `${ate99(c.calendarioHoje)} hoje`, tom: 'info' };
  return null;
}
