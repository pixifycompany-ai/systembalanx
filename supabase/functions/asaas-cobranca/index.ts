import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Status Asaas -> status interno da cobrança
function mapStatus(s: string): string {
  switch (s) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "pago";
    case "OVERDUE":
      return "vencido";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "estornado";
    case "DELETED":
      return "cancelado";
    default:
      return "pendente"; // PENDING, AWAITING_RISK_ANALYSIS, etc.
  }
}
const isPago = (s: string) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s);

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

    // Cria a cobrança interna + a receita "a receber" pendente
    async function registrar(opts: {
      cliente_id: string; contrato_id: string | null; conta_id: string | null; tipo: string;
      asaas_payment_id: string | null; asaas_subscription_id: string | null;
      descricao: string; valor: number; vencimento: string; forma: string;
      status: string; invoice_url: string | null;
    }) {
      const { data: rec } = await admin.from("receitas").insert({
        user_id: user.id,
        cliente_id: opts.cliente_id,
        conta_id: opts.conta_id,
        descricao: opts.descricao,
        valor: opts.valor,
        data_vencimento: opts.vencimento,
        status: opts.status === "pago" ? "recebido" : "pendente",
        data_recebimento: opts.status === "pago" ? opts.vencimento : null,
      } as never).select("id").single();
      const { data: cob } = await admin.from("cobrancas").insert({
        user_id: user.id,
        cliente_id: opts.cliente_id,
        contrato_id: opts.contrato_id,
        conta_id: opts.conta_id,
        receita_id: rec?.id ?? null,
        tipo: opts.tipo,
        asaas_payment_id: opts.asaas_payment_id,
        asaas_subscription_id: opts.asaas_subscription_id,
        descricao: opts.descricao,
        valor: opts.valor,
        vencimento: opts.vencimento,
        forma_pagamento: opts.forma,
        status: opts.status,
        invoice_url: opts.invoice_url,
      } as never).select("*").single();
      return cob;
    }

    // Lança o juros/multa efetivamente recebido (informado pelo Asaas) como
    // receita EXTRA na categoria "Juros/Multa", vinculada à receita principal —
    // espelha o campo "Juros/Multa" do lançamento manual do Fluxo de Caixa.
    async function lancarJurosMulta(cob: any, p: any, dataPag: string | null) {
      if (!cob?.receita_id) return;
      let extra = Number(p?.interestValue) || 0;
      if (!extra && p?.originalValue != null) extra = Number(p.value) - Number(p.originalValue);
      extra = Math.round((extra + Number.EPSILON) * 100) / 100;
      if (!(extra > 0)) return;
      // Idempotência: não duplica o juros dessa receita em re-sincronizações.
      const { data: existente } = await admin.from("receitas")
        .select("id").eq("origem_receita_id", cob.receita_id).ilike("descricao", "Juros/Multa%").limit(1).maybeSingle();
      if (existente) return;
      const { data: cat } = await admin.from("categorias")
        .select("id").eq("nome", "Juros/Multa").eq("tipo", "receita").eq("is_padrao", true).is("user_id", null).limit(1).maybeSingle();
      const dia = dataPag || cob.vencimento;
      await admin.from("receitas").insert({
        user_id: cob.user_id,
        cliente_id: cob.cliente_id,
        conta_id: cob.conta_id,
        categoria_id: cat?.id ?? null,
        descricao: `Juros/Multa - ${cob.descricao || "Cobrança"}`,
        valor: extra,
        data_vencimento: dia,
        data_recebimento: dia,
        status: "recebido",
        origem_receita_id: cob.receita_id,
      } as never);
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

      // Próxima cobrança em aberto vira receita "a receber"
      let pay: any = null;
      try {
        const pr = await fetch(`${base}/subscriptions/${sub.id}/payments`, { headers });
        const pj = await pr.json();
        const pays = pj?.data || [];
        pay = pays.find((p: any) => ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes(p.status)) || pays[0] || null;
      } catch (_) { /* ignore */ }

      if (pay) {
        const { data: existe } = await admin.from("cobrancas").select("id").eq("asaas_payment_id", pay.id).eq("user_id", user.id).maybeSingle();
        if (!existe) {
          await registrar({
            cliente_id: contrato.cliente_id, contrato_id: contrato.id, conta_id: conta_id || null, tipo: "recorrente",
            asaas_payment_id: pay.id, asaas_subscription_id: sub.id,
            descricao: contrato.descricao || sub.description || "Assinatura", valor: Number(pay.value),
            vencimento: pay.dueDate, forma: pay.billingType || sub.billingType || "UNDEFINED",
            status: mapStatus(pay.status), invoice_url: pay.invoiceUrl ?? null,
          });
        }
      }
      return json({ ok: true, valor: Number(sub.value) });
    }

    // ===== REAJUSTAR: muda o valor da assinatura E das faturas PENDENTES =====
    if (action === "reajustar-assinatura") {
      const { contrato_id, novo_valor } = body;
      const valor = Number(novo_valor);
      if (!valor || valor <= 0) return json({ error: "Valor inválido." }, 400);
      const { data: contrato } = await admin.from("contratos").select("asaas_subscription_id").eq("id", contrato_id).eq("user_id", user.id).maybeSingle();
      if (!contrato?.asaas_subscription_id) return json({ ok: true, updated: false });

      // updatePendingPayments:true → Asaas atualiza a assinatura E as cobranças pendentes.
      const r = await fetch(`${base}/subscriptions/${contrato.asaas_subscription_id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: valor, updatePendingPayments: true }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao reajustar no Asaas." }, 400);

      // Reflete localmente: cobranças ainda em aberto + suas receitas a receber
      const { data: cobs } = await admin.from("cobrancas").select("id, receita_id")
        .eq("user_id", user.id).eq("asaas_subscription_id", contrato.asaas_subscription_id).in("status", ["pendente", "vencido"]);
      for (const c of cobs || []) {
        await admin.from("cobrancas").update({ valor, updated_at: new Date().toISOString() }).eq("id", c.id);
        if (c.receita_id) await admin.from("receitas").update({ valor }).eq("id", c.receita_id).in("status", ["pendente", "atrasado"]);
      }
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
      // Libera o contrato pra poder recriar
      if (cob.contrato_id) await admin.from("contratos").update({ asaas_subscription_id: null }).eq("id", cob.contrato_id);
      // Receita pendente vinculada some (não apaga se já foi recebida)
      if (cob.receita_id) {
        await admin.from("receitas").delete().eq("id", cob.receita_id).eq("status", "pendente");
      }

      if (action === "excluir") {
        await admin.from("cobrancas").delete().eq("id", cob.id);
      } else {
        await admin.from("cobrancas").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", cob.id);
      }
      return json({ ok: true });
    }

    // ===== ATUALIZAR CONTA de recebimento (cobrança + receita vinculada) =====
    if (action === "atualizar-conta") {
      const { cobranca_id, conta_id } = body;
      const { data: cob } = await admin.from("cobrancas").select("*").eq("id", cobranca_id).eq("user_id", user.id).maybeSingle();
      if (!cob) return json({ error: "Cobrança não encontrada." }, 404);
      await admin.from("cobrancas").update({ conta_id: conta_id || null, updated_at: new Date().toISOString() }).eq("id", cob.id);
      if (cob.receita_id) await admin.from("receitas").update({ conta_id: conta_id || null }).eq("id", cob.receita_id);
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

      const r = await fetch(`${base}/payments/${cob.asaas_payment_id}/receiveInCash`, {
        method: "POST",
        headers,
        body: JSON.stringify({ paymentDate: dia, value: Number(cob.valor), notifyCustomer: false }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: j?.errors?.[0]?.description || "Erro ao registrar pagamento no Asaas." }, 400);

      await admin.from("cobrancas").update({ status: "pago", data_pagamento: dia, updated_at: new Date().toISOString() }).eq("id", cob.id);
      if (cob.receita_id) await admin.from("receitas").update({ status: "recebido", data_recebimento: dia }).eq("id", cob.receita_id);
      return json({ ok: true });
    }

    // ===== SINCRONIZAR status (puxa do Asaas) =====
    if (action === "sincronizar") {
      const filtro = admin.from("cobrancas").select("*").eq("user_id", user.id).not("asaas_payment_id", "is", null);
      if (body.contrato_id) filtro.eq("contrato_id", body.contrato_id);
      const { data: cobs } = await filtro;
      for (const c of cobs || []) {
        try {
          const pr = await fetch(`${base}/payments/${c.asaas_payment_id}`, { headers });
          if (!pr.ok) continue;
          const p = await pr.json();
          const novoStatus = mapStatus(p.status);
          await admin.from("cobrancas").update({
            status: novoStatus,
            invoice_url: p.invoiceUrl ?? c.invoice_url,
            data_pagamento: isPago(p.status) ? (p.paymentDate || p.clientPaymentDate || null) : null,
            updated_at: new Date().toISOString(),
          }).eq("id", c.id);
          // Baixa/reabre a receita conforme o pagamento
          if (c.receita_id) {
            if (isPago(p.status)) {
              const dp = p.paymentDate || p.clientPaymentDate || c.vencimento;
              await admin.from("receitas").update({ status: "recebido", data_recebimento: dp }).eq("id", c.receita_id);
              await lancarJurosMulta(c, p, dp); // juros/multa de atraso → receita extra
            }
          }
        } catch (_) { /* ignore item */ }
      }
      return json({ ok: true, sincronizadas: (cobs || []).length });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("asaas-cobranca error", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
