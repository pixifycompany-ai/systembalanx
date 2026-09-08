## Problema

O botão "Dar baixa" (mobile swipe + botão check no desktop) chama `updateReceita(id, { status, data_recebimento })` / `updateDespesa(id, { status, data_pagamento })` passando apenas 2 campos.

Mas os hooks `updateReceita` (src/hooks/useReceitas.ts:222) e `updateDespesa` (src/hooks/useDespesas.ts:247) montam o UPDATE do Supabase listando **todos** os campos com fallback `|| null`. Como `formData.conta_id`, `formData.categoria_id`, `formData.cliente_id`, `formData.descricao`, `formData.valor`, `formData.forma_pagamento`, `formData.empresa_fonte` etc. vêm `undefined`, o Postgres grava `null` em todas essas colunas. Resultado: ao dar baixa, o lançamento perde conta, categoria, cliente/fornecedor, descrição, valor, forma de pagamento e vira "quebrado".

Isso também explica reports de perda de dados após edições parciais anteriores.

## Correções (código)

1. **`src/hooks/useReceitas.ts` — `updateReceita`**
   - Construir o payload dinamicamente: só incluir a chave se `formData[key] !== undefined`. Mantém a semântica atual de "campo enviado como string vazia/`null` limpa o valor", mas `undefined` (não enviado) preserva o valor existente.
   - Aplica para: `cliente_id`, `categoria_id`, `conta_id`, `contrato_id`, `descricao`, `valor`, `data_competencia`, `data_vencimento`, `data_recebimento`, `status`, `forma_pagamento`, `empresa_fonte`.

2. **`src/hooks/useDespesas.ts` — `updateDespesa`**
   - Mesma abordagem: payload dinâmico ignorando `undefined`.
   - Preservar a lógica existente de recalcular `fatura_id` / `forcarPendente` apenas quando `formData.conta_id !== undefined` (já é o caso).
   - Campos: `categoria_id`, `conta_id`, `cliente_id`, `fornecedor`, `descricao`, `valor`, `data_competencia`, `data_vencimento`, `data_pagamento`, `status`, `tipo`, `empresa_fonte` (+ `fatura_id` só quando recalculado).

3. **Não altero** `handleMobileConfirm` nem o botão check do desktop — o fix nos hooks corrige a raiz sem tocar os call sites.

## Reparo dos dados baixados hoje

Registros afetados: receitas com `status='recebido'` OU despesas com `status='pago'` cujo `updated_at::date = CURRENT_DATE` e que ficaram com `conta_id`, `categoria_id`, `cliente_id`/`fornecedor`, `descricao` ou `valor` NULL/zerados após a baixa.

Não é possível reconstruir os valores originais a partir do banco (o UPDATE sobrescreveu). Plano de reparo:

1. Rodar um `SELECT` (read_query) listando as receitas/despesas com `updated_at >= today` e um ou mais campos essenciais nulos, para o usuário revisar quais lançamentos precisam de reintervenção manual.
2. Apresentar a lista ao usuário com descrição (ou id), valor, data. Ele decide item a item: reeditar manualmente ou apagar.
3. Só executo `UPDATE`/`DELETE` após confirmação explícita — não vou "chutar" conta/categoria.

Se você tiver um backup/export recente do banco, dá para reimportar valores; me avise se existe.

## Fora de escopo

- Não mexo em `TransferModal`, `useAuxiliaryTransactions`, ou nos modais de edição — o payload deles já inclui todos os campos, então continuam funcionando.
- Não altero o comportamento de "enviar `null` explicitamente para limpar campo" (edição via modal continua limpando quando o usuário apaga o valor).
