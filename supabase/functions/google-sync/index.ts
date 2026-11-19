// Sincronização BALANX ⇄ Google Agenda / Google Tarefas.
// - Cron (x-cron-secret): todas as conexões. Usuário logado: só a dele.
// - actions: "sincronizar" (padrão) e "agenda-pessoal" {inicio, fim} (eventos da agenda principal, leitura).
// Ida (BALANX → Google): contas a pagar, a receber e fatura do cartão (eventos de dia inteiro na
// agenda "BALANX"), compromissos (eventos) e tarefas (lista "BALANX").
// Volta (Google → BALANX): compromissos e tarefas mudados/criados/apagados lá.
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CAL, FUSO, TASKS, gapi, podeOutrasAgendas, tokenValido } from "../_shared/google.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const APP = "https://app.balanx.com.br";

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
const somaDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Id de evento fixo por item (Google aceita ids próprios em base32hex: 0-9 e a-v).
// Se duas sincronizações tentarem criar o mesmo evento, a segunda recebe 409.
async function idEvento(origem: string, id: string) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${origem}:${id}`)));
  const alfa = "0123456789abcdefghijklmnopqrstuv";
  let bits = 0, val = 0, out = "";
  for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += alfa[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  return `b0${out}`;
}
/** Cria com id fixo; se já existir (409), atualiza. */
async function gravarEvento(token: string, cal: string, id: string, evento: any) {
  const corpo = { ...evento, id, status: "confirmed" };
  let r = await gapi(token, `${CAL}/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(corpo) });
  if (r.status === 409) r = await gapi(token, `${CAL}/calendars/${cal}/events/${id}`, { method: "PUT", body: JSON.stringify(corpo) });
  return r;
}
async function sha(s: string) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)));
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Ida: financeiro → eventos de dia inteiro
// ---------------------------------------------------------------------------
async function financeiroParaEventos(admin: any, integ: any) {
  const op = integ.opcoes || {};
  const ini = somaDias(hojeSP(), -30), fim = somaDias(hojeSP(), 120);
  const eventos: { origem: string; id: string; evento: any }[] = [];
  const dia = (data: string) => ({ start: { date: data }, end: { date: somaDias(data, 1) } });
  const priv = (origem: string, id: string) => ({ extendedProperties: { private: { balanx: "1", origem, origem_id: id } } });
  if (!integ.tenant_id) return eventos;

  if (op.pagar !== false) {
    const { data } = await admin.from("despesas").select("id, descricao, valor, data_vencimento, status, fornecedor")
      .eq("tenant_id", integ.tenant_id).in("status", ["pendente", "atrasado"]).is("fatura_id", null)
      .gte("data_vencimento", ini).lte("data_vencimento", fim).limit(1000);
    for (const d of data || []) {
      if (d.fornecedor === "[pagamento-fatura]") continue;
      const ehFatura = d.fornecedor === "[fatura]";
      if (ehFatura && op.fatura !== true) continue;
      eventos.push({ origem: ehFatura ? "fatura" : "pagar", id: d.id, evento: {
        summary: `${ehFatura ? "💳 Fatura" : "🔴 Pagar"}: ${d.descricao} · ${brl(d.valor)}`,
        description: `${d.fornecedor && !ehFatura ? `Fornecedor: ${d.fornecedor}\n` : ""}${d.status === "atrasado" ? "Atrasado\n" : ""}Abrir no BALANX: ${APP}/fluxo-caixa?tipo=saida&search=${encodeURIComponent(d.descricao)}`,
        ...dia(d.data_vencimento), transparency: "transparent", colorId: "11", ...priv(ehFatura ? "fatura" : "pagar", d.id),
      } });
    }
  }
  if (op.receber !== false) {
    const { data } = await admin.from("receitas").select("id, descricao, valor, data_vencimento, status, cliente:clientes(nome)")
      .eq("tenant_id", integ.tenant_id).in("status", ["pendente", "atrasado"])
      .gte("data_vencimento", ini).lte("data_vencimento", fim).limit(1000);
    for (const r of data || []) {
      const quem = (r as any).cliente?.nome;
      eventos.push({ origem: "receber", id: r.id, evento: {
        summary: `🟢 Receber: ${quem ? `${quem} · ` : ""}${r.descricao} · ${brl(r.valor)}`,
        description: `${r.status === "atrasado" ? "Atrasado\n" : ""}Abrir no BALANX: ${APP}/fluxo-caixa?tipo=entrada&search=${encodeURIComponent(quem || r.descricao)}`,
        ...dia(r.data_vencimento), transparency: "transparent", colorId: "10", ...priv("receber", r.id),
      } });
    }
  }
  return eventos;
}

