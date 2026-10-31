-- Itens de cartão (despesas.fatura_id) passam a espelhar o status da fatura.
-- Antes: pagar a fatura não atualizava os itens, e o marcador de vencidos os
-- virava "atrasado" mesmo com a fatura paga. Saldos não mudam (ignoram fatura_id).

-- Fatura paga -> itens pagos (data = último pagamento da fatura; senão o vencimento)
update public.despesas i
set status = 'pago',
    data_pagamento = coalesce(
      (select max(p.data_pagamento) from public.cartao_fatura_pagamentos p where p.fatura_id = f.id),
      f.data_vencimento)
from public.cartao_faturas f
where f.id = i.fatura_id and f.status = 'paga' and i.status <> 'pago';

-- Fatura não paga -> itens pendentes (quem fica "atrasada" é a fatura)
update public.despesas i
set status = 'pendente', data_pagamento = null
from public.cartao_faturas f
where f.id = i.fatura_id and f.status <> 'paga' and i.status <> 'pendente';
