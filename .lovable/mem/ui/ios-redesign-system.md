---
name: iOS-style Mobile Redesign System
description: Componentes compartilhados (HeroStatCard, ListRowCard, MobilePageHeader, DetailSheet) e Dialog em bottom sheet no mobile
type: design
---
Linguagem visual iOS aplicada no mobile (mantém desktop intacto via md:hidden / hidden md:block):

- `MobilePageHeader` — eyebrow muted + H1 grande (2xl) no topo das páginas mobile (Dashboard, Visão, Contas, Lançamentos, Análises).
- `HeroStatCard` — card preto (dark) com valor 3xl, progress bar, footer 2 colunas. Usado para Saldo Consolidado, Meta do mês, Saldo Total em Contas, Faturas Abertas, Lucro do mês.
- `ListRowCard` — linha branca com avatar quadrado colorido (10x10 rounded-xl), title/subtitle truncadas e valor à direita. Usado em listas (Contas mobile).
- `DetailSheet` — wrapper Sheet com handle iOS + botão circular de fechar.
- `Dialog` (src/components/ui/dialog.tsx) — no mobile vira bottom sheet (rounded-t-3xl, slide-in-from-bottom, safe-area-inset-bottom, handle visual). No desktop continua centralizado.

Regras:
- Nunca usar cores hardcoded — só tokens semânticos.
- Nas páginas com header desktop existente, duplicar com `md:hidden` (mobile) + `hidden md:flex/block` (desktop) — não unificar pra evitar regressão.
- Navegação: bottom nav mobile = [Início, Lançamentos, +, Visão, Menu]. Análises fica no menu.