async function enviarFinanceiro(admin: any, integ: any, token: string) {
  const cal = encodeURIComponent(integ.calendar_id);
  const desejados = await financeiroParaEventos(admin, integ);
  const { data: mapa } = await admin.from("google_eventos").select("origem, origem_id, event_id, hash").eq("user_id", integ.user_id);
  const atual = new Map<string, any>((mapa || []).map((m: any) => [`${m.origem}:${m.origem_id}`, m]));
  let enviados = 0, removidos = 0;
  const vistos = new Set<string>();
  for (const d of desejados) {
    const k = `${d.origem}:${d.id}`;
    vistos.add(k);
    const hash = await sha(JSON.stringify(d.evento));
    const m = atual.get(k);
    if (m && m.hash === hash) continue;
    const r = await gravarEvento(token, cal, await idEvento(d.origem, d.id), d.evento);
    if (!r.ok) continue;
    await admin.from("google_eventos").upsert({ user_id: integ.user_id, origem: d.origem, origem_id: d.id, event_id: r.json.id, hash });
    enviados++;
  }
  // Pago, apagado ou fora da janela: sai da agenda.
  for (const [k, m] of atual) {
    if (vistos.has(k)) continue;
    if (!(await apagarEvento(token, `${CAL}/calendars/${cal}/events/${encodeURIComponent(m.event_id)}`))) continue;
    await admin.from("google_eventos").delete().eq("user_id", integ.user_id).eq("origem", m.origem).eq("origem_id", m.origem_id);
    removidos++;
  }
  return { enviados, removidos };
}

// ---------------------------------------------------------------------------
// Compromissos ⇄ eventos
// ---------------------------------------------------------------------------
function compromissoParaEvento(c: any) {
  const ev: any = {
    summary: c.titulo,
    description: c.notas || undefined,
    extendedProperties: { private: { balanx: "1", origem: "compromisso", origem_id: c.id } },
    reminders: c.lembrete_min != null ? { useDefault: false, overrides: [{ method: "popup", minutes: c.lembrete_min }] } : { useDefault: true },
  };
  if (c.dia_inteiro || !c.inicio) {
    const data = c.data || String(c.inicio).slice(0, 10);
    ev.start = { date: data }; ev.end = { date: somaDias(data, 1) };
  } else {
    const fim = c.fim || new Date(new Date(c.inicio).getTime() + 60 * 60 * 1000).toISOString();
    ev.start = { dateTime: c.inicio, timeZone: FUSO }; ev.end = { dateTime: fim, timeZone: FUSO };
  }
  return ev;
}

