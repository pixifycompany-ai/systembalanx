import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buscarCandidatas, criarReceita, vincularOuCriarReceita, vincularReceita, type AlvoReceita } from "../_shared/conciliar.ts";
import {
  apagarReceitaSeCriada, contratosDaAssinatura, inserirCobranca, isPago, lancarJurosMulta, linhasDaFatura,
  mapStatus, registrarFatura, repartir, STATUS_ABERTO, type LinhaCobranca,
} from "../_shared/faturas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function asaasBase(env: string) {
  return env === "production" || env === "prod"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

// Recorrência do contrato -> cycle do Asaas.
// Asaas aceita: WEEKLY(7d), BIWEEKLY(15d), MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY.
// Intervalos arbitrários (21d, 28d...) NÃO existem como cycle nativo.
function cicloAsaas(recorrencia: string): string {
  switch (recorrencia) {
    case "semanal": return "WEEKLY";
    case "quinzenal": return "BIWEEKLY";
    case "mensal": return "MONTHLY";
    case "bimestral": return "BIMONTHLY";
    case "trimestral": return "QUARTERLY";
    case "semestral": return "SEMIANNUALLY";
    case "anual": return "YEARLY";
    default: return "MONTHLY";
  }
}

// Multa (fine) e juros ao mês (interest) por atraso — só entram se > 0.
function multaJuros(body: any) {
  const multa = Number(body?.multa_percent) || 0;
  const juros = Number(body?.juros_percent) || 0;
  const extra: Record<string, unknown> = {};
  if (multa > 0) extra.fine = { value: multa, type: "PERCENTAGE" };
  if (juros > 0) extra.interest = { value: juros };
  return extra;
}

