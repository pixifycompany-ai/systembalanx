-- DRE grouping per category, so the Demonstrativo de Resultado is built from an
-- explicit, auditable classification instead of fragile keyword guessing.
--
-- Groups (grupo_dre):
--   rec_servico        -> Receita: Prestação de Serviços
--   rec_outra          -> Receita: Outras Receitas
--   imposto            -> Deduções da Receita (impostos sobre faturamento, descontos concedidos)
--   custo_variavel     -> Custos Variáveis (escalam com a entrega: tráfego/mídia, terceirizados, IA)
--   desp_comercial     -> Despesas Comerciais / Marketing
--   desp_administrativa-> Despesas Administrativas
--   desp_pessoal       -> Despesas com Pessoal
--   desp_operacional   -> Outras Despesas Operacionais
--   distribuicao_lucro -> Distribuição de Lucros (ABAIXO da linha; não entra no EBITDA/Lucro)
--   NULL               -> A classificar
alter table public.categorias add column if not exists grupo_dre text;

comment on column public.categorias.grupo_dre is
  'Grupo no DRE (rec_servico, rec_outra, imposto, custo_variavel, desp_comercial, desp_administrativa, desp_pessoal, desp_operacional, distribuicao_lucro). NULL = a classificar.';

-- ===== Classificação inicial das categorias existentes (por nome) =====

-- Receitas: serviço vs outras
update public.categorias set grupo_dre = 'rec_servico' where tipo = 'receita' and grupo_dre is null and nome in (
  'Branding e Design','Clario','Consultoria','Desenvolvimento de Software','Estratégia e Posicionamento',
  'Gestão de Tráfego','Implantação Omnichat','Omnichat','Produção de Conteúdo','Projetos','Revvue',
  'Serviços Prestados','Tabelio'
);
update public.categorias set grupo_dre = 'rec_outra' where tipo = 'receita' and grupo_dre is null and nome in (
  'Comissões','Juros/Multa','Licenças/Assinaturas','Outros'
);

-- Deduções da receita
update public.categorias set grupo_dre = 'imposto' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Impostos','Descontos Concedidos'
);

-- Custos variáveis (escalam com entrega ao cliente)
update public.categorias set grupo_dre = 'custo_variavel' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Mídia Paga / Tráfego','Tráfego Pago','Serviços Terceirizados','Plataformas de IA'
);

-- Despesas comerciais / marketing
update public.categorias set grupo_dre = 'desp_comercial' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Marketing e Publicidade','Comissão Vendas','Comissões','Custos de Viagem Captação'
);

-- Despesas administrativas
update public.categorias set grupo_dre = 'desp_administrativa' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Administrativas','Contabilidade','Tarifa Bancária','Internet & Telefone','Materiais','Cursos'
);

-- Despesas com pessoal
update public.categorias set grupo_dre = 'desp_pessoal' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Pessoal/Salários'
);

-- Outras despesas operacionais
update public.categorias set grupo_dre = 'desp_operacional' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Assinaturas Plataformas','Ferramentas e Software','Infraestrutura','Investimento em Equipamentos',
  'Investimentos em Tecnologia','Juros/Multa','Outros'
);

-- Distribuição de lucros (abaixo da linha)
update public.categorias set grupo_dre = 'distribuicao_lucro' where tipo = 'despesa' and grupo_dre is null and nome in (
  'Distribuição de Lucros'
);