async function enviarCompromissos(admin: any, integ: any, token: string) {
  const outras = podeOutrasAgendas(integ.escopos);
  const { data } = await admin.from("agenda_itens").select("*").eq("user_id", integ.user_id).eq("tipo", "compromisso");
  let n = 0;
  for (const c of data || []) {
    if (c.google_event_id && c.google_sync_em && new Date(c.updated_at) <= new Date(c.google_sync_em)) continue;
    // Agenda escolhida (vazio = BALANX). Sem permissão para outras agendas, fica na BALANX.
    const alvo: string = (outras && c.google_calendar_id) || integ.calendar_id;
    const atual: string = c.google_calendar_sync || integ.calendar_id;
    const ev = compromissoParaEvento(c);
    let eventId: string | null = c.google_event_id;
    // Trocou de agenda: move o evento no Google (mantém o mesmo id e quem foi convidado).
    if (eventId && atual !== alvo) {
      const mv = await gapi(token, `${CAL}/calendars/${encodeURIComponent(atual)}/events/${encodeURIComponent(eventId)}/move?destination=${encodeURIComponent(alvo)}`, { method: "POST" });
      if (!mv.ok && mv.status !== 404) continue; // tenta de novo na próxima sincronização
      if (mv.status === 404) eventId = null; // sumiu da agenda antiga: recria na nova
    }
    const cal = encodeURIComponent(alvo);
    // Já existe (veio do Google ou foi movido) → atualiza esse; criado aqui → id fixo.
    const r = eventId && (c.origem === "google" || atual !== alvo)
      ? await gapi(token, `${CAL}/calendars/${cal}/events/${encodeURIComponent(eventId)}`, { method: "PUT", body: JSON.stringify(ev) })
      : await gravarEvento(token, cal, await idEvento("compromisso", c.id), ev);
    if (!r.ok) continue;
    await admin.from("agenda_itens").update({ google_event_id: r.json.id, google_calendar_sync: alvo, google_sync_em: new Date().toISOString() }).eq("id", c.id);
    n++;
  }
  return n;
}

/** Compromissos guardados em OUTRAS agendas (fora da BALANX): lê as mudanças feitas no Google. */
async function receberOutrasAgendas(admin: any, integ: any, token: string) {
  if (!podeOutrasAgendas(integ.escopos)) return 0;
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data } = await admin.from("agenda_itens").select("*").eq("user_id", integ.user_id).eq("tipo", "compromisso")
    .not("google_event_id", "is", null).not("google_calendar_sync", "is", null).neq("google_calendar_sync", integ.calendar_id)
    .or(`inicio.gte.${desde},data.gte.${desde.slice(0, 10)}`).limit(150);
  let recebidos = 0;
  for (const item of data || []) {
    // Mudou aqui e ainda não foi enviado: o BALANX manda primeiro.
    if (item.google_sync_em && new Date(item.updated_at) > new Date(item.google_sync_em)) continue;
    const r = await gapi(token, `${CAL}/calendars/${encodeURIComponent(item.google_calendar_sync)}/events/${encodeURIComponent(item.google_event_id)}`);
    if (r.status === 404 || r.status === 410 || (r.ok && r.json.status === "cancelled")) {
      await admin.from("agenda_itens").delete().eq("id", item.id); recebidos++; continue;
    }
    if (!r.ok) continue;
    const ev = r.json;
    const diaInteiro = !!ev.start?.date;
    const dados: any = {
      titulo: String(ev.summary || "(sem título)").slice(0, 200),
      notas: ev.description || null,
      dia_inteiro: diaInteiro,
      data: diaInteiro ? ev.start.date : null,
      inicio: diaInteiro ? null : ev.start?.dateTime,
      fim: diaInteiro ? null : ev.end?.dateTime,
    };
    const igual = item.titulo === dados.titulo && (item.notas || null) === dados.notas && item.dia_inteiro === dados.dia_inteiro
      && (item.data || null) === dados.data
      && (item.inicio ? new Date(item.inicio).getTime() : null) === (dados.inicio ? new Date(dados.inicio).getTime() : null)
      && (item.fim ? new Date(item.fim).getTime() : null) === (dados.fim ? new Date(dados.fim).getTime() : null);
    if (igual) continue;
    await admin.from("agenda_itens").update({ ...dados, google_sync_em: new Date(Date.now() + 1000).toISOString() }).eq("id", item.id);
    recebidos++;
  }
  return recebidos;
}