// Próxima data de vencimento a partir do dia (1..31), no formato YYYY-MM-DD.
function proximoVencimento(dia: number): string {
  const hoje = new Date();
  const d = Math.min(Math.max(dia || 10, 1), 28);
  let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), d);
  if (alvo <= hoje) alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, d);
  return alvo.toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Config Asaas do usuário
    const { data: cfg } = await admin.from("cobranca_config").select("asaas_api_key, asaas_env").eq("user_id", user.id).maybeSingle();
    if (!cfg?.asaas_api_key) return json({ error: "Conecte sua conta Asaas em Meu Perfil antes de cobrar." }, 400);
    const base = asaasBase(cfg.asaas_env || "production");
    const headers = { "Content-Type": "application/json", access_token: cfg.asaas_api_key as string };

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Garante um customer Asaas para o cliente (cria se faltar)
    async function ensureCustomer(clienteId: string): Promise<string> {
      const { data: cli } = await admin.from("clientes").select("*").eq("id", clienteId).eq("user_id", user.id).maybeSingle();
      if (!cli) throw new Error("Cliente não encontrado.");
      if (cli.asaas_customer_id) return cli.asaas_customer_id as string;
      const cpf = String(cli.cpf_cnpj || "").replace(/\D/g, "");
      const res = await fetch(`${base}/customers`, {
        method: "POST",
        headers,
        // notificationDisabled: true → Asaas NÃO manda email/SMS/WhatsApp. Usamos só o link.
        body: JSON.stringify({ name: cli.nome, cpfCnpj: cpf || undefined, email: cli.email || undefined, externalReference: cli.id, notificationDisabled: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.errors?.[0]?.description || "Erro ao criar cliente no Asaas.");
      await admin.from("clientes").update({ asaas_customer_id: j.id }).eq("id", cli.id);
      return j.id as string;
    }

    // Cria a cobrança interna + a receita "a receber" (vincula a já lançada, se houver)
    const registrar = (opts: LinhaCobranca) => inserirCobranca(admin, user.id, opts);

    // Importa TODAS as faturas em aberto de uma assinatura (que o Asaas já gerou)
    // como cobranças + receitas "a receber", sem duplicar. Só as não pagas —
    // as pagas históricas ficam de fora pra não recriar receita já lançada.
    // Assinatura de grupo: cada fatura vira uma linha por contrato.
    async function importarPagamentos(opts: {
      subId: string; contrato_id: string | null; cliente_id: string | null; conta_id: string | null; descricao: string; exigir_nf?: boolean; envio_pix?: boolean;
    }): Promise<number> {
      let novas = 0;
      try {
        const pr = await fetch(`${base}/subscriptions/${opts.subId}/payments`, { headers });
        if (!pr.ok) return 0;
        const pj = await pr.json();
        for (const pay of pj?.data || []) {
          if (!STATUS_ABERTO.includes(pay.status)) continue;
          const criou = await registrarFatura(admin, user.id, pay, opts.subId, {
            conta_id: opts.conta_id,
            fallback: { contrato_id: opts.contrato_id, cliente_id: opts.cliente_id, descricao: opts.descricao, exigir_nf: opts.exigir_nf, envio_pix: opts.envio_pix },
          });
          if (criou) novas++;
        }
      } catch (_) { /* ignore */ }
      return novas;
    }

    // ===== CRIAR RECORRENTE (a partir de um contrato) =====
    if (action === "criar-contrato") {
      const { contrato_id, forma_pagamento, conta_id } = body;
      const forma = (forma_pagamento || "UNDEFINED") as string;
      const { data: contrato } = await admin.from("contratos").select("*").eq("id", contrato_id).eq("user_id", user.id).maybeSingle();
      if (!contrato) return json({ error: "Contrato não encontrado." }, 404);
      if (contrato.asaas_subscription_id) return json({ error: "Este contrato já tem cobrança no Asaas." }, 400);
      if (!contrato.cliente_id) return json({ error: "Contrato sem cliente vinculado." }, 400);

      const customer = await ensureCustomer(contrato.cliente_id);
      const nextDueDate = proximoVencimento(Number(contrato.dia_vencimento) || 10);
      const subRes = await fetch(`${base}/subscriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer,
          billingType: forma,
          value: Number(contrato.valor),
          nextDueDate,
          cycle: cicloAsaas(contrato.recorrencia),
          description: contrato.descricao || "Assinatura",
          externalReference: contrato.id,
          ...multaJuros(body),
        }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) return json({ error: sub?.errors?.[0]?.description || "Erro ao criar assinatura no Asaas." }, 400);
      await admin.from("contratos").update({ asaas_subscription_id: sub.id }).eq("id", contrato.id);

      // Primeira cobrança gerada
      let pay: any = null;
      try {
        const pr = await fetch(`${base}/subscriptions/${sub.id}/payments`, { headers });
        const pj = await pr.json();
        pay = pj?.data?.[0] ?? null;
      } catch (_) { /* ignore */ }

      const cob = await registrar({
        cliente_id: contrato.cliente_id,
        contrato_id: contrato.id,
        conta_id: conta_id || null,
        tipo: "recorrente",
        asaas_payment_id: pay?.id ?? null,
        asaas_subscription_id: sub.id,
        descricao: contrato.descricao || "Assinatura",
        valor: pay ? Number(pay.value) : Number(contrato.valor),
        vencimento: pay?.dueDate || nextDueDate,
        forma,
        status: pay ? mapStatus(pay.status) : "pendente",
        invoice_url: pay?.invoiceUrl ?? null,
        exigir_nf: !!contrato.exigir_nf,
        envio_pix: !!contrato.envio_pix,
      });
      return json({ ok: true, cobranca: cob, invoiceUrl: pay?.invoiceUrl ?? null });
    }

    // ===== CRIAR AVULSA (cobrança única) =====
    if (action === "criar-avulsa") {
      const { cliente_id, valor, vencimento, descricao, forma_pagamento, conta_id } = body;
      if (!cliente_id || !valor || !vencimento) return json({ error: "Informe cliente, valor e vencimento." }, 400);
      const forma = (forma_pagamento || "UNDEFINED") as string;
      const customer = await ensureCustomer(cliente_id);
      const payRes = await fetch(`${base}/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer,
          billingType: forma,
          value: Number(valor),
          dueDate: vencimento,
          description: descricao || "Cobrança",
          externalReference: cliente_id,
          ...multaJuros(body),
        }),
      });
      const pay = await payRes.json();
      if (!payRes.ok) return json({ error: pay?.errors?.[0]?.description || "Erro ao criar cobrança no Asaas." }, 400);
      const cob = await registrar({
        cliente_id, contrato_id: null, conta_id: conta_id || null, tipo: "avulsa",
        asaas_payment_id: pay.id, asaas_subscription_id: null,
        descricao: descricao || "Cobrança", valor: Number(valor), vencimento,
        forma, status: mapStatus(pay.status), invoice_url: pay.invoiceUrl ?? null,
        envio_pix: !!body.envio_pix,
      });
      return json({ ok: true, cobranca: cob, invoiceUrl: pay.invoiceUrl ?? null });
    }

    // ===== LISTAR ASSINATURAS existentes no Asaas (do cliente) =====
    if (action === "listar-assinaturas") {
      const { cliente_id } = body;
      let customerId: string | null = null;
      if (cliente_id) {
        const { data: cli } = await admin.from("clientes").select("asaas_customer_id, cpf_cnpj").eq("id", cliente_id).eq("user_id", user.id).maybeSingle();
        customerId = (cli?.asaas_customer_id as string) ?? null;
        if (!customerId && cli?.cpf_cnpj) {
          const cpf = String(cli.cpf_cnpj).replace(/\D/g, "");
          if (cpf) {
            const cr = await fetch(`${base}/customers?cpfCnpj=${cpf}`, { headers });
            const cj = await cr.json();
            customerId = cj?.data?.[0]?.id ?? null;
            if (customerId) await admin.from("clientes").update({ asaas_customer_id: customerId }).eq("id", cliente_id);
          }
        }
      }
      const url = customerId ? `${base}/subscriptions?customer=${customerId}&limit=100` : `${base}/subscriptions?limit=100`;
      const r = await fetch(url, { headers });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao listar assinaturas." }, 400);
      const subs = (j?.data || []).map((s: any) => ({ id: s.id, value: s.value, cycle: s.cycle, description: s.description, status: s.status, nextDueDate: s.nextDueDate, billingType: s.billingType }));
      const ids = subs.map((s: any) => s.id);
      const { data: usadas } = await admin.from("contratos").select("asaas_subscription_id").eq("user_id", user.id).in("asaas_subscription_id", ids.length ? ids : ["-"]);
      const usadasSet = new Set((usadas || []).map((u: any) => u.asaas_subscription_id));
      return json({ ok: true, assinaturas: subs.map((s: any) => ({ ...s, vinculada: usadasSet.has(s.id) })) });
    }

    // ===== VINCULAR assinatura existente a um contrato =====
    if (action === "vincular-assinatura") {
      const { contrato_id, asaas_subscription_id, conta_id } = body;
      const { data: contrato } = await admin.from("contratos").select("*").eq("id", contrato_id).eq("user_id", user.id).maybeSingle();
      if (!contrato) return json({ error: "Contrato não encontrado." }, 404);
      if (contrato.asaas_subscription_id) return json({ error: "Este contrato já tem cobrança vinculada." }, 400);

      const { data: outro } = await admin.from("contratos").select("id")
        .eq("user_id", user.id).eq("asaas_subscription_id", asaas_subscription_id).neq("id", contrato.id).limit(1).maybeSingle();
      if (outro) return json({ error: "Essa assinatura já cobra outro contrato. Para cobrar vários contratos num boleto só, use 'Cobrar juntos' em Contratos." }, 400);

      const sr = await fetch(`${base}/subscriptions/${asaas_subscription_id}`, { headers });
      const sub = await sr.json();
      if (!sr.ok) return json({ error: sub?.errors?.[0]?.description || "Assinatura não encontrada no Asaas." }, 400);

      // Vincula + puxa o valor do Asaas pro contrato
      await admin.from("contratos").update({ asaas_subscription_id: sub.id, valor: Number(sub.value) }).eq("id", contrato.id);
      if (contrato.cliente_id && sub.customer) {
        await admin.from("clientes").update({ asaas_customer_id: sub.customer }).eq("id", contrato.cliente_id).is("asaas_customer_id", null);
      }
      // Desliga as notificações do Asaas pra esse cliente (email/SMS/WhatsApp)
      if (sub.customer) {
        await fetch(`${base}/customers/${sub.customer}`, { method: "POST", headers, body: JSON.stringify({ notificationDisabled: true }) }).catch(() => {});
      }

      // Importa TODAS as faturas em aberto que o Asaas já gerou (a receber)
      const novas = await importarPagamentos({
        subId: sub.id, contrato_id: contrato.id, cliente_id: contrato.cliente_id,
        conta_id: conta_id || null, descricao: contrato.descricao || sub.description || "Assinatura",
        exigir_nf: !!contrato.exigir_nf, envio_pix: !!contrato.envio_pix,
      });
      return json({ ok: true, valor: Number(sub.value), cobrancas: novas });
    }

    // ===== AGRUPAR: vários contratos do mesmo cliente numa assinatura só =====
    // modo "criar": nova assinatura no Asaas com a soma dos contratos.
    // modo "vincular": usa uma assinatura que já existe; o valor do Asaas vale e,
    // se a soma for diferente, é repartido proporcionalmente entre os contratos.
    // Cada fatura vira uma linha por contrato (uma receita por contrato).
    if (action === "agrupar") {
      const ids: string[] = Array.isArray(body.contrato_ids) ? [...new Set(body.contrato_ids as string[])] : [];
      if (ids.length < 2) return json({ error: "Selecione pelo menos 2 contratos." }, 400);
      const { data: lista } = await admin.from("contratos").select("*")
        .eq("user_id", user.id).in("id", ids).order("created_at", { ascending: true });
      const contratos = lista || [];
      if (contratos.length !== ids.length) return json({ error: "Contrato não encontrado." }, 404);

      const clienteId = contratos[0].cliente_id;
      if (!clienteId || contratos.some((c) => c.cliente_id !== clienteId)) {
        return json({ error: "Os contratos precisam ser do mesmo cliente (a assinatura do Asaas é de um cliente só)." }, 400);
      }
      const recorrencia = contratos[0].recorrencia;
      if (recorrencia === "unico" || contratos.some((c) => c.recorrencia !== recorrencia)) {
        return json({ error: "Os contratos precisam ter a mesma recorrência (ex.: todos mensais)." }, 400);
      }
      const inativos = contratos.filter((c) => c.status !== "ativo");
      if (inativos.length) return json({ error: `Só dá pra agrupar contratos ativos: ${inativos.map((c) => c.descricao).join(", ")}.` }, 400);

      // Contratos que já têm assinatura individual no Asaas. Para unificar, essas
      // assinaturas precisam ser canceladas antes (senão cobraria em duplicidade).
      const jaCobrados = contratos.filter((c) => c.asaas_subscription_id);
      if (jaCobrados.length && !body.cancelar_existentes) {
        return json({
          error: `Estes contratos já têm assinatura no Asaas: ${jaCobrados.map((c) => c.descricao).join(", ")}.`,
          precisaCancelar: jaCobrados.map((c) => c.descricao),
        }, 409);
      }
      // Cancela as assinaturas individuais no Asaas e limpa cobranças/receitas pendentes.
      for (const c of jaCobrados) {
        await fetch(`${base}/subscriptions/${c.asaas_subscription_id}`, { method: "DELETE", headers }).catch(() => {});
        const { data: velhas } = await admin.from("cobrancas").select("id, receita_id")
          .eq("user_id", user.id).eq("asaas_subscription_id", c.asaas_subscription_id).in("status", ["pendente", "vencido"]);
        for (const v of velhas || []) {
          if (v.receita_id) await admin.from("receitas").delete().eq("id", v.receita_id).eq("status", "pendente");
          await admin.from("cobrancas").update({ status: "cancelado", receita_id: null, updated_at: new Date().toISOString() }).eq("id", v.id);
        }
        await admin.from("contratos").update({ asaas_subscription_id: null }).eq("id", c.id);
      }

      let subId: string;
      let total: number;
      const ajustes: { contrato_id: string; descricao: string; de: number; para: number }[] = [];

      if (body.modo === "vincular") {
        const sr = await fetch(`${base}/subscriptions/${body.asaas_subscription_id}`, { headers });
        const sub = await sr.json();
        if (!sr.ok) return json({ error: sub?.errors?.[0]?.description || "Assinatura não encontrada no Asaas." }, 400);
        const { data: outro } = await admin.from("contratos").select("id")
          .eq("user_id", user.id).eq("asaas_subscription_id", sub.id).limit(1).maybeSingle();
        if (outro) return json({ error: "Essa assinatura já cobra outro contrato." }, 400);
        subId = sub.id;
        total = Number(sub.value);

        const soma = contratos.reduce((s, c) => s + (Number(c.valor) || 0), 0);
        if (Math.abs(soma - total) >= 0.01) {
          const novos = repartir(total, contratos.map((c) => Number(c.valor) || 0));
          for (let i = 0; i < contratos.length; i++) {
            ajustes.push({ contrato_id: contratos[i].id, descricao: contratos[i].descricao, de: Number(contratos[i].valor), para: novos[i] });
            await admin.from("contratos").update({ valor: novos[i] }).eq("id", contratos[i].id);
          }
        }
        if (sub.customer) {
          await admin.from("clientes").update({ asaas_customer_id: sub.customer }).eq("id", clienteId).is("asaas_customer_id", null);
          await fetch(`${base}/customers/${sub.customer}`, { method: "POST", headers, body: JSON.stringify({ notificationDisabled: true }) }).catch(() => {});
        }
        const diaSub = Number(String(sub.nextDueDate || "").slice(8, 10));
        if (diaSub) await admin.from("contratos").update({ dia_vencimento: diaSub }).in("id", ids);
      } else {
        const customer = await ensureCustomer(clienteId);
        total = Math.round(contratos.reduce((s, c) => s + (Number(c.valor) || 0), 0) * 100) / 100;
        const dia = Number(body.dia_vencimento) || Number(contratos[0].dia_vencimento) || 10;
        const subRes = await fetch(`${base}/subscriptions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            customer,
            billingType: body.forma_pagamento || "UNDEFINED",
            value: total,
            nextDueDate: proximoVencimento(dia),
            cycle: cicloAsaas(recorrencia),
            description: contratos.map((c) => c.descricao).join(" + ").slice(0, 500),
            externalReference: contratos[0].id,
            ...multaJuros(body),
          }),
        });
        const sub = await subRes.json();
        if (!subRes.ok) return json({ error: sub?.errors?.[0]?.description || "Erro ao criar assinatura no Asaas." }, 400);
        subId = sub.id;
        await admin.from("contratos").update({ dia_vencimento: Math.min(Math.max(dia, 1), 28) }).in("id", ids);
      }

      await admin.from("contratos").update({ asaas_subscription_id: subId }).in("id", ids);
      const faturas = await importarPagamentos({
        subId, contrato_id: null, cliente_id: clienteId, conta_id: body.conta_id || null, descricao: "Assinatura",
      });
      return json({ ok: true, asaas_subscription_id: subId, total, faturas, ajustes });
    }

    // ===== REAJUSTAR: muda o valor da assinatura E das faturas PENDENTES =====
    if (action === "reajustar-assinatura") {
      const { contrato_id, novo_valor } = body;
      const valor = Number(novo_valor);
      if (!valor || valor <= 0) return json({ error: "Valor inválido." }, 400);
      const { data: contrato } = await admin.from("contratos").select("asaas_subscription_id").eq("id", contrato_id).eq("user_id", user.id).maybeSingle();
      if (!contrato?.asaas_subscription_id) return json({ ok: true, updated: false });

      // Grupo: a assinatura cobra a SOMA dos contratos (com o novo valor deste).
      const doGrupo = await contratosDaAssinatura(admin, user.id, contrato.asaas_subscription_id);
      const totalAssinatura = doGrupo.length > 1
        ? Math.round(doGrupo.reduce((s, c) => s + (c.id === contrato_id ? valor : Number(c.valor) || 0), 0) * 100) / 100
        : valor;

      // updatePendingPayments:true → Asaas atualiza a assinatura E as cobranças pendentes.
      const r = await fetch(`${base}/subscriptions/${contrato.asaas_subscription_id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: totalAssinatura, updatePendingPayments: true }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao reajustar no Asaas." }, 400);

      // Reflete localmente: linhas em aberto DESTE contrato + suas receitas a receber
      // (no grupo, as partes dos outros contratos não mudam).
      const { data: cobs } = await admin.from("cobrancas").select("id, receita_id")
        .eq("user_id", user.id).eq("asaas_subscription_id", contrato.asaas_subscription_id)
        .eq("contrato_id", contrato_id).in("status", ["pendente", "vencido"]);
      for (const c of cobs || []) {
        await admin.from("cobrancas").update({ valor, updated_at: new Date().toISOString() }).eq("id", c.id);
        if (c.receita_id) await admin.from("receitas").update({ valor }).eq("id", c.receita_id).in("status", ["pendente", "atrasado"]);
      }
      // Parcelas futuras do contrato ainda sem fatura (ex.: "(5/12)", "(6/12)") seguem o novo valor.
      await admin.from("receitas").update({ valor })
        .eq("user_id", user.id).eq("contrato_id", contrato_id).eq("status", "pendente")
        .is("origem_receita_id", null).gte("data_vencimento", new Date().toISOString().slice(0, 10));
      return json({ ok: true, updated: true });
    }

    // ===== CANCELAR / EXCLUIR (some no Asaas também) =====
    if (action === "cancelar" || action === "excluir") {
      const { cobranca_id } = body;
      const { data: cob } = await admin.from("cobrancas").select("*").eq("id", cobranca_id).eq("user_id", user.id).maybeSingle();
      if (!cob) return json({ error: "Cobrança não encontrada." }, 404);

      // Remove no Asaas: assinatura (recorrente) e/ou a cobrança individual
      if (cob.asaas_subscription_id) {
        await fetch(`${base}/subscriptions/${cob.asaas_subscription_id}`, { method: "DELETE", headers }).catch(() => {});
      }
      if (cob.asaas_payment_id) {
        await fetch(`${base}/payments/${cob.asaas_payment_id}`, { method: "DELETE", headers }).catch(() => {});
      }
      // Libera o(s) contrato(s) pra poder recriar (no grupo, desfaz o agrupamento)
      if (cob.asaas_subscription_id) {
        await admin.from("contratos").update({ asaas_subscription_id: null })
          .eq("user_id", user.id).eq("asaas_subscription_id", cob.asaas_subscription_id);
      } else if (cob.contrato_id) {
        await admin.from("contratos").update({ asaas_subscription_id: null }).eq("id", cob.contrato_id);
      }

      // Todas as linhas da mesma fatura (grupo). A receita só é apagada se foi criada
      // pela integração; parcela lançada à mão continua lá, apenas desvinculada.
      for (const linha of await linhasDaFatura(admin, cob)) {
        await apagarReceitaSeCriada(admin, linha);
        if (action === "excluir") {
          await admin.from("cobrancas").delete().eq("id", linha.id);
        } else {
          await admin.from("cobrancas").update({ status: "cancelado", receita_id: null, updated_at: new Date().toISOString() }).eq("id", linha.id);
        }
      }
      return json({ ok: true });
    }

    // ===== ATUALIZAR FORMA de recebimento (billingType no Asaas) =====
    if (action === "atualizar-forma") {
      const { cobranca_id, forma_pagamento } = body;
      const forma = (forma_pagamento || "UNDEFINED") as string;
      const { data: cob } = await admin.from("cobrancas").select("*").eq("id", cobranca_id).eq("user_id", user.id).maybeSingle();
      if (!cob) return json({ error: "Cobrança não encontrada." }, 404);
      if (["pago", "cancelado", "estornado"].includes(cob.status)) {
        return json({ error: "Não dá pra alterar a forma de uma cobrança já paga/cancelada." }, 400);
      }

      if (cob.asaas_subscription_id) {
        // updatePendingPayments:true → altera a assinatura E as faturas pendentes.
        const r = await fetch(`${base}/subscriptions/${cob.asaas_subscription_id}`, {
          method: "POST", headers,
          body: JSON.stringify({ billingType: forma, updatePendingPayments: true }),
        });
        const j = await r.json();
        if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao alterar forma no Asaas." }, 400);
        const { data: cobs } = await admin.from("cobrancas").select("id")
          .eq("user_id", user.id).eq("asaas_subscription_id", cob.asaas_subscription_id).in("status", ["pendente", "vencido"]);
        for (const c of cobs || []) {
          await admin.from("cobrancas").update({ forma_pagamento: forma, updated_at: new Date().toISOString() }).eq("id", c.id);
        }
      } else if (cob.asaas_payment_id) {
        const r = await fetch(`${base}/payments/${cob.asaas_payment_id}`, {
          method: "POST", headers,
          body: JSON.stringify({ billingType: forma }),
        });
        const j = await r.json();
        if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao alterar forma no Asaas." }, 400);
        await admin.from("cobrancas").update({ forma_pagamento: forma, updated_at: new Date().toISOString() }).eq("id", cob.id);
      } else {
        await admin.from("cobrancas").update({ forma_pagamento: forma, updated_at: new Date().toISOString() }).eq("id", cob.id);
      }
      return json({ ok: true });
    }

    // ===== ATUALIZAR CONTA de recebimento (cobrança + receita vinculada) =====
    if (action === "atualizar-conta") {
      const { cobranca_id, conta_id } = body;
      const { data: cob } = await admin.from("cobrancas").select("*").eq("id", cobranca_id).eq("user_id", user.id).maybeSingle();
      if (!cob) return json({ error: "Cobrança não encontrada." }, 404);
      // O dinheiro da fatura cai numa conta só: vale para todas as linhas do grupo.
      for (const linha of await linhasDaFatura(admin, cob)) {
        await admin.from("cobrancas").update({ conta_id: conta_id || null, updated_at: new Date().toISOString() }).eq("id", linha.id);
        if (linha.receita_id) await admin.from("receitas").update({ conta_id: conta_id || null }).eq("id", linha.receita_id);
      }
      return json({ ok: true });
    }

    // ===== RECEBER MANUAL (pagou por fora, ex.: Pix em outro banco) =====
    // Marca no Asaas como recebido em dinheiro (receiveInCash) e baixa a receita.
    if (action === "receber-manual") {
      const { cobranca_id, data_pagamento } = body;
      const { data: cob } = await admin.from("cobrancas").select("*").eq("id", cobranca_id).eq("user_id", user.id).maybeSingle();
      if (!cob) return json({ error: "Cobrança não encontrada." }, 404);
      if (cob.status === "pago") return json({ ok: true, jaPago: true });
      if (!cob.asaas_payment_id) return json({ error: "Cobrança sem pagamento no Asaas." }, 400);
      const dia = data_pagamento || new Date().toISOString().split("T")[0];
      // Grupo: a fatura é uma só → recebe o total e baixa todas as linhas/receitas.
      const linhas = await linhasDaFatura(admin, cob);
      const total = Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100;

      const r = await fetch(`${base}/payments/${cob.asaas_payment_id}/receiveInCash`, {
        method: "POST",
        headers,
        body: JSON.stringify({ paymentDate: dia, value: total, notifyCustomer: false }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao registrar pagamento no Asaas." }, 400);

      for (const linha of linhas) {
        await admin.from("cobrancas").update({ status: "pago", data_pagamento: dia, updated_at: new Date().toISOString() }).eq("id", linha.id);
        if (linha.receita_id) await admin.from("receitas").update({ status: "recebido", data_recebimento: dia }).eq("id", linha.receita_id);
      }
      return json({ ok: true });
    }

    // ===== CONCILIAÇÃO: cobranças sem receita ↔ receitas já lançadas =====
    // deno-lint-ignore no-explicit-any
    const alvoDe = (c: any): AlvoReceita => ({
      user_id: user.id, cliente_id: c.cliente_id, contrato_id: c.contrato_id, conta_id: c.conta_id,
      descricao: c.descricao || "", valor: Number(c.valor), vencimento: c.vencimento,
      pago: c.status === "pago", data_pagamento: c.data_pagamento,
    });

    if (action === "conciliar-listar") {
      const { data: cobs } = await admin.from("cobrancas").select("*")
        .eq("user_id", user.id).is("receita_id", null)
        .not("status", "in", "(cancelado,estornado)")
        .order("vencimento", { ascending: true });
      const itens = [];
      for (const c of cobs || []) {
        itens.push({ cobranca: c, candidatas: await buscarCandidatas(admin, alvoDe(c), 60) });
      }
      return json({ itens });
    }

    if (action === "conciliar-aplicar") {
      const lista = Array.isArray(body.itens) ? body.itens : [];
      let vinculadas = 0, criadas = 0;
      const erros: string[] = [];
      for (const it of lista) {
        const { data: c } = await admin.from("cobrancas").select("*").eq("id", it.cobranca_id).eq("user_id", user.id).maybeSingle();
        if (!c || c.receita_id) continue;
        if (it.receita_id) {
          const { data: rec } = await admin.from("receitas").select("id, conta_id").eq("id", it.receita_id).eq("user_id", user.id).maybeSingle();
          if (!rec) { erros.push("Receita não encontrada."); continue; }
          const { data: jaUsada } = await admin.from("cobrancas").select("id").eq("receita_id", rec.id).limit(1).maybeSingle();
          if (jaUsada) { erros.push("Uma receita escolhida já está ligada a outra cobrança."); continue; }
          await vincularReceita(admin, rec.id, alvoDe(c), rec.conta_id);
          await admin.from("cobrancas").update({ receita_id: rec.id, updated_at: new Date().toISOString() }).eq("id", c.id);
          vinculadas++;
        } else if (it.criar) {
          const id = await criarReceita(admin, alvoDe(c));
          if (!id) { erros.push("Falha ao criar receita."); continue; }
          await admin.from("cobrancas").update({ receita_id: id, updated_at: new Date().toISOString() }).eq("id", c.id);
          criadas++;
        }
      }
      return json({ ok: true, vinculadas, criadas, erros });
    }

    // ===== SINCRONIZAR status (puxa do Asaas) =====
    if (action === "sincronizar") {
      const filtro = admin.from("cobrancas").select("*").eq("user_id", user.id).not("asaas_payment_id", "is", null);
      if (body.contrato_id) filtro.eq("contrato_id", body.contrato_id);
      const { data: cobs } = await filtro;
      // deno-lint-ignore no-explicit-any
      const faturas = new Map<string, any>(); // grupo: várias linhas, uma consulta por fatura
      for (const c of cobs || []) {
        try {
          if (c.status === "cancelado") continue;
          let p = faturas.get(c.asaas_payment_id);
          if (p === undefined) {
            const pr = await fetch(`${base}/payments/${c.asaas_payment_id}`, { headers });
            p = pr.ok ? await pr.json() : null;
            faturas.set(c.asaas_payment_id, p);
          }
          if (!p) continue;
          const novoStatus = mapStatus(p.status);
          if (novoStatus === "cancelado") {
            // Fatura apagada no Asaas: some a receita criada pela integração;
            // parcela lançada à mão fica, só desvinculada.
            await apagarReceitaSeCriada(admin, c);
            await admin.from("cobrancas").update({ status: "cancelado", receita_id: null, updated_at: new Date().toISOString() }).eq("id", c.id);
            continue;
          }
          await admin.from("cobrancas").update({
            status: novoStatus,
            invoice_url: p.invoiceUrl ?? c.invoice_url,
            data_pagamento: isPago(p.status) ? (p.paymentDate || p.clientPaymentDate || null) : null,
            updated_at: new Date().toISOString(),
          }).eq("id", c.id);
          // Baixa a receita conforme o pagamento
          if (c.receita_id && isPago(p.status)) {
            const dp = p.paymentDate || p.clientPaymentDate || c.vencimento;
            await admin.from("receitas").update({ status: "recebido", data_recebimento: dp }).eq("id", c.receita_id);
            await lancarJurosMulta(admin, c, p, dp); // juros/multa de atraso → receita extra (1x por fatura)
          }
        } catch (_) { /* ignore item */ }
      }
      // Descobre faturas NOVAS em aberto de cada assinatura vinculada (ex.: geradas
      // pelo Asaas depois do vínculo, ou anteriores que não foram importadas).
      const subs = new Map<string, any>();
      for (const c of cobs || []) {
        if (c.status === "cancelado") continue;
        if (c.asaas_subscription_id && !subs.has(c.asaas_subscription_id)) subs.set(c.asaas_subscription_id, c);
      }
      let novas = 0;
      for (const [subId, ctx] of subs) {
        novas += await importarPagamentos({
          subId, contrato_id: ctx.contrato_id, cliente_id: ctx.cliente_id,
          conta_id: ctx.conta_id, descricao: ctx.descricao || "Assinatura",
          exigir_nf: !!ctx.exigir_nf,
        });
      }

      // Concilia sozinho as cobranças ainda sem receita quando é inequívoco
      // (em ordem de vencimento, para a série de parcelas avançar mês a mês).
      const qSem = admin.from("cobrancas").select("*")
        .eq("user_id", user.id).is("receita_id", null)
        .not("status", "in", "(cancelado,estornado)")
        .order("vencimento", { ascending: true });
      if (body.contrato_id) qSem.eq("contrato_id", body.contrato_id);
      const { data: semRec } = await qSem;
      let conciliadas = 0;
      for (const c of semRec || []) {
        const r = await vincularOuCriarReceita(admin, alvoDe(c));
        if (r.receita_id) {
          await admin.from("cobrancas").update({ receita_id: r.receita_id, updated_at: new Date().toISOString() }).eq("id", c.id);
          conciliadas++;
        }
      }
      return json({ ok: true, sincronizadas: (cobs || []).length, novas, conciliadas });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("asaas-cobranca error", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
