import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { gruposDuplicados } from '@/lib/duplicados';
import { anexosDe } from '@/lib/anexosDespesa';
import { notasDe } from '@/hooks/useCobrancas';
import { formatCurrency, formatDate } from '@/utils/formatters';

export type BlocoPendencia = 'risco' | 'ajuste' | 'documento';

export interface Pendencia {
  /** Identifica o item para "Não é problema" (tipo:id). */
  chave: string;
  bloco: BlocoPendencia;
  titulo: string;
  detalhe: string;
  /** Por que importa, em uma frase. */
  porque: string;
  valor?: number;
  acao?: { label: string; href: string };
  /** Pode ser marcado como "Não é problema". Prazos e falhas reais, não. */
  ignoravel: boolean;
}

// Tabelas fora dos tipos gerados (cobrancas, email_envios, cartao_faturas, pendencias_ignoradas)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ATIVA = '(cancelado,estornado)';
const nome = (r: Linha) => r?.cliente?.nome || r?.clientes?.nome || 'Sem cliente';
const busca = (txt: string) => `/fluxo-caixa?search=${encodeURIComponent(txt.slice(0, 40))}`;

async function carregar(): Promise<{ itens: Pendencia[]; ignoradas: Set<string> }> {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  const hojeIso = iso(hoje);

  const [cobs, emails, faturas, cartoes, contratos, recAbertas, recSemConta, despAbertas, despSemConta, ign] = await Promise.all([
    db.from('cobrancas').select('id, descricao, valor, vencimento, status, receita_id, cliente_id, exigir_nf, notas_fiscais, nota_fiscal_path, nota_fiscal_nome, nota_fiscal_enviada, asaas_payment_id, cliente:clientes(nome)')
      .not('status', 'in', ATIVA),
    db.from('email_envios').select('id, para, assunto, status, erro, created_at')
      .in('status', ['falhou', 'devolvido', 'spam']).eq('visto', false)
      .gte('created_at', iso(addDays(hoje, -30))),
    db.from('cartao_faturas').select('id, cartao_id, competencia, data_vencimento, valor_total, valor_pago, status')
      .neq('status', 'paga').lte('data_vencimento', iso(addDays(hoje, 3))),
    supabase.from('contas').select('id, nome').eq('tipo', 'cartao_credito'),
    db.from('contratos').select('id, descricao, valor, recorrencia, data_fim, asaas_subscription_id, gerar_receitas, cliente:clientes(nome)')
      .eq('status', 'ativo'),
    supabase.from('receitas').select('id, descricao, valor, data_vencimento, status, contrato_id, cliente_id, clientes(nome)')
      .in('status', ['pendente', 'atrasado']),
    supabase.from('receitas').select('id, descricao, valor, data_recebimento, clientes(nome)')
      .eq('status', 'recebido').is('conta_id', null).gt('valor', 0),
    supabase.from('despesas').select('*')
      .in('status', ['pendente', 'atrasado']).is('fatura_id', null),
    supabase.from('despesas').select('id, descricao, valor, data_pagamento, fornecedor')
      .eq('status', 'pago').is('conta_id', null).is('fatura_id', null).gt('valor', 0),
    db.from('pendencias_ignoradas').select('chave'),
  ]);

  const itens: Pendencia[] = [];
  const cobrancas: Linha[] = cobs.data || [];

  // Fatura agrupada (vários contratos numa cobrança) conta uma vez só.
  const porFatura = new Map<string, Linha[]>();
  for (const c of cobrancas) {
    const k = c.asaas_payment_id || c.id;
    porFatura.set(k, [...(porFatura.get(k) || []), c]);
  }
  const faturasCob: Linha[] = [...porFatura.values()].map((ls) => ({
    ...ls[0], valor: ls.reduce((s, l) => s + Number(l.valor), 0), linhas: ls,
  }));

  // ---------- Dinheiro em risco ----------
  for (const c of faturasCob.filter((f) => f.status === 'vencido')) {
    const dias = differenceInCalendarDays(hoje, parseISO(c.vencimento));
    itens.push({
      chave: `cob-vencida:${c.id}`, bloco: 'risco', ignoravel: false,
      titulo: 'Cobrança vencida', valor: c.valor,
      detalhe: `${nome(c)} · ${c.descricao || 'Cobrança'} · venceu ${formatDate(c.vencimento)} (${dias} dia${dias === 1 ? '' : 's'})`,
      porque: 'O cliente ainda não pagou. Vale lembrar por WhatsApp ou e-mail.',
      acao: { label: 'Ver cobrança', href: '/cobrancas' },
    });
  }
  for (const e of (emails.data || []) as Linha[]) {
    itens.push({
      chave: `email:${e.id}`, bloco: 'risco', ignoravel: true,
      titulo: e.status === 'devolvido' ? 'E-mail de cobrança devolvido' : e.status === 'spam' ? 'E-mail marcado como spam' : 'E-mail de cobrança não enviado',
      detalhe: `${e.para} · ${e.assunto || ''} · ${formatDate(String(e.created_at).slice(0, 10))}`,
      porque: 'O cliente não recebeu a cobrança.',
      acao: { label: 'Reenviar', href: '/cobrancas' },
    });
  }
  const nomeCartao = new Map(((cartoes.data || []) as Linha[]).map((c) => [c.id, c.nome]));
  for (const f of (faturas.data || []) as Linha[]) {
    const aberto = Number(f.valor_total) - Number(f.valor_pago);
    if (aberto <= 0.009) continue;
    const dias = differenceInCalendarDays(parseISO(f.data_vencimento), hoje);
    itens.push({
      chave: `fatura:${f.id}`, bloco: 'risco', ignoravel: false,
      titulo: dias < 0 ? 'Fatura de cartão vencida' : 'Fatura de cartão vencendo',
      valor: aberto,
      detalhe: `${nomeCartao.get(f.cartao_id) || 'Cartão'} · vence ${formatDate(f.data_vencimento)}${dias >= 0 ? (dias === 0 ? ' (hoje)' : ` (em ${dias} dia${dias === 1 ? '' : 's'})`) : ''}`,
      porque: 'Pague pelo "Pagar fatura" para o valor sair da conta certa.',
      acao: { label: 'Pagar fatura', href: '/contas' },
    });
  }
  const ctrs: Linha[] = contratos.data || [];
  for (const c of ctrs.filter((x) => x.gerar_receitas === false && x.asaas_subscription_id)) {
    itens.push({
      chave: `contrato-sem-geracao:${c.id}`, bloco: 'risco', ignoravel: true,
      titulo: 'Assinatura do Asaas ativa sem receitas lançadas', valor: Number(c.valor),
      detalhe: `${nome(c)} · ${c.descricao}`,
      porque: 'O Asaas continua cobrando todo mês. Encerre o contrato se o serviço acabou, ou volte a gerar as receitas.',
      acao: { label: 'Abrir contratos', href: '/contratos' },
    });
  }

  // ---------- Ajustes de cadastro ----------
  const semVinculo = faturasCob.filter((f) => f.linhas.some((l: Linha) => !l.receita_id));
  for (const c of semVinculo) {
    itens.push({
      chave: `cob-sem-receita:${c.id}`, bloco: 'ajuste', ignoravel: true,
      titulo: 'Cobrança sem lançamento', valor: c.valor,
      detalhe: `${nome(c)} · ${c.descricao || 'Cobrança'} · vence ${formatDate(c.vencimento)}`,
      porque: 'Não aparece como receita a receber nem dá baixa sozinha quando for paga.',
      acao: { label: 'Conciliar', href: '/cobrancas?action=conciliar' },
    });
  }

  const abertas: Linha[] = recAbertas.data || [];
  const assinaturaCompartilhada = new Map<string, number>();
  for (const c of ctrs) if (c.asaas_subscription_id) assinaturaCompartilhada.set(c.asaas_subscription_id, (assinaturaCompartilhada.get(c.asaas_subscription_id) || 0) + 1);
  for (const c of ctrs) {
    if (c.data_fim && c.data_fim < hojeIso) {
      itens.push({
        chave: `contrato-vencido:${c.id}`, bloco: 'ajuste', ignoravel: true,
        titulo: 'Contrato já terminou e continua ativo', valor: Number(c.valor),
        detalhe: `${nome(c)} · ${c.descricao} · terminou ${formatDate(c.data_fim)}`,
        porque: 'Entra no MRR e nas projeções como se ainda estivesse valendo.',
        acao: { label: 'Abrir contratos', href: '/contratos' },
      });
      continue;
    }
    if (c.gerar_receitas === false || c.recorrencia === 'unico') continue;
    // Contrato numa assinatura com outros: o valor da receita é a soma (não compara).
    if (c.asaas_subscription_id && (assinaturaCompartilhada.get(c.asaas_subscription_id) || 0) > 1) continue;
    const futuras = abertas.filter((r) => r.contrato_id === c.id && r.data_vencimento >= hojeIso);
    const diferentes = futuras.filter((r) => Math.abs(Number(r.valor) - Number(c.valor)) > 0.009);
    if (diferentes.length) {
      const valores = [...new Set(diferentes.map((r) => formatCurrency(Number(r.valor))))].join(', ');
      itens.push({
        chave: `contrato-valor:${c.id}`, bloco: 'ajuste', ignoravel: true,
        titulo: 'Valor do contrato diferente das receitas', valor: Number(c.valor),
        detalhe: `${nome(c)} · ${c.descricao} · ${diferentes.length} receita(s) futura(s) com ${valores}`,
        porque: 'Previsões e MRR usam valores que não batem. Se o valor varia todo mês (ex.: por cliente ativo), marque "Não é problema".',
        acao: { label: 'Ver lançamentos', href: busca(nome(c)) },
      });
    }
  }

  const despesas: Linha[] = (despAbertas.data || []).filter((d: Linha) => d.fornecedor !== '[pagamento-fatura]');
  const cobrancaDe = new Map<string, string>(cobrancas.filter((c) => c.receita_id).map((c) => [c.receita_id, c.id]));
  const pendentes = [
    ...abertas.map((r) => ({ id: r.id, descricao: r.descricao, valor: Number(r.valor), data_vencimento: r.data_vencimento, tipo: 'receita' as const, fornecedor_cliente: nome(r) })),
    ...despesas.map((d) => ({ id: d.id, descricao: d.descricao, valor: Number(d.valor), data_vencimento: d.data_vencimento, tipo: 'despesa' as const, fornecedor_cliente: d.fornecedor || 'Sem fornecedor' })),
  ];
  for (const g of gruposDuplicados(pendentes, cobrancaDe)) {
    const ids = g.map((i) => i.id).sort().join(',');
    itens.push({
      chave: `duplicado:${ids}`, bloco: 'ajuste', ignoravel: true,
      titulo: `Possível duplicado (${g.length} lançamentos)`, valor: g[0].valor,
      detalhe: `${g[0].fornecedor_cliente} · ${g.map((i) => `${i.descricao} (${formatDate(i.data_vencimento)})`).join(' · ')}`,
      porque: 'Mesmo valor, mesmo cliente/fornecedor e mesmo mês. Se for lançamento repetido, exclua um.',
      acao: { label: 'Ver lançamentos', href: busca(g[0].descricao) },
    });
  }
  for (const d of (despSemConta.data || []) as Linha[]) {
    itens.push({
      chave: `desp-sem-conta:${d.id}`, bloco: 'ajuste', ignoravel: true,
      titulo: 'Despesa paga sem conta', valor: Number(d.valor),
      detalhe: `${d.descricao}${d.data_pagamento ? ` · paga ${formatDate(d.data_pagamento)}` : ''}`,
      porque: 'O dinheiro não saiu de nenhuma conta, então o saldo fica maior do que o real.',
      acao: { label: 'Corrigir', href: busca(d.descricao) },
    });
  }
  for (const r of (recSemConta.data || []) as Linha[]) {
    itens.push({
      chave: `rec-sem-conta:${r.id}`, bloco: 'ajuste', ignoravel: true,
      titulo: 'Receita recebida sem conta', valor: Number(r.valor),
      detalhe: `${nome(r)} · ${r.descricao}${r.data_recebimento ? ` · recebida ${formatDate(r.data_recebimento)}` : ''}`,
      porque: 'O dinheiro não entrou em nenhuma conta, então o saldo fica menor do que o real.',
      acao: { label: 'Corrigir', href: busca(r.descricao) },
    });
  }

  // ---------- Documentos ----------
  for (const c of faturasCob) {
    const exige = c.linhas.some((l: Linha) => l.exigir_nf);
    const temNota = c.linhas.some((l: Linha) => notasDe(l as never).length > 0 || l.nota_fiscal_enviada);
    if (!exige || temNota || !['pendente', 'vencido'].includes(c.status)) continue;
    itens.push({
      chave: `nf:${c.id}`, bloco: 'documento', ignoravel: true,
      titulo: 'Nota fiscal exigida e não anexada', valor: c.valor,
      detalhe: `${nome(c)} · ${c.descricao || 'Cobrança'} · vence ${formatDate(c.vencimento)}`,
      porque: 'Sem a nota, a cobrança não é disparada.',
      acao: { label: 'Anexar nota', href: '/cobrancas' },
    });
  }
  const limiteBoleto = iso(addDays(hoje, 7));
  for (const d of despesas) {
    if (d.fornecedor === '[fatura]' || !d.data_vencimento || d.data_vencimento > limiteBoleto) continue;
    if (anexosDe(d).length) continue;
    itens.push({
      chave: `boleto:${d.id}`, bloco: 'documento', ignoravel: true,
      titulo: 'Conta a pagar sem boleto anexado', valor: Number(d.valor),
      detalhe: `${d.fornecedor ? `${d.fornecedor} · ` : ''}${d.descricao} · vence ${formatDate(d.data_vencimento)}`,
      porque: 'Anexe o boleto para pagar sem procurar no e-mail. Se não tem boleto (débito automático, Pix), marque "Não é problema".',
      acao: { label: 'Anexar', href: busca(d.descricao) },
    });
  }

  const ignoradas = new Set<string>(((ign.data || []) as { chave: string }[]).map((i) => i.chave));
  return { itens, ignoradas };
}

/** Pendências da empresa ativa (dinheiro em risco, ajustes de cadastro, documentos). */
export function usePendencias() {
  const { activeTenant } = useTenant();
  const qc = useQueryClient();
  const chaveQuery = ['pendencias', activeTenant?.id];
  const q = useQuery({ queryKey: chaveQuery, queryFn: carregar, staleTime: 2 * 60_000, enabled: !!activeTenant?.id });

  const todas = q.data?.itens || [];
  const ignoradas = q.data?.ignoradas || new Set<string>();
  const visiveis = todas.filter((p) => !ignoradas.has(p.chave));

  const ignorar = async (chave: string) => {
    const { error } = await db.from('pendencias_ignoradas').insert({ chave, tenant_id: activeTenant?.id });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['pendencias'] });
  };
  const restaurar = async (chave: string) => {
    const { error } = await db.from('pendencias_ignoradas').delete().eq('chave', chave).eq('tenant_id', activeTenant?.id);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['pendencias'] });
  };

  return {
    pendencias: visiveis,
    ignoradas: todas.filter((p) => ignoradas.has(p.chave)),
    total: visiveis.length,
    isLoading: q.isLoading,
    refetch: q.refetch,
    ignorar,
    restaurar,
  };
}