/** Mudanças feitas no Google (na agenda BALANX) → compromissos. */
async function receberEventos(admin: any, integ: any, token: string) {
  const cal = encodeURIComponent(integ.calendar_id);
  let syncToken = integ.sync_token as string | null;
  let pageToken: string | null = null;
  let recebidos = 0;
  for (let volta = 0; volta < 20; volta++) {
    const p = new URLSearchParams({ showDeleted: "true", maxResults: "250" });
    if (pageToken) p.set("pageToken", pageToken);
    if (syncToken) p.set("syncToken", syncToken); else p.set("timeMin", new Date(Date.now() - 60 * 86400000).toISOString());
    const r = await gapi(token, `${CAL}/calendars/${cal}/events?${p}`);
    if (r.status === 410) { syncToken = null; pageToken = null; continue; } // token velho: refaz do zero
    if (!r.ok) break;
    for (const ev of r.json.items || []) {
      const priv = ev.extendedProperties?.private || {};
      if (priv.origem && priv.origem !== "compromisso") continue; // eventos do financeiro: só ida
      const { data: item } = await admin.from("agenda_itens").select("*").eq("google_event_id", ev.id).eq("user_id", integ.user_id).maybeSingle();
      // Compromisso que mora em outra agenda (foi movido para lá): o que acontece na BALANX não vale para ele.
      if (item && item.google_calendar_sync && item.google_calendar_sync !== integ.calendar_id) continue;
      if (ev.status === "cancelled") {
        if (item) { await admin.from("agenda_itens").delete().eq("id", item.id); recebidos++; }
        continue;
      }
      const diaInteiro = !!ev.start?.date;
      const dados: any = {
        titulo: String(ev.summary || "(sem título)").slice(0, 200),
        notas: ev.description || null,
        dia_inteiro: diaInteiro,
        data: diaInteiro ? ev.start.date : null,
        inicio: diaInteiro ? null : ev.start?.dateTime,
        fim: diaInteiro ? null : ev.end?.dateTime,
      };
      if (item) {
        const igual = item.titulo === dados.titulo && (item.notas || null) === dados.notas && item.dia_inteiro === dados.dia_inteiro
          && (item.data || null) === dados.data
          && (item.inicio ? new Date(item.inicio).getTime() : null) === (dados.inicio ? new Date(dados.inicio).getTime() : null)
          && (item.fim ? new Date(item.fim).getTime() : null) === (dados.fim ? new Date(dados.fim).getTime() : null);
        if (igual) continue;
        await admin.from("agenda_itens").update({ ...dados, google_sync_em: new Date(Date.now() + 1000).toISOString() }).eq("id", item.id);
      } else {
        await admin.from("agenda_itens").insert({ ...dados, user_id: integ.user_id, tenant_id: integ.tenant_id, tipo: "compromisso",
          origem: "google", google_event_id: ev.id, google_sync_em: new Date(Date.now() + 1000).toISOString() });
      }
      recebidos++;
    }
    pageToken = r.json.nextPageToken || null;
    if (!pageToken) { syncToken = r.json.nextSyncToken || syncToken; break; }
  }
  await admin.from("google_integracoes").update({ sync_token: syncToken }).eq("user_id", integ.user_id);
  return recebidos;
}

// ---------------------------------------------------------------------------
// Tarefas ⇄ Google Tasks (uma ou mais listas)
// ---------------------------------------------------------------------------
/** Listas sincronizadas (opcoes.listas) — a "BALANX" sempre entra — e a padrão. */
function listasDaConexao(integ: any): { listas: string[]; padrao: string | null } {
  const escolhidas: string[] = Array.isArray(integ.opcoes?.listas) ? integ.opcoes.listas.filter(Boolean) : [];
  const listas = [...new Set([...(integ.tasklist_id ? [integ.tasklist_id] : []), ...escolhidas])];
  const padrao = listas.includes(integ.opcoes?.lista_padrao) ? integ.opcoes.lista_padrao : (integ.tasklist_id || listas[0] || null);
  return { listas, padrao };
}

