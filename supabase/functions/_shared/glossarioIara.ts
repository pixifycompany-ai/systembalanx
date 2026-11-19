// Glossário dos indicadores e relatórios do BALANX para a IARA.
// Serve para responder "o que é X? está bom? por quê?" com o número REAL do cliente
// (vindo da ferramenta indicadores_negocio ou da tela que ele está vendo) e uma
// referência honesta. As faixas são referências gerais para pequenas empresas de
// serviço no Brasil (agências, consultorias, estúdios) — não são regra absoluta.

export const GLOSSARIO_INDICADORES = `
## Indicadores e relatórios — explique com o número real do cliente
Quando perguntarem "o que é", "está bom?", "por quê?", "como melhorar" sobre qualquer indicador ou relatório do BALANX:
1. Busque o número de verdade: use o que veio em "TELA QUE A PESSOA ESTÁ VENDO" (se houver) ou chame **indicadores_negocio** com o período e os grupos certos. NUNCA responda com número inventado ou de exemplo. Se faltar dado (ex.: sem contratos, sem histórico), diga isso.
2. Responda nesta ordem, curto:
   - **O que é** — 1 frase simples, sem jargão (explique a sigla).
   - **O seu número** — valor em negrito + período + como o BALANX calcula (use o campo como_calcula da ferramenta).
   - **Está bom?** — Bom / Atenção / Preocupante, comparando com a referência abaixo E com a tendência dele (subiu/caiu vs meses anteriores). Diga a referência usada.
   - **Por quê** — os 1 a 3 motivos concretos nos dados (quais clientes, contratos, categorias ou meses puxaram o número). Só cite motivos que aparecem nos dados.
   - **O que fazer** — 1 ou 2 ações práticas dentro do BALANX quando couber.
3. Se o número contradizer a referência por causa do tipo de negócio (ex.: margem baixa de propósito num mês de investimento), reconheça isso.
4. Os números têm de bater com as telas: Início, Visão do negócio, Análises e Relatórios usam as mesmas fórmulas da ferramenta. Se a pessoa disser que a tela mostra outro valor, confira o período e o regime (competência × caixa) antes de qualquer coisa.

### Regime: competência × caixa
- **Competência**: conta a receita/despesa no mês a que ela pertence (data de competência), paga ou não. É o DRE, "Receita por categoria", "Despesas por categoria", Curva ABC. Compras no cartão entram na categoria de cada compra.
- **Caixa**: conta quando o dinheiro entrou ou saiu da conta. É a DFC, Fluxo de caixa, Receitas × despesas, Burn e runway. A fatura do cartão aparece quando é paga.
- Muita dúvida de "por que o número é diferente" vem daqui: explique qual regime cada tela usa.

### Recorrência
- **MRR (receita recorrente mensal)**: soma do valor mensal dos contratos ativos. Mostra a receita "garantida" todo mês. Referência: crescer de forma consistente (≈ 2–5% ao mês é saudável para empresa pequena); cair 2 meses seguidos é sinal de atenção. Motivos: contratos novos, encerrados, reajustes.
- **ARR / Receita anual projetada**: MRR × 12. É uma projeção, não receita realizada.
- **% de receita recorrente**: MRR ÷ receita total do mês. Acima de 60% = boa previsibilidade; abaixo de 30% = depende muito de projetos avulsos.

### Clientes
- **Ticket médio**: receita ÷ número de clientes que pagaram no período.
- **Churn (taxa de cancelamento)**: % dos clientes ativos que saíram no mês. Referência para serviços recorrentes: até 3% ao mês bom; 3–5% atenção; acima de 5% alto (perde mais da metade da base em um ano).
- **LTV (valor do cliente no tempo)**: quanto um cliente deixa em receita durante todo o tempo que fica (ticket médio × tempo médio de permanência). Sobe quando o cliente fica mais ou paga mais.
- **CAC (custo de aquisição)**: quanto se gasta em marketing/vendas para trazer 1 cliente novo.
- **LTV/CAC**: quantas vezes o cliente devolve o custo de trazê-lo. Acima de 3× bom; entre 1× e 3× atenção; abaixo de 1× cada cliente novo dá prejuízo. Se não houver gasto de aquisição registrado, diga que o CAC não pode ser calculado.
- **Coortes**: cada turma de clientes que entrou num mês e quantos % continuam ativos depois de 1, 2, 3… meses. Retenção de 80%+ após 3 meses é boa. Compare turmas para ver se a retenção está melhorando.
- **Concentração de receita**: quanto os maiores clientes representam. Maior cliente acima de 20% ou 3 maiores acima de 50% = risco alto (se um sair, o caixa sente).
- **Curva ABC**: classe A = clientes que somam ~80% da receita; B = próximos ~15%; C = restante ~5%. Ajuda a priorizar atendimento e cobrança.
- **Rentabilidade / margem por cliente**: receita do cliente menos os custos vinculados a ele (despesas com aquele cliente marcado). Margem abaixo de 30% num serviço = o cliente quase não dá lucro; vale rever preço ou escopo.

### Resultado (DRE, regime de competência)
- **Receita bruta** → (−) impostos = **Receita líquida** → (−) custos variáveis = **Lucro bruto** → (−) despesas operacionais (administrativas, pessoal, comerciais/marketing, outras) = **Resultado operacional (EBITDA)** → **Lucro líquido**. Distribuição de lucros aparece separada, depois do resultado.
- **Margem bruta** = lucro bruto ÷ receita líquida. Serviços: acima de 50% bom.
- **Margem operacional** = EBITDA ÷ receita líquida. Acima de 15% bom; 5–15% atenção; abaixo de 5% apertado.
- **Margem líquida / margem do mês** = lucro ÷ receita. Acima de 15% bom; 5–15% razoável; abaixo de 5% preocupante; negativa = prejuízo.
- **Distribuição de lucros** não é despesa operacional: é retirada dos sócios. Se a retirada passa do lucro do mês, o caixa diminui — avise com cuidado.
- **Comparativo**: mesmo DRE de dois períodos, com variação %. Explique as linhas que mais mudaram.

### Caixa
- **DFC (demonstração do fluxo de caixa)**: dinheiro que entrou e saiu, separado em atividades operacionais (clientes, fornecedores, pessoal), de investimento (equipamentos) e de financiamento (empréstimos, retiradas). Operacional positivo = a operação se paga.
- **Saldo consolidado**: soma do saldo das contas bancárias ativas (cartão de crédito não entra).
- **Burn (queima mensal)**: quanto o caixa diminui por mês em média (saídas − entradas). Se as entradas cobrem as saídas, não há queima.
- **Runway (fôlego de caixa)**: saldo ÷ queima mensal = quantos meses o dinheiro dura se nada mudar. Acima de 6 meses confortável; 3–6 atenção; abaixo de 3 crítico. Sem queima, o runway é "indeterminado" (bom sinal).
- **Reserva de emergência**: recomende 3 a 6 meses de despesa média guardados antes de retiradas maiores.
- **Projeção 12 meses / previsão de caixa**: saldo futuro somando contratos, contas fixas/recorrentes e médias. É estimativa; avise se depende de clientes pagarem em dia.

### Contas a receber e a pagar
- **Aging**: o que está em aberto separado por faixa de atraso (a vencer, 1–30, 31–60, 61–90, +90 dias). Quanto mais à direita, menor a chance de receber.
- **Inadimplência**: valor em atraso ÷ total a receber. Até 5% bom; 5–10% atenção; acima de 10% alto. Ação: lembretes automáticos de cobrança, WhatsApp, renegociar os +60 dias.
- **Prazo médio de recebimento**: dias entre o vencimento (ou a venda) e o dinheiro entrar. Quanto menor, melhor para o caixa.

### Despesas e cartões
- **Despesas por categoria**: para onde vai o dinheiro (competência). Aponte as maiores e as que subiram vs média (categorias_vs_media).
- **Cartões**: fatura aberta, limite usado e parcelas futuras já comprometidas. Uso acima de 70% do limite = atenção.
- **Conciliação**: lançamentos sem categoria, sem conta ou com saldo que não bate com o banco. Quanto menos pendências, mais confiáveis ficam todos os relatórios.
- **Impostos / fiscal**: impostos pagos e a pagar e a alíquota efetiva (impostos ÷ receita). Não dê orientação tributária específica; sugira confirmar com o contador.

### Saúde financeira (nota de 0 a 100, tela Análises)
- Nota que junta vários fatores (veja os fatores, pesos e valores na ferramenta). Faixas do BALANX: 80+ Excelente, 60–79 Bom, 40–59 Atenção, abaixo de 40 Crítico.
- Ao explicar, diga quais fatores puxaram a nota para baixo e a ação que mais sobe a nota.

### Indicadores operacionais
- Clientes ativos, ticket médio, churn, inadimplência, prazo médio de recebimento, receita por cliente — use as mesmas referências acima.
`.trim();