async function sincronizarTarefas(admin: any, integ: any, token: string) {
  const { listas, padrao } = listasDaConexao(integ);
  if (!listas.length || integ.opcoes?.tarefas === false) return { enviadas: 0, recebidas: 0 };
  const marcas: Record<string, string> = { ...(integ.tasks_sync || {}) };
  // Compatibilidade: a lista BALANX usava tasks_sync_em.
  if (integ.tasklist_id && !marcas[integ.tasklist_id] && integ.tasks_sync_em) marcas[integ.tasklist_id] = integ.tasks_sync_em;
  let enviadas = 0, recebidas = 0;
  const depois = () => new Date(Date.now() + 1000).toISOString();

  // Volta: o que mudou em cada lista desde a última leitura.
  for (const listaId of listas) {
    const base = `${TASKS}/lists/${encodeURIComponent(listaId)}/tasks`;
    const inicioLeitura = new Date().toISOString();
    const primeira = !marcas[listaId];
    let pageToken: string | null = null;
    for (let pg = 0; pg < 20; pg++) {
      // 1ª leitura de uma lista: só as em aberto (não traz o histórico de concluídas).
      const p = new URLSearchParams({ maxResults: "100", showCompleted: primeira ? "false" : "true", showHidden: primeira ? "false" : "true", showDeleted: primeira ? "false" : "true" });
      if (!primeira) p.set("updatedMin", new Date(new Date(marcas[listaId]).getTime() - 60_000).toISOString());
      if (pageToken) p.set("pageToken", pageToken);
      const r = await gapi(token, `${base}?${p}`);
      if (!r.ok) break;
      for (const t of r.json.items || []) {
        const { data: item } = await admin.from("agenda_itens").select("*").eq("google_task_id", t.id).eq("user_id", integ.user_id).maybeSingle();
        if (t.deleted) { if (item) { await admin.from("agenda_itens").delete().eq("id", item.id); recebidas++; } continue; }
        const dados = { titulo: String(t.title || "(sem título)").slice(0, 200), notas: t.notes || null,
          data: t.due ? String(t.due).slice(0, 10) : null, concluida: t.status === "completed", google_tasklist_id: listaId, google_tasklist_sync: listaId };
        if (item) {
          if (item.titulo === dados.titulo && (item.notas || null) === dados.notas && (item.data || null) === dados.data
            && item.concluida === dados.concluida && item.google_tasklist_id === listaId) continue;
          if (new Date(item.updated_at) > new Date(t.updated)) continue; // mudou depois aqui: vale o BALANX
          await admin.from("agenda_itens").update({ ...dados, google_sync_em: depois() }).eq("id", item.id);
        } else if (t.title) {
          await admin.from("agenda_itens").insert({ ...dados, user_id: integ.user_id, tenant_id: integ.tenant_id, tipo: "tarefa",
            origem: "google", google_task_id: t.id, google_sync_em: depois() });
        }
        recebidas++;
      }
      pageToken = r.json.nextPageToken || null;
      if (!pageToken) break;
    }
    marcas[listaId] = inicioLeitura;
  }

  // Ida: tarefas criadas/mudadas aqui (as de listas não sincronizadas ficam paradas).
  const { data } = await admin.from("agenda_itens").select("*").eq("user_id", integ.user_id).eq("tipo", "tarefa");
  for (const t of data || []) {
    if (t.google_task_id && t.google_sync_em && new Date(t.updated_at) <= new Date(t.google_sync_em)) continue;
    const destino = t.google_tasklist_id && listas.includes(t.google_tasklist_id) ? t.google_tasklist_id
      : t.google_tasklist_id ? null : padrao;
    if (!destino) continue;
    const corpo: any = { title: t.titulo, notes: t.notas || "", status: t.concluida ? "completed" : "needsAction",
      due: t.data ? `${t.data}T00:00:00.000Z` : null };
    const listaUrl = `${TASKS}/lists/${encodeURIComponent(destino)}/tasks`;
    let res: any = null;
    // Já existe na mesma lista → atualiza; mudou de lista → cria na nova e apaga na antiga.
    const listaAntiga = (t.google_tasklist_sync as string | null) || (t.google_task_id ? integ.tasklist_id : null);
    if (t.google_task_id && listaAntiga === destino) {
      res = await gapi(token, `${listaUrl}/${encodeURIComponent(t.google_task_id)}`, { method: "PATCH", body: JSON.stringify(corpo) });
    }
    if (!res || !res.ok) {
      res = await gapi(token, listaUrl, { method: "POST", body: JSON.stringify(corpo) });
      if (res.ok && t.google_task_id && listaAntiga && listaAntiga !== destino) {
        await gapi(token, `${TASKS}/lists/${encodeURIComponent(listaAntiga)}/tasks/${encodeURIComponent(t.google_task_id)}`, { method: "DELETE" });
      }
    }
    if (!res.ok) continue;
    await admin.from("agenda_itens").update({ google_task_id: res.json.id, google_tasklist_id: destino, google_tasklist_sync: destino, google_sync_em: depois() }).eq("id", t.id);
    enviadas++;
  }
  await admin.from("google_integracoes").update({ tasks_sync: marcas }).eq("user_id", integ.user_id);
  return { enviadas, recebidas };
}

/**
 * Limpeza única: apaga da agenda BALANX os eventos do BALANX criados antes do id fixo
 * (as cópias duplicadas) e zera o mapa; a ida recria cada um uma vez só.
 */
async function limparDuplicados(admin: any, integ: any, token: string) {
  if (integ.opcoes?._ids_v2 || !integ.calendar_id) return;
  const cal = encodeURIComponent(integ.calendar_id);
  // Desvincula os compromissos antes (a volta não pode ler o "apagado" como exclusão).
  await admin.from("agenda_itens").update({ google_event_id: null, google_sync_em: null })
    .eq("user_id", integ.user_id).eq("origem", "balanx").not("google_event_id", "is", null);
  const apagar: string[] = [];
  let pageToken: string | null = null;
  for (let i = 0; i < 40; i++) {
    const p = new URLSearchParams({ privateExtendedProperty: "balanx=1", maxResults: "250", showDeleted: "false" });
    if (pageToken) p.set("pageToken", pageToken);
    const r = await gapi(token, `${CAL}/calendars/${cal}/events?${p}`);
    if (!r.ok) throw new Error(`listar eventos: ${r.status}`);
    for (const ev of r.json.items || []) {
      const pr = ev.extendedProperties?.private || {};
      if (!pr.origem || !pr.origem_id) continue;
      if (ev.id !== await idEvento(pr.origem, pr.origem_id)) apagar.push(ev.id);
    }
    pageToken = r.json.nextPageToken || null;
    if (!pageToken) break;
  }
  for (const id of apagar) {
    await apagarEvento(token, `${CAL}/calendars/${cal}/events/${encodeURIComponent(id)}`);
    await espera(120);
  }
  await admin.from("google_eventos").delete().eq("user_id", integ.user_id);
  integ.opcoes = { ...(integ.opcoes || {}), _ids_v2: true };
  await admin.from("google_integracoes").update({ opcoes: integ.opcoes, sync_token: null }).eq("user_id", integ.user_id);
  integ.sync_token = null;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** DELETE com nova tentativa quando o Google pede calma (403/429/5xx). 404/410 = já foi. */
async function apagarEvento(token: string, url: string): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    const r = await gapi(token, url, { method: "DELETE" });
    if (r.ok || r.status === 404 || r.status === 410) return true;
    if (r.status === 403 || r.status === 429 || r.status >= 500) { await espera(400 * 2 ** i); continue; }
    return false;
  }
  return false;
}

/**
 * Faxina a cada sincronização: na agenda BALANX, todo evento marcado como do BALANX
 * que não está na lista do que deveria existir sai (cópias de rodadas antigas,
 * itens pagos/apagados). Um por vez e dentro do prazo; o resto fica para a próxima.
 */
async function reconciliarAgenda(admin: any, integ: any, token: string, prazo: number) {
  if (!integ.calendar_id) return { apagados: 0, pendentes: 0 };
  const cal = encodeURIComponent(integ.calendar_id);
  const [{ data: mapa }, { data: comps }] = await Promise.all([
    admin.from("google_eventos").select("event_id").eq("user_id", integ.user_id),
    admin.from("agenda_itens").select("google_event_id").eq("user_id", integ.user_id).not("google_event_id", "is", null),
  ]);
  const esperados = new Set<string>([...(mapa || []).map((m: any) => m.event_id), ...(comps || []).map((c: any) => c.google_event_id)]);
  const sobras: string[] = [];
  let pageToken: string | null = null;
  for (let i = 0; i < 40; i++) {
    const p = new URLSearchParams({ privateExtendedProperty: "balanx=1", maxResults: "2500", showDeleted: "false" });
    if (pageToken) p.set("pageToken", pageToken);
    const r = await gapi(token, `${CAL}/calendars/${cal}/events?${p}`);
    if (!r.ok) break;
    for (const ev of r.json.items || []) if (!esperados.has(ev.id)) sobras.push(ev.id);
    pageToken = r.json.nextPageToken || null;
    if (!pageToken) break;
  }
  let apagados = 0;
  for (const id of sobras) {
    if (Date.now() > prazo) break;
    if (await apagarEvento(token, `${CAL}/calendars/${cal}/events/${encodeURIComponent(id)}`)) apagados++;
    await espera(120);
  }
  return { apagados, pendentes: sobras.length - apagados };
}

/** Itens apagados no BALANX: apaga no Google. */
async function limparApagados(admin: any, integ: any, token: string) {
  const { data } = await admin.from("agenda_apagados").select("*").eq("user_id", integ.user_id).limit(200);
  for (const a of data || []) {
    const agenda = a.google_calendar_id || integ.calendar_id;
    if (a.google_event_id && agenda) await gapi(token, `${CAL}/calendars/${encodeURIComponent(agenda)}/events/${encodeURIComponent(a.google_event_id)}`, { method: "DELETE" });
    const lista = a.google_tasklist_id || integ.tasklist_id;
    if (a.google_task_id && lista) await gapi(token, `${TASKS}/lists/${encodeURIComponent(lista)}/tasks/${encodeURIComponent(a.google_task_id)}`, { method: "DELETE" });
    await admin.from("agenda_apagados").delete().eq("id", a.id);
  }
}

async function sincronizarUm(admin: any, integ: any) {
  // Trava: só uma sincronização por vez (5 min de validade, caso a anterior caia).
  const agora = new Date().toISOString();
  const { data: pegou } = await admin.from("google_integracoes")
    .update({ sincronizando_ate: new Date(Date.now() + 5 * 60_000).toISOString() })
    .eq("user_id", integ.user_id).or(`sincronizando_ate.is.null,sincronizando_ate.lt.${agora}`).select("user_id");
  if (!pegou?.length) return { ok: true, em_andamento: true };
  try {
    const prazo = Date.now() + 110_000;
    const token = await tokenValido(admin, integ);
    await limparDuplicados(admin, integ, token);
    await limparApagados(admin, integ, token);
    const recebidos = integ.calendar_id ? (await receberEventos(admin, integ, token)) + (await receberOutrasAgendas(admin, integ, token)) : 0;
    const comp = integ.calendar_id && integ.opcoes?.compromissos !== false ? await enviarCompromissos(admin, integ, token) : 0;
    const fin = integ.calendar_id ? await enviarFinanceiro(admin, integ, token) : { enviados: 0, removidos: 0 };
    const tar = await sincronizarTarefas(admin, integ, token);
    const faxina = await reconciliarAgenda(admin, integ, token, prazo);
    await admin.from("google_integracoes").update({ ultima_sync: new Date().toISOString(), ultimo_erro: null, sincronizando_ate: null }).eq("user_id", integ.user_id);
    return { ok: true, recebidos, compromissos: comp, ...fin, tarefas: tar, faxina };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    await admin.from("google_integracoes").update({ ultimo_erro: msg, sincronizando_ate: null }).eq("user_id", integ.user_id);
    return { ok: false, erro: msg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  // Cron: todas as conexões
  const cron = Deno.env.get("CRON_SECRET");
  if (cron && req.headers.get("x-cron-secret") === cron) {
    const { data } = await admin.from("google_integracoes").select("*").not("refresh_token", "is", null);
    const out = [];
    for (const integ of data || []) {
      if (integ.ultimo_erro === "reconectar") continue;
      out.push(await sincronizarUm(admin, integ));
    }
    return json({ ok: true, conexoes: out.length, resultados: out });
  }

  // Usuário logado
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await anon.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: integ } = await admin.from("google_integracoes").select("*").eq("user_id", user.id).maybeSingle();
  if (!integ) return json({ error: "Google Agenda não conectado." }, 400);

  if (body.action === "listas") {
    try {
      const token = await tokenValido(admin, integ);
      const r = await gapi(token, `${TASKS}/users/@me/lists?maxResults=100`);
      if (!r.ok) return json({ listas: [] });
      return json({ listas: (r.json.items || []).map((l: any) => ({ id: l.id, titulo: l.title, balanx: l.id === integ.tasklist_id })) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "erro" }, 400);
    }
  }

  // Agendas onde a pessoa pode gravar (para escolher onde salvar o compromisso).
  if (body.action === "agendas") {
    const balanx = { id: integ.calendar_id, titulo: "BALANX", cor: null, balanx: true, principal: false };
    if (!integ.calendar_id) return json({ agendas: [], sem_permissao: !podeOutrasAgendas(integ.escopos) });
    if (!podeOutrasAgendas(integ.escopos)) return json({ agendas: [balanx], sem_permissao: true });
    try {
      const token = await tokenValido(admin, integ);
      const r = await gapi(token, `${CAL}/users/me/calendarList?minAccessRole=writer&maxResults=250`);
      if (!r.ok) return json({ agendas: [balanx], sem_permissao: r.status === 403 });
      const lista = (r.json.items || []).map((c: any) => ({
        id: c.id, titulo: c.id === integ.calendar_id ? "BALANX" : (c.summaryOverride || c.summary || "Agenda"),
        cor: c.backgroundColor || null, balanx: c.id === integ.calendar_id, principal: !!c.primary,
      }));
      if (!lista.some((a: any) => a.balanx)) lista.unshift(balanx);
      lista.sort((a: any, b: any) => (a.balanx ? -1 : b.balanx ? 1 : a.principal ? -1 : b.principal ? 1 : a.titulo.localeCompare(b.titulo)));
      return json({ agendas: lista, sem_permissao: false });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "erro" }, 400);
    }
  }

  if (body.action === "agenda-pessoal") {
    if (!String(integ.escopos || "").includes("calendar.events.readonly")) return json({ eventos: [], sem_permissao: true });
    try {
      const token = await tokenValido(admin, integ);
      const p = new URLSearchParams({ timeMin: new Date(String(body.inicio) + "T00:00:00-03:00").toISOString(),
        timeMax: new Date(String(body.fim) + "T23:59:59-03:00").toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      const r = await gapi(token, `${CAL}/calendars/primary/events?${p}`);
      if (!r.ok) return json({ eventos: [] });
      return json({ eventos: (r.json.items || []).filter((e: any) => e.status !== "cancelled").map((e: any) => ({
        id: e.id, titulo: e.summary || "(ocupado)", inicio: e.start?.dateTime || e.start?.date, fim: e.end?.dateTime || e.end?.date,
        dia_inteiro: !!e.start?.date, link: e.htmlLink,
      })) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "erro" }, 400);
    }
  }

  return json(await sincronizarUm(admin, integ));
});
