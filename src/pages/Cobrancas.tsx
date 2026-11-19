import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useActionParam } from '@/hooks/useActionParam';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, addDays, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCobrancas,
  preencherTemplate,
  frasePrazo,
  WHATSAPP_TEMPLATE_PIX_PADRAO,
  COBRANCA_STATUS_LABEL,
  MAX_NOTAS_FISCAIS,
  notasDasLinhas,
  type Cobranca,
  type NotaRef,
} from '@/hooks/useCobrancas';
import { useClientes } from '@/hooks/useClientes';
import { useContas } from '@/hooks/useContas';
import { ConciliacaoSheet } from '@/components/cobrancas/ConciliacaoSheet';
import { InlineNotice, iniciais } from '@/components/cobrancas/formParts';
import { VinculoPickerSheet } from '@/components/cobrancas/VinculoPickerSheet';
import { desvincularCobranca, opcoesReceitas, vincularCobrancaReceita } from '@/lib/vinculoCobranca';
import { CancelarCobrancaDialog } from '@/components/cobrancas/CancelarCobrancaDialog';
import { RegraAutoCobranca, REGRA_PADRAO, regraDaCobranca, type RegraAuto } from '@/components/cobrancas/RegraAutoCobranca';
import { Bloco, Campo, Linha, MenuAcoes, ModalFooter, ModalHeader, ModalShell, PageHeader, Secao, Segmented } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import {
  RefreshCw, Plus, MoreHorizontal, ExternalLink, MessageCircle, HandCoins,
  XCircle, Trash2, Loader2, ChevronDown, ChevronLeft, ChevronRight, Repeat, Wallet,
  Paperclip, FileText, ShieldCheck, Layers, Users, Mail, CalendarOff, CalendarCheck, Search, AlertTriangle, Check, Link2, Unlink, BellRing,
  Copy, Settings2, Landmark, X,
} from 'lucide-react';

const toneCls: Record<string, string> = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  muted: 'bg-surface-2 text-foreground-muted',
};

const MENU_ITEM = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground transition-colors hover:bg-surface-2';
const MENU_ITEM_DANGER = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-danger-fg transition-colors hover:bg-danger-bg';
const CORES_AVATAR = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700'];
const corAvatar = (n: string) => CORES_AVATAR[[...n].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % CORES_AVATAR.length];

const FORMA_LABEL: Record<string, string> = {
  PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: 'Cliente escolhe',
};

const FORMAS = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

type TipoFiltro = 'todas' | 'recorrente' | 'avulsa';
// Cobrança exibida = fatura; `linhas` = uma por contrato quando agrupada.
type FaturaView = Cobranca & { linhas: Cobranca[]; notas: NotaRef[] };
type SortKey = 'cliente' | 'descricao' | 'tipo' | 'valor' | 'vencimento' | 'status';
// A lista é agrupada por situação; dentro de cada grupo, por vencimento.
const SORT: { key: SortKey; dir: 'asc' | 'desc' } = { key: 'vencimento', dir: 'asc' };

function statusPill(status: string) {
  const meta = COBRANCA_STATUS_LABEL[status] ?? { label: status, tone: 'muted' as const };
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold', toneCls[meta.tone])}>{meta.label}</span>;
}

/** Motivo de falha do Resend em português (o webhook grava o código cru). */
function motivoEmail(erro: string | null) {
  const e = String(erro || '');
  if (/invalid_attachment/i.test(e)) return 'não foi possível anexar o PDF (nota fiscal ou boleto). Reenvie.';
  if (/suppress/i.test(e)) return 'endereço bloqueado por devoluções anteriores.';
  if (/mailbox|does not exist|user unknown|no such user/i.test(e)) return 'a caixa de e-mail não existe.';
  return e || 'falha no envio';
}

/** "Vai anexar" no envio manual: lista as notas fiscais com link para ver cada uma. */
function NotasAnexo({ notas, onVer }: { notas: NotaRef[]; onVer: (path: string) => void }) {
  return (
    <div className="space-y-1">
      <p>Vai anexar {notas.length > 1 ? `${notas.length} notas fiscais:` : 'a nota fiscal:'}</p>
      <ul className="space-y-0.5">
        {notas.map((n) => (
          <li key={n.path} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-foreground-muted">{n.nome}</span>
            <button onClick={() => onVer(n.path)} className="shrink-0 font-medium text-primary hover:underline">ver</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Cobrancas() {
  const {
    cobrancas, loading, busyId,
    criarAvulsa, criarAvulsaParcelada, cancelar, cancelarSoEsta, removerDoHistorico, excluir, sincronizar, receberManual, atualizarConta, atualizarCliente, atualizarForma, enviarWhatsapp, enviarEmail,
    anexarNotas, removerNota, setExigirNf, setEnvioPix, salvarRegra, notaSignedUrl, marcarNotasEnviadas, conciliarListar, conciliarAplicar, whatsappTemplate, pixCfg, emailCfg,
    fimSemanaPadrao, setFimSemanaPadrao, setEnviarFimSemana, reload,
  } = useCobrancas();
  const [conciliarOpen, setConciliarOpen] = useState(false);
  // Vínculo manual cobrança ↔ lançamento (só cobrança de uma linha; fatura agrupada usa a conciliação)
  const [vinculoCob, setVinculoCob] = useState<FaturaView | null>(null);
  // Cancelar/remover: abre a escolha (só esta, encerrar assinatura, histórico).
  const [cancelando, setCancelando] = useState<FaturaView | null>(null);
  const desvincular = async (cob: FaturaView) => {
    if (!window.confirm('Desvincular o lançamento desta cobrança? O lançamento continua no fluxo de caixa.')) return;
    try {
      await desvincularCobranca(cob.id);
      toast.success('Lançamento desvinculado.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desvincular');
    }
  };
  // Seleção em massa (por fatura) para ativar/desativar envio no fim de semana.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const semReceita = useMemo(
    () => cobrancas.filter((c) => !c.receita_id && c.status !== 'cancelado' && c.status !== 'estornado').length,
    [cobrancas],
  );
  const { clientes } = useClientes();
  const { contas } = useContas();

  const clienteById = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  // Contratos ativos (vincular cobrança avulsa/parcelada a um contrato do cliente).
  const [contratosAtivos, setContratosAtivos] = useState<{ id: string; descricao: string; cliente_id: string | null }[]>([]);
  useEffect(() => {
    supabase.from('contratos').select('id, descricao, cliente_id').eq('status', 'ativo').order('descricao')
      .then(({ data }) => setContratosAtivos((data || []) as { id: string; descricao: string; cliente_id: string | null }[]));
  }, []);
  const contratosDo = useCallback((clienteId: string | null | undefined) => contratosAtivos.filter((c) => c.cliente_id && c.cliente_id === clienteId), [contratosAtivos]);
  const nomeContrato = useCallback((id: string | null | undefined) => (id && contratosAtivos.find((c) => c.id === id)?.descricao) || null, [contratosAtivos]);
  const contaById = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todas');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [busca, setBusca] = useState('');

  // Período (por vencimento): mês com ‹ ›, intervalo personalizado, ou tudo.
  const [periodoModo, setPeriodoModo] = useState<'mes' | 'custom' | 'tudo'>('mes');
  const [mesRef, setMesRef] = useState(format(new Date(), 'yyyy-MM'));
  const [customDe, setCustomDe] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customAte, setCustomAte] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const periodo = useMemo<{ de: string; ate: string } | null>(() => {
    if (periodoModo === 'tudo') return null;
    if (periodoModo === 'custom') return { de: customDe, ate: customAte };
    return { de: `${mesRef}-01`, ate: format(endOfMonth(parseISO(`${mesRef}-01`)), 'yyyy-MM-dd') };
  }, [periodoModo, mesRef, customDe, customAte]);
  const noPeriodo = (venc: string | null) => !periodo || (!!venc && venc >= periodo.de && venc <= periodo.ate);

  // Totais do período selecionado (por vencimento), ignorando canceladas.
  const totais = useMemo(() => {
    let aReceber = 0, vencido = 0, recebido = 0;
    for (const c of cobrancas) {
      if (!noPeriodo(c.vencimento)) continue;
      const v = Number(c.valor) || 0;
      if (c.status === 'pendente') aReceber += v;
      else if (c.status === 'vencido') vencido += v;
      else if (c.status === 'pago') recebido += v;
    }
    // Quantidade por fatura (boleto agrupado conta uma vez), no período.
    const qtd = { pendente: 0, vencido: 0, pago: 0, cancelado: 0 };
    const vistos = new Set<string>();
    for (const c of cobrancas) {
      if (!noPeriodo(c.vencimento)) continue;
      const k = c.asaas_payment_id || c.id;
      if (vistos.has(k)) continue;
      vistos.add(k);
      if (c.status === 'pendente' || c.status === 'vencido' || c.status === 'pago') qtd[c.status]++;
      else if (c.status === 'cancelado' || c.status === 'estornado') qtd.cancelado++;
    }
    return { aReceber, vencido, recebido, qtd };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrancas, periodo]);

  // Uma linha por FATURA: contratos agrupados numa assinatura dividem um boleto
  // (valor = soma das partes, descrição "A + B"); as ações valem para o grupo.
  const faturasView = useMemo<FaturaView[]>(() => {
    const grupos = new Map<string, Cobranca[]>();
    for (const c of cobrancas) {
      const k = c.asaas_payment_id || c.id;
      grupos.set(k, [...(grupos.get(k) || []), c]);
    }
    return [...grupos.values()].map((ls) => {
      const linhas = [...ls].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id.localeCompare(b.id));
      const p = linhas[0];
      const notas = notasDasLinhas(linhas);
      if (linhas.length === 1) return { ...p, linhas, notas };
      return {
        ...p,
        valor: Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100,
        descricao: linhas.map((l) => l.descricao).filter(Boolean).join(' + '),
        receita_id: linhas.every((l) => l.receita_id) ? p.receita_id : null,
        nota_fiscal_enviada: linhas.some((l) => l.nota_fiscal_enviada),
        exigir_nf: linhas.some((l) => l.exigir_nf),
        envio_pix: linhas.some((l) => l.envio_pix),
        linhas,
        notas,
      };
    });
  }, [cobrancas]);

  const filtradas = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const list = faturasView.filter((c) => {
      if (!noPeriodo(c.vencimento)) return false;
      if (tipoFiltro === 'recorrente' && c.tipo !== 'recorrente') return false;
      if (tipoFiltro === 'avulsa' && c.tipo === 'recorrente') return false;
      const cancelada = c.status === 'cancelado' || c.status === 'estornado';
      if (statusFiltro === 'todos' ? cancelada : statusFiltro === 'cancelado' ? !cancelada : c.status !== statusFiltro) return false;
      if (term) {
        const nome = (c.cliente_id && clienteById.get(c.cliente_id)?.nome) || '';
        if (!nome.toLowerCase().includes(term) && !(c.descricao || '').toLowerCase().includes(term)) return false;
      }
      return true;
    });
    const dir = SORT.dir === 'asc' ? 1 : -1;
    const val = (c: Cobranca): string | number => {
      switch (SORT.key) {
        case 'cliente': return ((c.cliente_id && clienteById.get(c.cliente_id)?.nome) || '').toLowerCase();
        case 'descricao': return (c.descricao || '').toLowerCase();
        case 'tipo': return c.tipo;
        case 'valor': return Number(c.valor) || 0;
        case 'vencimento': return c.vencimento || '';
        case 'status': return c.status;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturasView, tipoFiltro, statusFiltro, busca, clienteById, periodo]);

  // ===== Seleção em massa (fim de semana) =====
  const toggleSel = (id: string) => setSelecionadas((prev) => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const todasSelecionadas = filtradas.length > 0 && filtradas.every((c) => selecionadas.has(c.id));
  const toggleTodas = () => setSelecionadas((prev) =>
    prev.size >= filtradas.length && filtradas.every((c) => prev.has(c.id)) ? new Set() : new Set(filtradas.map((c) => c.id)));
  const limparSel = () => setSelecionadas(new Set());
  const aplicarFimSemana = async (value: boolean) => {
    // Junta as linhas de todas as faturas selecionadas (grupo vale para todas).
    const ids = filtradas.filter((c) => selecionadas.has(c.id)).flatMap((c) => c.linhas.map((l) => l.id));
    if (!ids.length) return;
    setBulkBusy(true);
    const ok = await setEnviarFimSemana(ids, value);
    setBulkBusy(false);
    if (ok) setSelecionadas(new Set());
  };

  // ===== WhatsApp =====
  const [waOpen, setWaOpen] = useState(false);
  const [waTel, setWaTel] = useState('');
  const [waText, setWaText] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waCob, setWaCob] = useState<FaturaView | null>(null);
  const openWhatsapp = (cob: FaturaView) => {
    const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
    setWaCob(cob);
    setWaTel(cli?.telefone || '');
    const usaPix = !!cob.envio_pix && !!pixCfg.chave;
    const diff = differenceInCalendarDays(parseISO(cob.vencimento), new Date());
    setWaText(preencherTemplate(usaPix ? (pixCfg.template || WHATSAPP_TEMPLATE_PIX_PADRAO) : whatsappTemplate, {
      cliente: cli?.nome || 'cliente',
      descricao: cob.descricao || 'cobrança',
      valor: formatCurrency(Number(cob.valor)),
      vencimento: formatDate(cob.vencimento),
      prazo: frasePrazo(diff),
      dias: String(Math.abs(diff)),
      link: cob.invoice_url || '',
      pix: pixCfg.chave,
      titular: pixCfg.titular,
    }));
    setWaOpen(true);
  };
  const waBloqueado = !!waCob?.exigir_nf && !waCob?.notas.length && !waCob?.nota_fiscal_enviada;
  const handleEnviarWa = async () => {
    if (!waCob) return;
    if (waBloqueado) { toast.error('Esta cobrança exige nota fiscal anexada para disparar.'); return; }
    setWaSending(true);
    // Gera os links na ordem das notas; para na 1ª falha (a função confirma as N primeiras).
    const docs: { url: string; nome: string }[] = [];
    for (const n of waCob.notas) {
      const url = await notaSignedUrl(n.path);
      if (!url) break;
      docs.push({ url, nome: n.nome });
    }
    const res = await enviarWhatsapp(waTel, waText, docs);
    setWaSending(false);
    if (res) {
      // PDFs com envio confirmado → apaga do Storage pra não ocupar espaço.
      await marcarNotasEnviadas(waCob.notas.slice(0, res.docsEnviados));
      if (res.docsEnviados < waCob.notas.length) {
        toast.warning(`${waCob.notas.length - res.docsEnviados} nota(s) fiscal(is) não foram enviadas e continuam anexadas.`);
      }
      setWaOpen(false);
    }
  };

  // ===== E-mail =====
  const [emOpen, setEmOpen] = useState(false);
  const [emCob, setEmCob] = useState<FaturaView | null>(null);
  const [emPara, setEmPara] = useState('');
  const [emIntro, setEmIntro] = useState('');
  const [emSending, setEmSending] = useState(false);

  // E-mails que falharam (registro email_envios, atualizado pelo webhook do Resend)
  type FalhaEmail = { id: string; cobranca_id: string | null; para: string; assunto: string | null; status: string; erro: string | null; created_at: string };
  const [falhasEmail, setFalhasEmail] = useState<FalhaEmail[]>([]);
  const carregarFalhasEmail = useCallback(async () => {
    // email_envios ainda não está nos tipos gerados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('email_envios')
      .select('id, cobranca_id, para, assunto, status, erro, created_at')
      .in('status', ['falhou', 'devolvido', 'spam']).eq('visto', false)
      .gte('created_at', format(addDays(new Date(), -30), 'yyyy-MM-dd'))
      .order('created_at', { ascending: false }).limit(10);
    const falhas = (data || []) as FalhaEmail[];
    // Falha já resolvida: a mesma cobrança foi reenviada depois para o mesmo e-mail e saiu.
    const ids = [...new Set(falhas.map((f) => f.cobranca_id).filter(Boolean))];
    let ok: { cobranca_id: string; para: string; created_at: string }[] = [];
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).from('email_envios').select('cobranca_id, para, created_at')
        .in('cobranca_id', ids).in('status', ['enviado', 'entregue', 'atrasado']);
      ok = r.data || [];
    }
    const mesmo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    setFalhasEmail(falhas.filter((f) => !ok.some((o) =>
      o.cobranca_id === f.cobranca_id && mesmo(o.para, f.para) && o.created_at > f.created_at)));
  }, []);
  // A falha chega pelo webhook segundos (ou minutos) depois do envio: recarrega ao
  // voltar para a aba e a cada minuto enquanto a tela está aberta.
  useEffect(() => {
    carregarFalhasEmail();
    const onFocus = () => { if (document.visibilityState === 'visible') carregarFalhasEmail(); };
    document.addEventListener('visibilitychange', onFocus);
    const t = window.setInterval(onFocus, 60_000);
    return () => { document.removeEventListener('visibilitychange', onFocus); window.clearInterval(t); };
  }, [carregarFalhasEmail]);
  // Logo após um envio manual, acompanha o status daquele e-mail por ~40s.
  const acompanharEnvio = (resendId: string, para: string) => {
    let feito = false;
    for (const ms of [4_000, 12_000, 40_000]) {
      window.setTimeout(async () => {
        if (feito) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).from('email_envios').select('status, erro').eq('resend_id', resendId).maybeSingle();
        if (!data) return;
        if (['falhou', 'devolvido', 'spam'].includes(data.status)) {
          feito = true;
          toast.error(`O e-mail para ${para} não foi entregue: ${motivoEmail(data.erro)}`, { duration: 12000 });
          carregarFalhasEmail();
        } else if (data.status === 'entregue') {
          feito = true;
        }
      }, ms);
    }
  };
  const dispensarFalha = async (id: string) => {
    setFalhasEmail((f) => f.filter((x) => x.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('email_envios').update({ visto: true }).eq('id', id);
  };
  const openEmail = (cob: FaturaView) => {
    const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
    const usaPix = !!cob.envio_pix && !!pixCfg.chave;
    // Corpo prefillado com o template salvo no Meu Perfil (ou um padrão), já substituído.
    const corpoTpl = emailCfg.corpo || 'Sua cobrança de {descricao} {prazo}. Qualquer dúvida, é só responder este e-mail.';
    const diff = differenceInCalendarDays(parseISO(cob.vencimento), new Date());
    setEmCob(cob);
    setEmPara(cli?.email || '');
    setEmIntro(preencherTemplate(corpoTpl, {
      cliente: cli?.nome || 'cliente',
      descricao: cob.descricao || 'cobrança',
      valor: formatCurrency(Number(cob.valor)),
      vencimento: formatDate(cob.vencimento),
      prazo: frasePrazo(diff),
      dias: String(Math.abs(diff)),
      link: cob.invoice_url || '',
      pix: usaPix ? pixCfg.chave : '',
      titular: usaPix ? pixCfg.titular : '',
    }));
    setEmOpen(true);
  };
  const emBloqueado = !!emCob?.exigir_nf && !emCob?.notas.length && !emCob?.nota_fiscal_enviada;
  const handleEnviarEmail = async () => {
    if (!emCob) return;
    if (emBloqueado) { toast.error('Esta cobrança exige nota fiscal anexada para disparar.'); return; }
    const cli = emCob.cliente_id ? clienteById.get(emCob.cliente_id) : undefined;
    const usaPix = !!emCob.envio_pix && !!pixCfg.chave;
    setEmSending(true);
    const res = await enviarEmail({
      cobranca_id: emCob.id,
      para: emPara.trim(),
      cliente: cli?.nome || 'cliente',
      descricao: emCob.descricao || 'cobrança',
      valor: formatCurrency(Number(emCob.valor)),
      vencimento: formatDate(emCob.vencimento),
      prazo: frasePrazo(differenceInCalendarDays(parseISO(emCob.vencimento), new Date())),
      dias: String(Math.abs(differenceInCalendarDays(parseISO(emCob.vencimento), new Date()))),
      // Chave PIX no lugar do boleto/link do Asaas (igual ao WhatsApp)
      link: usaPix ? null : (emCob.invoice_url || null),
      pix: usaPix ? pixCfg.chave : null,
      titular: usaPix ? pixCfg.titular : null,
      intro: emIntro.trim() || null,
      notas: emCob.notas.map(({ path, nome }) => ({ path, nome })),
      forma: emCob.forma_pagamento || null,
      asaas_payment_id: emCob.asaas_payment_id || null,
    });
    setEmSending(false);
    carregarFalhasEmail();
    if (res?.resendId) acompanharEnvio(res.resendId, emPara.trim());
    if (res) {
      await marcarNotasEnviadas(emCob.notas.slice(0, res.docsEnviados));
      if (res.docsEnviados < emCob.notas.length) {
        toast.warning(`${emCob.notas.length - res.docsEnviados} nota(s) fiscal(is) não foram anexadas e continuam na cobrança.`);
      }
      setEmOpen(false);
    }
  };

  // ===== Regra de envio automático de uma cobrança (e vínculo com contrato) =====
  const [regraCob, setRegraCob] = useState<FaturaView | null>(null);
  const [regraVal, setRegraVal] = useState<RegraAuto>(REGRA_PADRAO);
  const [regraContrato, setRegraContrato] = useState('');
  const [regraTodas, setRegraTodas] = useState(true);
  const [regraSaving, setRegraSaving] = useState(false);
  const irmas = useCallback((c: FaturaView | null) => (c?.grupo_id ? cobrancas.filter((x) => x.grupo_id === c.grupo_id) : []), [cobrancas]);
  const abrirRegra = (cob: FaturaView) => {
    setRegraCob(cob); setRegraVal(regraDaCobranca(cob)); setRegraContrato(cob.contrato_id || ''); setRegraTodas(true);
  };
  const salvarRegraCob = async () => {
    if (!regraCob) return;
    const grupo = irmas(regraCob);
    const ids = regraTodas && grupo.length > 1 ? grupo.map((x) => x.id) : regraCob.linhas.map((l) => l.id);
    // Cobrança de assinatura já tem contrato (não troca por aqui).
    const contrato = regraCob.tipo === 'recorrente' ? undefined : (regraContrato || null);
    setRegraSaving(true);
    const ok = await salvarRegra(ids, regraVal, contrato === (regraCob.contrato_id || null) ? undefined : contrato);
    setRegraSaving(false);
    if (ok) setRegraCob(null);
  };

  // ===== Nova cobrança avulsa =====
  const [avulsaOpen, setAvulsaOpen] = useState(false);
  const emptyAvulsa = { cliente_id: '', valor: '', vencimento: '', descricao: '', forma: 'UNDEFINED', conta_id: '', multa: '', juros: '' };
  const [avulsa, setAvulsa] = useState(emptyAvulsa);
  const [avulsaSaving, setAvulsaSaving] = useState(false);
  const [avContrato, setAvContrato] = useState('');
  const [avRegra, setAvRegra] = useState<RegraAuto>(REGRA_PADRAO);
  // Parcelamento com datas/valores personalizados
  const [parcelar, setParcelar] = useState(false);
  const emptyPc = { total: '', count: 4, intervalo: 30, first: format(new Date(), 'yyyy-MM-dd') };
  const [pc, setPc] = useState(emptyPc);
  const [pcRows, setPcRows] = useState<{ valor: string; vencimento: string }[]>([]);
  const gerarParcelas = () => {
    const total = parseFloat(pc.total) || 0;
    const n = Math.max(2, Math.min(60, Math.floor(Number(pc.count)) || 2));
    const interval = Math.max(1, Math.floor(Number(pc.intervalo)) || 30);
    const first = pc.first || format(new Date(), 'yyyy-MM-dd');
    const base = Math.floor((total / n) * 100) / 100;
    const last = Math.round((total - base * (n - 1)) * 100) / 100;
    setPcRows(Array.from({ length: n }, (_, i) => ({
      valor: (i === n - 1 ? last : base).toFixed(2),
      vencimento: format(addDays(parseISO(first), i * interval), 'yyyy-MM-dd'),
    })));
  };
  const somaParcelas = useMemo(() => pcRows.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0), [pcRows]);
  const abrirAvulsa = () => { setAvulsa(emptyAvulsa); setParcelar(false); setPc(emptyPc); setPcRows([]); setAvContrato(''); setAvRegra(REGRA_PADRAO); setAvulsaOpen(true); };
  useActionParam('novo', abrirAvulsa);
  useActionParam('conciliar', () => setConciliarOpen(true));
  const handleCriarAvulsa = async () => {
    if (!avulsa.cliente_id) return;
    if (parcelar) {
      const parcelas = pcRows
        .map((r) => ({ valor: parseFloat(r.valor) || 0, vencimento: r.vencimento }))
        .filter((r) => r.valor > 0 && r.vencimento);
      if (parcelas.length < 2) { toast.error('Gere ao menos 2 parcelas com valor e data.'); return; }
      setAvulsaSaving(true);
      const d = await criarAvulsaParcelada({
        cliente_id: avulsa.cliente_id, descricao: avulsa.descricao || undefined,
        forma_pagamento: avulsa.forma, conta_id: avulsa.conta_id || null, parcelas,
        multa_percent: parseFloat(avulsa.multa) || 0, juros_percent: parseFloat(avulsa.juros) || 0,
        contrato_id: avContrato || null, regra: avRegra,
      });
      setAvulsaSaving(false);
      if (d) setAvulsaOpen(false);
      return;
    }
    if (!avulsa.valor || !avulsa.vencimento) return;
    setAvulsaSaving(true);
    const d = await criarAvulsa({
      cliente_id: avulsa.cliente_id,
      valor: parseFloat(avulsa.valor) || 0,
      vencimento: avulsa.vencimento,
      descricao: avulsa.descricao || undefined,
      forma_pagamento: avulsa.forma,
      conta_id: avulsa.conta_id || null,
      multa_percent: parseFloat(avulsa.multa) || 0,
      juros_percent: parseFloat(avulsa.juros) || 0,
      contrato_id: avContrato || null,
      regra: avRegra,
    });
    setAvulsaSaving(false);
    if (d) setAvulsaOpen(false);
  };

  const clientesAtivos = useMemo(
    () => [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [clientes],
  );

  const contasRecebimento = useMemo(() => contas.filter((c) => c.tipo !== 'cartao_credito' && c.ativa), [contas]);

  // ===== Definir/alterar conta de recebimento =====
  const [contaOpen, setContaOpen] = useState(false);
  const [contaCob, setContaCob] = useState<Cobranca | null>(null);
  const [contaSel, setContaSel] = useState('');
  const [contaSaving, setContaSaving] = useState(false);
  const abrirConta = (cob: Cobranca) => { setContaCob(cob); setContaSel(cob.conta_id || ''); setContaOpen(true); };
  const handleSalvarConta = async () => {
    if (!contaCob) return;
    setContaSaving(true);
    const ok = await atualizarConta(contaCob.id, contaSel || null);
    setContaSaving(false);
    if (ok) setContaOpen(false);
  };

  // ===== Vincular cliente (cobrança que veio do Asaas sem cliente) =====
  const [clienteOpen, setClienteOpen] = useState(false);
  const [clienteCob, setClienteCob] = useState<Cobranca | null>(null);
  const [clienteSel, setClienteSel] = useState('');
  const [clienteSaving, setClienteSaving] = useState(false);
  const normNome = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const abrirCliente = (cob: Cobranca) => {
    setClienteCob(cob);
    // Sugere automaticamente o cliente do BALANX cujo nome casa com o do Asaas.
    let sel = cob.cliente_id || '';
    if (!sel && cob.asaas_customer_nome) {
      const alvo = normNome(cob.asaas_customer_nome);
      const match = clientes.find((c) => normNome(c.nome) === alvo)
        || clientes.find((c) => normNome(c.nome).includes(alvo) || alvo.includes(normNome(c.nome)));
      if (match) sel = match.id;
    }
    setClienteSel(sel);
    setClienteOpen(true);
  };
  const handleSalvarCliente = async () => {
    if (!clienteCob) return;
    setClienteSaving(true);
    const ok = await atualizarCliente(clienteCob.id, clienteSel || null);
    setClienteSaving(false);
    if (ok) setClienteOpen(false);
  };
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')),
    [clientes],
  );

  // ===== Alterar forma de recebimento =====
  const [formaOpen, setFormaOpen] = useState(false);
  const [formaCob, setFormaCob] = useState<Cobranca | null>(null);
  const [formaSel, setFormaSel] = useState('UNDEFINED');
  const [formaSaving, setFormaSaving] = useState(false);
  const abrirForma = (cob: Cobranca) => { setFormaCob(cob); setFormaSel(cob.forma_pagamento || 'UNDEFINED'); setFormaOpen(true); };
  const handleSalvarForma = async () => {
    if (!formaCob) return;
    setFormaSaving(true);
    const ok = await atualizarForma(formaCob.id, formaSel);
    setFormaSaving(false);
    if (ok) setFormaOpen(false);
  };

  // ===== Nota fiscal (PDF) =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ id: string; jaNaFatura: number } | null>(null);
  // Numa fatura agrupada as notas ficam numa linha só (a que já tem nota, ou a 1ª);
  // as das outras linhas contam no limite de 10.
  const pedirUploadNota = (cob: FaturaView) => {
    if (cob.notas.length >= MAX_NOTAS_FISCAIS) { toast.error(`Limite de ${MAX_NOTAS_FISCAIS} notas fiscais por cobrança.`); return; }
    const id = cob.notas[0]?.cobranca_id ?? cob.id;
    uploadTargetRef.current = { id, jaNaFatura: cob.notas.filter((n) => n.cobranca_id !== id).length };
    fileInputRef.current?.click();
  };
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const alvo = uploadTargetRef.current;
    e.target.value = '';
    if (files.length && alvo) await anexarNotas(alvo.id, files, alvo.jaNaFatura);
  };
  const abrirNota = async (path: string) => {
    const url = await notaSignedUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  // ===== Detalhe da cobrança (tudo que antes ficava no ⋯, organizado) =====
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const detalhe = useMemo(() => (detalheId ? faturasView.find((f) => f.id === detalheId) ?? null : null), [detalheId, faturasView]);
  // Abre outra ação a partir do detalhe: fecha o detalhe antes (sem modal sobre modal).
  const doDetalhe = (fn: () => void) => { setDetalheId(null); window.setTimeout(fn, 150); };
  type EnvioEmail = { id: string; para: string; status: string; created_at: string };
  const [enviosDetalhe, setEnviosDetalhe] = useState<EnvioEmail[]>([]);
  useEffect(() => {
    if (!detalhe) { setEnviosDetalhe([]); return; }
    const ids = detalhe.linhas.map((l) => l.id);
    // email_envios ainda não está nos tipos gerados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('email_envios').select('id, para, status, created_at').in('cobranca_id', ids)
      .order('created_at', { ascending: false }).limit(8)
      .then(({ data }: { data: EnvioEmail[] | null }) => setEnviosDetalhe(data || []));
  }, [detalhe?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const copiarLink = async (cob: Cobranca) => {
    if (!cob.invoice_url) { toast.error('Esta cobrança não tem link de pagamento.'); return; }
    try { await navigator.clipboard.writeText(cob.invoice_url); toast.success('Link copiado.'); } catch { toast.error('Não consegui copiar o link.'); }
  };

  // ⋯ da lista: só o básico do dia a dia; o resto fica no detalhe.
  const AcoesMenu = ({ cob }: { cob: FaturaView }) => {
    const busy = busyId === cob.id;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button aria-label="Ações da cobrança" onClick={(e) => e.stopPropagation()} className="no-touch-min grid h-9 w-9 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 rounded-2xl border border-border bg-surface p-1.5" onClick={(e) => e.stopPropagation()}>
          {cob.invoice_url && (
            <a href={cob.invoice_url} target="_blank" rel="noopener noreferrer" className={MENU_ITEM}>
              <ExternalLink className="h-4 w-4" /> Abrir link de pagamento
            </a>
          )}
          <button onClick={() => openWhatsapp(cob)} className={MENU_ITEM}><MessageCircle className="h-4 w-4" /> Enviar por WhatsApp</button>
          <button onClick={() => openEmail(cob)} className={MENU_ITEM}><Mail className="h-4 w-4" /> Enviar por e-mail</button>
          {cob.invoice_url && <button onClick={() => copiarLink(cob)} className={MENU_ITEM}><Copy className="h-4 w-4" /> Copiar link</button>}
          <div className="my-1 h-px bg-border" />
          <button onClick={() => setDetalheId(cob.id)} className={cn(MENU_ITEM, 'font-medium')}><Settings2 className="h-4 w-4" /> Ver detalhes e ajustes</button>
        </PopoverContent>
      </Popover>
    );
  };

  // ===== Grupos por situação =====
  const hojeStr = format(new Date(), 'yyyy-MM-dd');
  const em7 = format(addDays(new Date(), 6), 'yyyy-MM-dd');
  const grupos = useMemo(() => {
    const byVenc = (a: FaturaView, b: FaturaView) => (a.vencimento || '').localeCompare(b.vencimento || '');
    const out: { titulo: string; cor?: string; itens: FaturaView[] }[] = [
      { titulo: 'Vencidas', cor: 'text-danger-fg', itens: filtradas.filter((c) => c.status === 'vencido').sort(byVenc) },
      { titulo: 'Vencem esta semana', itens: filtradas.filter((c) => c.status === 'pendente' && (c.vencimento || '') <= em7).sort(byVenc) },
      { titulo: 'Mais adiante', itens: filtradas.filter((c) => c.status === 'pendente' && (c.vencimento || '') > em7).sort(byVenc) },
      { titulo: 'Pagas', cor: 'text-success-fg', itens: filtradas.filter((c) => c.status === 'pago').sort((a, b) => (b.data_pagamento || b.vencimento || '').localeCompare(a.data_pagamento || a.vencimento || '')) },
      { titulo: 'Canceladas e estornadas', cor: 'text-foreground-muted', itens: filtradas.filter((c) => c.status === 'cancelado' || c.status === 'estornado').sort(byVenc) },
    ];
    return out.filter((g) => g.itens.length);
  }, [filtradas, em7]);

  const quando = (c: FaturaView) => {
    if (c.status === 'pago') return { txt: c.data_pagamento ? `paga em ${formatDate(c.data_pagamento)}` : 'paga', cor: 'text-success-fg' };
    if (c.status === 'cancelado' || c.status === 'estornado') return { txt: COBRANCA_STATUS_LABEL[c.status]?.label.toLowerCase() || c.status, cor: 'text-foreground-muted' };
    const d = differenceInCalendarDays(parseISO(c.vencimento), new Date());
    if (d < 0) return { txt: `atrasada há ${-d} dia${d === -1 ? '' : 's'}`, cor: 'text-danger-fg' };
    if (d === 0) return { txt: 'vence hoje', cor: 'text-warning-fg' };
    if (d === 1) return { txt: 'vence amanhã', cor: 'text-foreground' };
    return { txt: `vence em ${d} dias`, cor: 'text-foreground-muted' };
  };

  const STATUS_ABAS: [string, string, string][] = [
    ['pendente', 'Em aberto', 'text-foreground'],
    ['vencido', 'Vencidas', 'text-danger-fg'],
    ['pago', 'Pagas', 'text-success-fg'],
    ['todos', 'Todas do período', 'text-foreground'],
  ];
  const nomeCob = (c: Cobranca) => (c.cliente_id && clienteById.get(c.cliente_id)?.nome) || c.asaas_customer_nome || '';
  const canceladasQtd = totais.qtd.cancelado;

  // Regras de envio: o mesmo conteúdo serve ao botão do desktop e ao ícone do celular.
  const regrasConteudo = (
          <PopoverContent align="end" className="w-80 rounded-2xl border border-border bg-surface p-4">
      <p className="text-[14px] font-semibold text-foreground">Regras de envio (padrão)</p>
      <p className="mb-3 text-[12px] text-foreground-muted">Valem para toda cobrança sem regra própria.</p>
      <div className="flex items-center justify-between gap-3 border-t border-border py-2.5">
        <span><span className="block text-[13.5px] text-foreground">Enviar no fim de semana</span><span className="block text-[11.5px] text-foreground-muted">Desligado: segura sáb/dom e envia na segunda</span></span>
        <Switch checked={fimSemanaPadrao} onCheckedChange={setFimSemanaPadrao} aria-label="Enviar no fim de semana (padrão)" />
      </div>
      <Link to="/perfil" className="mt-1 flex items-center justify-between border-t border-border pt-2.5 text-[13px] text-primary hover:underline">
        Lembretes, dias e mensagens <ChevronRight className="h-4 w-4" />
      </Link>
    </PopoverContent>
  );

  return (
    <main className="container space-y-5 py-4 md:py-6">
      <PageHeader
        eyebrow="Clientes"
        title="Cobranças"
        mobileAction={<>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Regras de envio" title="Regras de envio" className={btn.icon}><Settings2 className="h-4 w-4" /></button>
            </PopoverTrigger>
            {regrasConteudo}
          </Popover>
          <MenuAcoes itens={[
            { label: 'Nova cobrança', icon: <Plus className="h-4 w-4" />, onClick: abrirAvulsa, destaque: true },
            { label: 'Sincronizar com o Asaas', icon: <RefreshCw className="h-4 w-4" />, onClick: () => sincronizar(), disabled: loading },
          ]} />
        </>}
      >
        <Segmented<'mes' | 'custom' | 'tudo'> size="sm" className="max-sm:w-full" value={periodoModo} onChange={setPeriodoModo} opts={[['mes', 'Mês'], ['custom', 'Período'], ['tudo', 'Tudo']]} />
        {periodoModo === 'mes' && (
          <div className="flex items-center justify-between gap-1 rounded-full border border-border bg-surface p-1 max-sm:w-full">
            <button aria-label="Mês anterior" onClick={() => setMesRef(format(addMonths(parseISO(`${mesRef}-01`), -1), 'yyyy-MM'))} className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setMesRef(format(new Date(), 'yyyy-MM'))} title="Voltar para o mês atual" className="whitespace-nowrap px-1 text-[13px] text-foreground">{format(parseISO(`${mesRef}-01`), 'MMMM yyyy', { locale: ptBR })}</button>
            <button aria-label="Próximo mês" onClick={() => setMesRef(format(addMonths(parseISO(`${mesRef}-01`), 1), 'yyyy-MM'))} className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
        {periodoModo === 'custom' && (
          <div className="flex items-center gap-2 max-sm:w-full">
            <Input type="date" value={customDe} onChange={(e) => setCustomDe(e.target.value)} className="h-10 w-[150px] rounded-full bg-surface max-sm:w-auto max-sm:min-w-0 max-sm:flex-1" />
            <span className="text-xs text-foreground-muted">até</span>
            <Input type="date" value={customAte} onChange={(e) => setCustomAte(e.target.value)} className="h-10 w-[150px] rounded-full bg-surface max-sm:w-auto max-sm:min-w-0 max-sm:flex-1" />
          </div>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(btn.outline, 'px-3.5 max-sm:hidden')}><Settings2 className="h-4 w-4" /> Regras de envio</button>
          </PopoverTrigger>
          {regrasConteudo}
        </Popover>
        <button type="button" onClick={() => sincronizar()} disabled={loading} aria-label="Sincronizar com Asaas" title="Sincronizar com Asaas" className={cn(btn.icon, 'max-sm:hidden')}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
        <button type="button" onClick={abrirAvulsa} className={cn(btn.primary, 'max-sm:hidden')} aria-label="Nova cobrança avulsa"><Plus className="h-4 w-4" /><span className="sm:hidden">Nova</span><span className="hidden sm:inline">Nova cobrança</span></button>
      </PageHeader>

      <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onFileChosen} />

      {/* Abas = totais do período (clicar filtra) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
        {STATUS_ABAS.map(([v, r, c]) => {
          const ativo = statusFiltro === v;
          const total = v === 'todos' ? totais.aReceber + totais.vencido + totais.recebido : v === 'pendente' ? totais.aReceber : v === 'vencido' ? totais.vencido : totais.recebido;
          const n = v === 'todos' ? totais.qtd.pendente + totais.qtd.vencido + totais.qtd.pago : totais.qtd[v as 'pendente' | 'vencido' | 'pago'];
          return (
            <button key={v} type="button" onClick={() => setStatusFiltro(v)} aria-pressed={ativo}
              className={cn('min-w-[46%] rounded-[20px] border p-4 text-left transition-colors sm:min-w-0', ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface hover:border-border-strong')}>
              <span className={cn('flex items-center justify-between text-[12.5px]', ativo ? 'text-background/70' : 'text-foreground-muted')}>{r}
                <span className={cn('rounded-full px-2 text-[11px] tabular-nums', ativo ? 'bg-background/15 text-background' : 'bg-surface-2')}>{n}</span></span>
              <span className={cn('mt-1 block font-heading text-[22px] font-semibold tabular-nums tracking-[-0.02em] md:text-[24px]',
                ativo ? (c === 'text-danger-fg' ? 'text-rose-300' : c === 'text-success-fg' ? 'text-emerald-300' : 'text-background') : c)}>{formatCurrency(total)}</span>
            </button>
          );
        })}
      </div>

      {falhasEmail.length > 0 && (
        <div className="rounded-[20px] bg-danger-bg px-4 py-3.5 text-danger-fg">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {falhasEmail.length === 1 ? '1 e-mail de cobrança não chegou' : `${falhasEmail.length} e-mails de cobrança não chegaram`}
          </p>
          <ul className="mt-2 space-y-2">
            {falhasEmail.map((f) => {
              const fat = f.cobranca_id ? faturasView.find((v) => v.id === f.cobranca_id || v.linhas.some((l) => l.id === f.cobranca_id)) : undefined;
              const rotulo = f.status === 'devolvido' ? 'Devolvido' : f.status === 'spam' ? 'Marcado como spam' : 'Falhou';
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-surface/70 px-3 py-2 text-[12.5px] text-foreground">
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{rotulo}</b> · {f.para} · {formatDate(f.created_at.slice(0, 10))}
                    <span className="block truncate text-foreground-muted">{f.assunto}{f.erro ? ` — ${motivoEmail(f.erro)}` : ''}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    {fat && <button onClick={() => openEmail(fat)} className={btn.mini}>Reenviar</button>}
                    <button onClick={() => dispensarFalha(f.id)} className="h-8 rounded-full px-3 text-[12.5px] text-foreground-muted hover:text-foreground">Dispensar</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {semReceita > 0 && (
        <div className="flex items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-bg text-warning-fg"><AlertTriangle className="h-4 w-4" /></span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-foreground">
            <b className="font-semibold">{semReceita} {semReceita === 1 ? 'cobrança sem' : 'cobranças sem'} vínculo com o financeiro.</b>{' '}
            <span className="text-foreground-muted">Não aparecem como receita a receber nem dão baixa ao pagar.</span>
          </p>
          <button onClick={() => setConciliarOpen(true)} className={btn.mini}>Conciliar</button>
        </div>
      )}

      {/* Barra: tipo + busca */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<TipoFiltro> size="sm" className="max-sm:order-1 max-sm:w-full" value={tipoFiltro} onChange={setTipoFiltro} opts={[['todas', 'Todas'], ['recorrente', 'Recorrentes'], ['avulsa', 'Avulsas']]} />
        {canceladasQtd > 0 && (
          <button type="button" onClick={() => setStatusFiltro(statusFiltro === 'cancelado' ? 'todos' : 'cancelado')} aria-pressed={statusFiltro === 'cancelado'}
            className={cn('h-10 shrink-0 rounded-full border px-3.5 text-[13px] max-sm:order-3', statusFiltro === 'cancelado' ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground-muted hover:text-foreground')}>
            Canceladas · {canceladasQtd}
          </button>
        )}
        <label className="ml-auto flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5 max-sm:order-2 max-sm:ml-0 max-sm:min-w-0 max-sm:flex-1 sm:w-80">
          <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou descrição" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground-muted" />
        </label>
      </div>

      {/* Lista agrupada por situação */}
      {grupos.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] text-foreground">Nenhuma cobrança aqui.</p>
          <p className="mt-1 text-[13px] text-foreground-muted">{cobrancas.length === 0 ? 'Crie uma cobrança avulsa ou gere pelo contrato.' : 'Nenhuma cobrança bate com os filtros.'}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.titulo} className="rounded-[24px] border border-border bg-surface [&>div:last-child]:rounded-b-[24px]">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
                <p className={cn('text-[13px] font-semibold', g.cor || 'text-foreground')}>{g.titulo} <span className="font-normal text-foreground-muted">· {g.itens.length}</span></p>
                <p className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(g.itens.reduce((s, c) => s + (Number(c.valor) || 0), 0))}</p>
              </div>
              {g.itens.map((cob) => {
                const q = quando(cob);
                const marcado = selecionadas.has(cob.id);
                const nome = nomeCob(cob);
                const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
                const aberta = cob.status === 'pendente' || cob.status === 'vencido';
                return (
                  <div key={cob.id} onClick={() => setDetalheId(cob.id)}
                    className={cn('group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-surface-2/50 md:grid-cols-[22px_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_120px_76px_36px] md:gap-4 md:px-5', marcado && 'bg-primary/5')}>
                    <button onClick={(e) => { e.stopPropagation(); toggleSel(cob.id); }} aria-label="Selecionar cobrança" aria-pressed={marcado}
                      className={cn('hidden h-5 w-5 place-items-center rounded-md border transition-colors md:grid', marcado ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong md:opacity-0 md:group-hover:opacity-100', selecionadas.size > 0 && 'md:opacity-100')}>
                      {marcado && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <div className="flex min-w-0 items-center gap-3">
                      <button onClick={(e) => { e.stopPropagation(); toggleSel(cob.id); }} aria-label="Selecionar cobrança" aria-pressed={marcado}
                        className={cn('no-touch-min grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold md:pointer-events-none', marcado ? 'bg-foreground text-background' : corAvatar(nome || '?'))}>
                        {marcado ? <Check className="h-4 w-4 md:hidden" /> : null}<span className={cn(marcado && 'max-md:hidden')}>{iniciais(nome)}</span>
                      </button>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {cli?.nome ? <span className="truncate text-[15px] font-semibold text-foreground">{cli.nome}</span>
                            : cob.asaas_customer_nome ? (
                              <button onClick={(e) => { e.stopPropagation(); abrirCliente(cob); }} className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-foreground-muted" title="Veio do Asaas — clique para vincular a um cliente">
                                <span className="truncate">{cob.asaas_customer_nome}</span>
                                <span className="shrink-0 rounded-full bg-info-bg px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-info-fg">Asaas · vincular</span>
                              </button>
                            ) : <button onClick={(e) => { e.stopPropagation(); abrirCliente(cob); }} className="truncate text-[15px] font-semibold text-primary">Vincular cliente</button>}
                        </span>
                        <span className="flex items-center gap-1.5 truncate text-[12.5px] text-foreground-muted">
                          {cob.tipo === 'recorrente' ? <Repeat className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{cob.descricao || 'Sem descrição'}</span>
                        </span>
                      </span>
                    </div>
                    <div className="col-span-3 row-start-2 pl-[52px] text-[12.5px] md:col-span-1 md:row-start-auto md:pl-0">
                      <span className={cn('font-medium', q.cor)}>{q.txt}</span>
                      <span className="text-foreground-muted md:block"><span className="md:hidden"> · </span>{formatDate(cob.vencimento)}</span>
                    </div>
                    <div className="hidden text-[12.5px] text-foreground-muted md:block">
                      <span className="block text-foreground">{FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}</span>
                      <span className="flex flex-wrap items-center gap-x-2">
                        {cob.auto_modo !== 'off' && aberta && <span className="inline-flex items-center gap-1 text-primary" title="Lembretes automáticos ligados"><BellRing className="h-3 w-3" />auto</span>}
                        {cob.notas.length > 0 && <span className="inline-flex items-center gap-1" title="Nota fiscal anexada"><Paperclip className="h-3 w-3" />NF{cob.notas.length > 1 ? ` ${cob.notas.length}` : ''}</span>}
                        {!cob.notas.length && cob.nota_fiscal_enviada && <span className="inline-flex items-center gap-1 text-success-fg"><FileText className="h-3 w-3" />NF enviada</span>}
                        {cob.exigir_nf && !cob.notas.length && !cob.nota_fiscal_enviada && <span className="inline-flex items-center gap-1 text-warning-fg"><ShieldCheck className="h-3 w-3" />exige NF</span>}
                        {cob.linhas.length > 1 && <span className="inline-flex items-center gap-1 text-primary" title="Boleto único de vários contratos"><Layers className="h-3 w-3" />{cob.linhas.length} contratos</span>}
                        {!cob.receita_id && cob.status !== 'cancelado' && cob.status !== 'estornado' && <span className="text-warning-fg">sem receita</span>}
                      </span>
                    </div>
                    <span className="col-start-2 row-start-1 text-right font-heading text-[16px] font-semibold tabular-nums text-foreground md:col-start-auto md:row-start-auto">{formatCurrency(Number(cob.valor))}</span>
                    <div className="hidden items-center justify-end gap-1 md:flex" onClick={(e) => e.stopPropagation()}>
                      {aberta ? (<>
                        <button onClick={() => openWhatsapp(cob)} title="Enviar por WhatsApp" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted opacity-0 hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"><MessageCircle className="h-4 w-4" /></button>
                        {cob.invoice_url && <button onClick={() => copiarLink(cob)} title="Copiar link" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted opacity-0 hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"><Copy className="h-4 w-4" /></button>}
                      </>) : statusPill(cob.status)}
                    </div>
                    <div className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto" onClick={(e) => e.stopPropagation()}><AcoesMenu cob={cob} /></div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {selecionadas.size > 0 && (
        <div className="sticky bottom-24 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-[28px] bg-foreground px-2 py-2 pl-4 text-background shadow-2xl md:bottom-4">
          <span className="text-[13px]">{selecionadas.size} selecionada{selecionadas.size > 1 ? 's' : ''}</span>
          <button disabled={bulkBusy} onClick={() => aplicarFimSemana(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-background/15 px-3 text-[12.5px] hover:bg-background/25 disabled:opacity-50"><CalendarCheck className="h-3.5 w-3.5" />Enviar no fim de semana</button>
          <button disabled={bulkBusy} onClick={() => aplicarFimSemana(false)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-background/15 px-3 text-[12.5px] hover:bg-background/25 disabled:opacity-50"><CalendarOff className="h-3.5 w-3.5" />Não enviar no fim de semana</button>
          <button onClick={toggleTodas} className="h-8 rounded-full px-3 text-[12.5px] hover:bg-background/15">{todasSelecionadas ? 'Desmarcar todas' : 'Marcar todas'}</button>
          <button onClick={limparSel} aria-label="Limpar seleção" className="grid h-8 w-8 place-items-center rounded-full hover:bg-background/15"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Modal: detalhe da cobrança */}
      <Sheet open={!!detalhe} onOpenChange={(o) => { if (!o) setDetalheId(null); }}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[900px]')}>
          {detalhe && (() => {
            const c = detalhe;
            const q = quando(c);
            const pago = c.status === 'pago';
            const aberta = c.status === 'pendente' || c.status === 'vencido';
            const nome = nomeCob(c);
            const conta = c.conta_id ? contaById.get(c.conta_id) : undefined;
            const regra = regraDaCobranca(c);
            const fimSemana = c.enviar_fim_semana ?? fimSemanaPadrao;
            const ids = c.linhas.map((l) => l.id);
            return (
              <ModalShell>
                <div className="flex items-start gap-3 border-b border-border bg-surface px-5 py-4 md:px-6">
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full text-[14px] font-semibold', corAvatar(nome || '?'))}>{iniciais(nome)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-foreground-muted">{c.descricao || 'Cobrança'} · {c.tipo === 'recorrente' ? 'recorrente' : 'avulsa'}{c.linhas.length > 1 ? ` · ${c.linhas.length} contratos` : ''}</p>
                    <h2 className="truncate font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">{nome || 'Sem cliente'}</h2>
                  </div>
                  <button onClick={() => setDetalheId(null)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe md:p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <section className="rounded-[20px] border border-border bg-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-heading text-[32px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(Number(c.valor))}</p>
                            <p className={cn('text-[13px] font-medium', q.cor)}>{q.txt} <span className="font-normal text-foreground-muted">· vencimento {formatDate(c.vencimento)}</span></p>
                          </div>
                          {statusPill(c.status)}
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                          <div><dt className="text-foreground-muted">Forma</dt><dd>{aberta ? <button onClick={() => doDetalhe(() => abrirForma(c))} className="text-left text-foreground underline-offset-2 hover:underline">{FORMA_LABEL[c.forma_pagamento] || c.forma_pagamento}</button> : <span className="text-foreground">{FORMA_LABEL[c.forma_pagamento] || c.forma_pagamento}</span>}</dd></div>
                          <div><dt className="text-foreground-muted">Recebe em</dt><dd><button onClick={() => doDetalhe(() => abrirConta(c))} className={cn('text-left underline-offset-2 hover:underline', conta ? 'text-foreground' : 'text-primary')}>{conta?.nome || 'Definir conta'}</button></dd></div>
                          {c.contrato_id && <div><dt className="text-foreground-muted">Contrato</dt><dd className="truncate text-foreground">{nomeContrato(c.contrato_id) || 'vinculado'}</dd></div>}
                          {c.asaas_payment_id && <div><dt className="text-foreground-muted">No Asaas</dt><dd className="truncate text-foreground">{c.asaas_payment_id}</dd></div>}
                        </dl>
                        {c.invoice_url && (
                          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-2/70 p-2 pl-3">
                            <Link2 className="h-4 w-4 shrink-0 text-foreground-muted" />
                            <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground-muted">{c.invoice_url.replace(/^https?:\/\//, '')}</span>
                            <button onClick={() => copiarLink(c)} className={btn.mini}><Copy className="mr-1 inline h-3.5 w-3.5" />Copiar</button>
                            <a href={c.invoice_url} target="_blank" rel="noopener noreferrer" className={cn(btn.mini, 'inline-flex items-center')}><ExternalLink className="mr-1 inline h-3.5 w-3.5" />Abrir</a>
                          </div>
                        )}
                      </section>

                      {aberta && (
                        <Bloco title="Enviar agora">
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => doDetalhe(() => openWhatsapp(c))} className="flex h-11 items-center justify-center gap-2 rounded-full bg-foreground text-[13.5px] font-medium text-background hover:opacity-90"><MessageCircle className="h-4 w-4" />WhatsApp</button>
                            <button onClick={() => doDetalhe(() => openEmail(c))} className="flex h-11 items-center justify-center gap-2 rounded-full border border-border text-[13.5px] text-foreground hover:bg-surface-2"><Mail className="h-4 w-4" />E-mail</button>
                          </div>
                          <button onClick={() => receberManual(c.id)} disabled={busyId === c.id} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] text-success-fg hover:bg-success-bg disabled:opacity-50">
                            {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}Identificar pagamento manual
                          </button>
                        </Bloco>
                      )}

                      <Bloco title="Histórico">
                        <ol className="space-y-3">
                          {c.created_at && (
                            <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-success-fg" /><span><span className="block text-[13.5px] text-foreground">Criada</span><span className="block text-[12px] text-foreground-muted">{formatDate(c.created_at.slice(0, 10))}</span></span></li>
                          )}
                          {enviosDetalhe.map((e) => (
                            <li key={e.id} className="flex gap-3">
                              <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', ['falhou', 'devolvido', 'spam'].includes(e.status) ? 'bg-danger-fg' : 'bg-success-fg')} />
                              <span><span className="block text-[13.5px] text-foreground">E-mail {['falhou', 'devolvido', 'spam'].includes(e.status) ? 'não entregue' : e.status === 'entregue' ? 'entregue' : 'enviado'}</span><span className="block text-[12px] text-foreground-muted">{formatDate(e.created_at.slice(0, 10))} · {e.para}</span></span>
                            </li>
                          ))}
                          {pago ? (
                            <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-success-fg" /><span><span className="block text-[13.5px] text-foreground">Paga</span><span className="block text-[12px] text-foreground-muted">{c.data_pagamento ? formatDate(c.data_pagamento) : '—'}</span></span></li>
                          ) : aberta && regra.modo !== 'off' ? (
                            <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-primary bg-background" /><span><span className="block text-[13.5px] text-foreground">Próximos lembretes automáticos</span><span className="block text-[12px] text-foreground-muted">{descreverRegra(regra)}</span></span></li>
                          ) : null}
                        </ol>
                        <p className="mt-3 text-[11.5px] text-foreground-subtle">Envios por WhatsApp não ficam registrados aqui.</p>
                      </Bloco>
                    </div>

                    <div className="space-y-3">
                      <Bloco title="Envio automático" extra={<button onClick={() => doDetalhe(() => abrirRegra(c))} className="text-[12.5px] text-primary hover:underline">Alterar</button>}>
                        <p className="text-[13.5px] text-foreground">{regra.modo === 'off' ? 'Desligado' : regra.modo === 'custom' ? 'Regra própria' : 'Padrão'}</p>
                        <p className="text-[12px] text-foreground-muted">{regra.modo === 'off' ? 'Não envia sozinha. Use "Enviar agora".' : regra.modo === 'custom' ? descreverRegra(regra) : 'Segue as Regras de envio (Meu Perfil ou o contrato).'}</p>
                        <div className="mt-2 divide-y divide-border rounded-2xl border border-border">
                          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <span><span className="block text-[13.5px] text-foreground">Enviar no fim de semana</span><span className="block text-[11.5px] text-foreground-muted">{c.enviar_fim_semana == null ? 'usa o padrão' : 'regra desta cobrança'}</span></span>
                            <Switch checked={fimSemana} onCheckedChange={(v) => setEnviarFimSemana(ids, v)} aria-label="Enviar no fim de semana" />
                          </div>
                          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <span><span className="block text-[13.5px] text-foreground">Cobrar com chave PIX</span><span className="block text-[11.5px] text-foreground-muted">No lugar do link/boleto do Asaas (WhatsApp e e-mail)</span></span>
                            <Switch checked={!!c.envio_pix} onCheckedChange={(v) => setEnvioPix(ids, v)} aria-label="Cobrar com chave PIX" />
                          </div>
                        </div>
                      </Bloco>

                      <Bloco title="Nota fiscal" extra={c.notas.length < MAX_NOTAS_FISCAIS ? <button onClick={() => pedirUploadNota(c)} className="text-[12.5px] text-primary hover:underline">+ Anexar PDF</button> : undefined}>
                        {c.notas.length > 0 ? c.notas.map((n) => (
                          <Linha key={n.path} icon={<FileText className="h-4 w-4" />} title={n.nome} sub="anexada · vai junto no envio"
                            action={<span className="flex gap-1"><button onClick={() => abrirNota(n.path)} className={btn.mini}>Ver</button><button onClick={() => removerNota(n)} aria-label={`Remover ${n.nome}`} className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-danger-fg"><Trash2 className="h-3.5 w-3.5" /></button></span>} />
                        )) : (
                          <Linha icon={<Paperclip className="h-4 w-4" />} title={c.nota_fiscal_enviada ? 'Nota fiscal já enviada' : 'Nenhuma nota anexada'} sub={`PDF vai junto com a cobrança · até ${MAX_NOTAS_FISCAIS}`}
                            action={<button onClick={() => pedirUploadNota(c)} className={btn.mini}>Anexar PDF</button>} />
                        )}
                        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2.5">
                          <span><span className="block text-[13.5px] text-foreground">Exigir NF para disparar</span><span className="block text-[12px] text-foreground-muted">Só envia depois de anexar a nota</span></span>
                          <Switch checked={!!c.exigir_nf} onCheckedChange={(v) => setExigirNf(ids, v)} aria-label="Exigir NF para disparar" />
                        </div>
                      </Bloco>

                      <Bloco title="Recebimento e vínculos">
                        <Linha icon={<Users className="h-4 w-4" />} title={nome || 'Sem cliente'} sub="cliente" action={<button onClick={() => doDetalhe(() => abrirCliente(c))} className={btn.mini}>{c.cliente_id ? 'Alterar' : 'Vincular'}</button>} />
                        <Linha icon={<Landmark className="h-4 w-4" />} title={conta?.nome || 'Sem conta'} sub="conta de recebimento" action={<button onClick={() => doDetalhe(() => abrirConta(c))} className={btn.mini}>{conta ? 'Alterar' : 'Definir'}</button>} />
                        {c.linhas.length === 1 ? (
                          <Linha icon={<Link2 className="h-4 w-4" />} title={c.receita_id ? 'Lançamento a receber vinculado' : 'Sem lançamento vinculado'} sub="no fluxo de caixa"
                            action={<button onClick={() => doDetalhe(() => setVinculoCob(c))} className={btn.mini}>{c.receita_id ? 'Trocar' : 'Vincular'}</button>} />
                        ) : (
                          <Linha icon={<Layers className="h-4 w-4" />} title={`${c.linhas.length} contratos neste boleto`} sub={c.receita_id ? 'lançamentos vinculados' : 'use Conciliar para vincular'} />
                        )}
                      </Bloco>

                      <details className="group rounded-[20px] border border-border bg-surface p-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-[11.5px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Avançado <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
                        <div className="mt-3 space-y-1">
                          <button onClick={() => sincronizar(c.contrato_id || undefined)} className={MENU_ITEM}><RefreshCw className="h-4 w-4" />Sincronizar com o Asaas</button>
                          {c.linhas.length === 1 && c.receita_id && <button onClick={() => desvincular(c)} className={MENU_ITEM}><Unlink className="h-4 w-4" />Desvincular lançamento</button>}
                          {c.status !== 'cancelado' && c.status !== 'estornado' ? (
                            <button onClick={() => doDetalhe(() => setCancelando(c))} className={MENU_ITEM_DANGER}>
                              {pago ? <Trash2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{pago ? 'Remover da lista…' : 'Cancelar cobrança…'}
                            </button>
                          ) : (
                            <button onClick={() => { setDetalheId(null); excluir(c.id); }} className={MENU_ITEM_DANGER}><Trash2 className="h-4 w-4" />Apagar do histórico</button>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </ModalShell>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Modal: nova cobrança avulsa */}
      <Sheet open={avulsaOpen} onOpenChange={setAvulsaOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[920px]')}>
          <ModalShell>
            <ModalHeader eyebrow="Cobrança" title="Nova cobrança" onClose={() => setAvulsaOpen(false)} />
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3 p-4 md:p-5">
                <Secao n={1} title="Cliente">
                  <Campo label="Para quem é a cobrança">
                    <select value={avulsa.cliente_id} onChange={(e) => { setAvulsa((p) => ({ ...p, cliente_id: e.target.value })); setAvContrato(''); }} className={campoCls}>
                      <option value="">Selecione…</option>
                      {clientesAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Descrição (aparece no link de pagamento)">
                    <Input value={avulsa.descricao} onChange={(e) => setAvulsa((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex.: Serviço avulso de setembro" />
                  </Campo>
                  {contratosDo(avulsa.cliente_id).length > 0 && (
                    <Campo label="Vincular a um contrato (opcional)" hint="Vinculada, entra no histórico do contrato e segue a regra de envio, o PIX e a nota fiscal dele.">
                      <select value={avContrato} onChange={(e) => setAvContrato(e.target.value)} className={campoCls}>
                        <option value="">Nenhum — cobrança solta</option>
                        {contratosDo(avulsa.cliente_id).map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                      </select>
                    </Campo>
                  )}
                </Secao>

                <Secao n={2} title="Valor e vencimento">
                  {!parcelar && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Campo label="Valor">
                        <div className="flex h-10 items-center rounded-xl border border-input bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-ring">
                          <span className="mr-1 text-foreground-muted">R$</span>
                          <input type="number" step="0.01" min="0" value={avulsa.valor} onChange={(e) => setAvulsa((p) => ({ ...p, valor: e.target.value }))} placeholder="0,00" className="min-w-0 flex-1 bg-transparent font-semibold tabular-nums outline-none" />
                        </div>
                      </Campo>
                      <DatePickerField label="Vencimento" value={avulsa.vencimento || undefined} onChange={(d) => setAvulsa((p) => ({ ...p, vencimento: d }))} required />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3.5 py-3">
                    <span><span className="block text-[14px] text-foreground">Parcelar</span><span className="block text-[12px] text-foreground-muted">Cada parcela vira uma cobrança no Asaas, com data e valor que você define</span></span>
                    <Switch checked={parcelar} onCheckedChange={(v) => setParcelar(v)} aria-label="Parcelar" />
                  </div>
                  {parcelar && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Campo label="Valor total"><Input type="number" step="0.01" min="0" value={pc.total} onChange={(e) => setPc((p) => ({ ...p, total: e.target.value }))} placeholder="1.200,00" /></Campo>
                        <Campo label="Nº de parcelas"><Input type="number" min="2" max="60" step="1" value={pc.count} onChange={(e) => setPc((p) => ({ ...p, count: parseInt(e.target.value) || 2 }))} /></Campo>
                        <Campo label="1ª parcela"><Input type="date" value={pc.first} onChange={(e) => setPc((p) => ({ ...p, first: e.target.value }))} /></Campo>
                        <Campo label="A cada (dias)"><Input type="number" min="1" step="1" value={pc.intervalo} onChange={(e) => setPc((p) => ({ ...p, intervalo: parseInt(e.target.value) || 30 }))} placeholder="30" /></Campo>
                      </div>
                      <button type="button" onClick={gerarParcelas} className={cn(btn.outline, 'w-full')}>Gerar parcelas</button>
                      {pcRows.length > 0 && (
                        <>
                          <div className="max-h-64 overflow-y-auto rounded-2xl border border-border px-3">
                            {pcRows.map((r, i) => (
                              <div key={i} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
                                <span className="w-8 shrink-0 text-[12px] text-foreground-muted">{i + 1}/{pcRows.length}</span>
                                <Input type="date" value={r.vencimento} onChange={(e) => setPcRows((prev) => prev.map((x, j) => j === i ? { ...x, vencimento: e.target.value } : x))} className="min-w-0 flex-1" />
                                <Input type="number" step="0.01" min="0" value={r.valor} onChange={(e) => setPcRows((prev) => prev.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} className="w-28 tabular-nums" />
                                <button type="button" aria-label="Remover parcela" onClick={() => setPcRows((prev) => prev.filter((_, j) => j !== i))} className="no-touch-min grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger-fg hover:bg-danger-bg"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[12.5px]">
                            <button type="button" onClick={() => setPcRows((prev) => [...prev, { valor: '0', vencimento: format(addDays(parseISO(prev[prev.length - 1]?.vencimento || format(new Date(), 'yyyy-MM-dd')), Math.max(1, Number(pc.intervalo) || 30)), 'yyyy-MM-dd') }])} className="text-primary hover:underline">+ Adicionar parcela</button>
                            <span className="text-foreground-muted">Soma: <b className="font-heading tabular-nums text-foreground">{formatCurrency(somaParcelas)}</b> ({pcRows.length}x)</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Secao>

                <Secao n={3} title="Pagamento">
                  <Segmented<string> value={avulsa.forma} onChange={(v) => setAvulsa((p) => ({ ...p, forma: v }))} opts={FORMAS.map((f) => [f.value, f.label] as [string, string])} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Campo label="Recebe na conta">
                      <select value={avulsa.conta_id} onChange={(e) => setAvulsa((p) => ({ ...p, conta_id: e.target.value }))} className={campoCls}>
                        <option value="">Defino depois</option>
                        {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Multa por atraso (%)"><Input type="number" step="0.01" min="0" value={avulsa.multa} onChange={(e) => setAvulsa((p) => ({ ...p, multa: e.target.value }))} placeholder="0" /></Campo>
                    <Campo label="Juros ao mês (%)"><Input type="number" step="0.01" min="0" value={avulsa.juros} onChange={(e) => setAvulsa((p) => ({ ...p, juros: e.target.value }))} placeholder="0" /></Campo>
                  </div>
                  <p className="text-[11.5px] leading-snug text-foreground-muted">Multa/juros só incidem se atrasar. Juros é <b>ao mês</b> (proporcional aos dias de atraso). O valor recebido de juros/multa entra como receita extra na baixa.</p>
                </Secao>

                <Secao n={4} title="Lembretes ao cliente">
                  <RegraAutoCobranca value={avRegra} onChange={setAvRegra} contratoNome={nomeContrato(avContrato)}
                    canal={avulsa.cliente_id ? clienteById.get(avulsa.cliente_id)?.canal_cobranca || 'whatsapp' : null} />
                  {parcelar && <p className="text-[11px] text-foreground-muted">Vale para todas as parcelas.</p>}
                </Secao>
              </div>
              <aside className="border-t border-border bg-surface p-5 md:border-l md:border-t-0">
                <div className="space-y-4 md:sticky md:top-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">Resumo</p>
                  <div>
                    <p className="font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(parcelar ? somaParcelas : (parseFloat(avulsa.valor) || 0))}</p>
                    <p className="text-[13px] text-foreground-muted">{parcelar ? (pcRows.length ? `em ${pcRows.length} parcelas` : 'gere as parcelas') : avulsa.vencimento ? `vence em ${formatDate(avulsa.vencimento)}` : 'defina o vencimento'}</p>
                  </div>
                  <dl className="space-y-2.5 text-[13px]">
                    <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Cliente</dt><dd className="truncate text-right text-foreground">{(avulsa.cliente_id && clienteById.get(avulsa.cliente_id)?.nome) || '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Forma</dt><dd className="text-foreground">{avulsa.forma === 'UNDEFINED' ? 'Pix, boleto ou cartão' : FORMA_LABEL[avulsa.forma]}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Conta</dt><dd className="text-foreground">{(avulsa.conta_id && contaById.get(avulsa.conta_id)?.nome) || 'definir depois'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Lembretes</dt><dd className="text-foreground">{avRegra.modo === 'off' ? 'desligados' : avRegra.modo === 'custom' ? 'personalizados' : 'padrão'}</dd></div>
                  </dl>
                  <div className="rounded-2xl bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground-muted">
                    <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Wallet className="h-3.5 w-3.5 text-primary" /> O que acontece</p>
                    O Asaas gera o link de Pix, boleto ou cartão, o lançamento "a receber" entra no caixa e, quando o cliente pagar, a baixa é automática.
                  </div>
                </div>
              </aside>
            </div>
            <ModalFooter>
              <button type="button" onClick={() => setAvulsaOpen(false)} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={handleCriarAvulsa} disabled={avulsaSaving || !avulsa.cliente_id || (parcelar ? pcRows.length < 2 : (!avulsa.valor || !avulsa.vencimento))} className={btn.primary}>
                {avulsaSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {parcelar ? `Criar ${pcRows.length || ''}${pcRows.length ? 'x' : ''} parcela(s)` : 'Criar cobrança'}
              </button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      {/* Modal: regra de envio automático */}
      <Sheet open={!!regraCob} onOpenChange={(o) => { if (!o && !regraSaving) setRegraCob(null); }}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          {regraCob && (
            <ModalShell>
              <ModalHeader eyebrow={`${regraCob.descricao || 'Cobrança'} · ${formatCurrency(Number(regraCob.valor))} · vence ${formatDate(regraCob.vencimento)}`} title="Regra de envio automático" onClose={() => setRegraCob(null)} />
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
                {regraCob.tipo !== 'recorrente' && contratosDo(regraCob.cliente_id).length > 0 && (
                  <Campo label="Contrato">
                    <select value={regraContrato} onChange={(e) => setRegraContrato(e.target.value)} className={campoCls}>
                      <option value="">Nenhum — cobrança solta</option>
                      {contratosDo(regraCob.cliente_id).map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                    </select>
                  </Campo>
                )}
                <Bloco title="Quando enviar">
                  <RegraAutoCobranca value={regraVal} onChange={setRegraVal} contratoNome={nomeContrato(regraContrato || regraCob.contrato_id)}
                    canal={regraCob.cliente_id ? clienteById.get(regraCob.cliente_id)?.canal_cobranca || 'whatsapp' : null} />
                </Bloco>
                {irmas(regraCob).length > 1 && (
                  <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3.5 py-3">
                    <span className="text-[13.5px] text-foreground">Aplicar a todas as {irmas(regraCob).length} parcelas</span>
                    <Switch checked={regraTodas} onCheckedChange={setRegraTodas} />
                  </label>
                )}
              </div>
              <ModalFooter>
                <button type="button" onClick={() => setRegraCob(null)} className={btn.outline}>Cancelar</button>
                <button type="button" onClick={salvarRegraCob} disabled={regraSaving} className={btn.primary}>{regraSaving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
              </ModalFooter>
            </ModalShell>
          )}
        </SheetContent>
      </Sheet>

      <CancelarCobrancaDialog
        cobranca={cancelando}
        clienteNome={cancelando?.cliente_id ? clienteById.get(cancelando.cliente_id)?.nome : cancelando?.asaas_customer_nome || undefined}
        onOpenChange={(o) => { if (!o) setCancelando(null); }}
        onCancelarSoEsta={cancelarSoEsta}
        onCancelar={cancelar}
        onExcluir={excluir}
        onRemoverDoHistorico={removerDoHistorico}
      />
      <VinculoPickerSheet
        open={!!vinculoCob}
        onOpenChange={(o) => { if (!o) setVinculoCob(null); }}
        title={vinculoCob?.receita_id ? 'Trocar lançamento vinculado' : 'Vincular a um lançamento'}
        subtitle={vinculoCob ? `Cobrança de ${formatCurrency(Number(vinculoCob.valor))}, vence ${formatDate(vinculoCob.vencimento)}. O lançamento escolhido passa a seguir esta cobrança.` : ''}
        tipoItem="lançamento"
        carregar={() => (vinculoCob ? opcoesReceitas({
          id: vinculoCob.id, cliente_id: vinculoCob.cliente_id, valor: Number(vinculoCob.valor),
          vencimento: vinculoCob.vencimento, receita_id: vinculoCob.receita_id,
        }) : Promise.resolve([]))}
        onEscolher={async (op) => {
          if (!vinculoCob) return false;
          try {
            const r = await vincularCobrancaReceita(vinculoCob.id, op.id);
            toast.success('Lançamento vinculado.', {
              description: r.anteriorApagado ? 'O lançamento criado automaticamente por esta cobrança foi removido (era duplicado).' : undefined,
            });
            await reload();
            return true;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao vincular');
            return false;
          }
        }}
      />

      <ConciliacaoSheet
        open={conciliarOpen}
        onOpenChange={setConciliarOpen}
        listar={conciliarListar}
        aplicar={conciliarAplicar}
        nomeCliente={(id) => (id && clienteById.get(id)?.nome) || '—'}
      />

      {/* Modal: forma de recebimento */}
      <Sheet open={formaOpen} onOpenChange={setFormaOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[480px]')}>
          <ModalShell>
            <ModalHeader eyebrow={formaCob ? `${(formaCob.cliente_id && clienteById.get(formaCob.cliente_id)?.nome) || '—'} · ${formatCurrency(Number(formaCob.valor))}` : 'Cobrança'} title="Forma de recebimento" onClose={() => setFormaOpen(false)} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              <div className="grid grid-cols-2 gap-2">
                {FORMAS.map((f) => (
                  <button key={f.value} type="button" onClick={() => setFormaSel(f.value)} aria-pressed={formaSel === f.value}
                    className={cn('h-11 rounded-2xl border text-[13.5px] transition-colors', formaSel === f.value ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-surface-2')}>{f.label}</button>
                ))}
              </div>
              <p className="text-[12px] text-foreground-muted">{formaCob?.tipo === 'recorrente' ? 'Atualiza a assinatura e as faturas pendentes no Asaas.' : 'Atualiza a fatura no Asaas.'} O link de pagamento continua o mesmo.</p>
            </div>
            <ModalFooter>
              <button type="button" onClick={() => setFormaOpen(false)} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={handleSalvarForma} disabled={formaSaving} className={btn.primary}>{formaSaving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      {/* Modal: conta de recebimento */}
      <Sheet open={contaOpen} onOpenChange={setContaOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[480px]')}>
          <ModalShell>
            <ModalHeader eyebrow={contaCob ? `${(contaCob.cliente_id && clienteById.get(contaCob.cliente_id)?.nome) || '—'} · ${formatCurrency(Number(contaCob.valor))}` : 'Cobrança'} title="Conta de recebimento" onClose={() => setContaOpen(false)} />
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 md:p-5">
              <button type="button" onClick={() => setContaSel('')} className={cn('flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-[13.5px]', !contaSel ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-surface-2')}>Sem conta</button>
              {contasRecebimento.map((c) => (
                <button key={c.id} type="button" onClick={() => setContaSel(c.id)} className={cn('flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-[13.5px]', contaSel === c.id ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-surface-2')}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor || 'hsl(var(--foreground-muted))' }} />{c.nome}
                </button>
              ))}
              <p className="pt-1 text-[12px] text-foreground-muted">Atualiza também a receita "a receber" vinculada.</p>
            </div>
            <ModalFooter>
              <button type="button" onClick={() => setContaOpen(false)} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={handleSalvarConta} disabled={contaSaving} className={btn.primary}>{contaSaving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      {/* Modal: vincular cliente (cobrança veio do Asaas sem cliente) */}
      <Sheet open={clienteOpen} onOpenChange={setClienteOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[480px]')}>
          <ModalShell>
            <ModalHeader eyebrow={clienteCob ? `${clienteCob.descricao || '—'} · ${formatCurrency(Number(clienteCob.valor))} · vence ${formatDate(clienteCob.vencimento)}` : 'Cobrança'} title="Vincular a um cliente" onClose={() => setClienteOpen(false)} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              {clienteCob?.asaas_customer_nome && !clienteCob?.cliente_id && (
                <InlineNotice tone="info" icon={<Users />}>
                  No Asaas está como <b>{clienteCob.asaas_customer_nome}</b>. Confirme o cliente do BALANX abaixo (já sugeri um se o nome bateu).
                </InlineNotice>
              )}
              <Campo label="Cliente" hint={'Liga também a receita "a receber" a esse cliente. Ideal para cobranças criadas direto no Asaas.'}>
                <select value={clienteSel} onChange={(e) => setClienteSel(e.target.value)} className={campoCls}>
                  <option value="">Sem cliente</option>
                  {clientesOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
            </div>
            <ModalFooter>
              <button type="button" onClick={() => setClienteOpen(false)} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={handleSalvarCliente} disabled={clienteSaving} className={btn.primary}>{clienteSaving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      {/* Modal: e-mail */}
      <Sheet open={emOpen} onOpenChange={setEmOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          <ModalShell>
            <ModalHeader eyebrow={emCob ? `${emCob.descricao || '—'} · ${formatCurrency(Number(emCob.valor))} · vence ${formatDate(emCob.vencimento)}` : 'Cobrança'} title="Enviar por e-mail" onClose={() => setEmOpen(false)} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              <Campo label="Para (e-mail do cliente)"><Input type="email" value={emPara} onChange={(e) => setEmPara(e.target.value)} placeholder="contato@cliente.com" /></Campo>
              <Campo label="Mensagem de abertura" hint={emCob?.envio_pix && pixCfg.chave ? 'O e-mail vai com valor, vencimento e a chave PIX (sem boleto nem link do Asaas).' : 'O e-mail já inclui valor, vencimento e o botão de pagamento do Asaas.'}>
                <Textarea value={emIntro} onChange={(e) => setEmIntro(e.target.value)} rows={3} className="text-[13px] leading-relaxed" />
              </Campo>
              {emCob?.notas.length ? (
                <InlineNotice tone="neutral" icon={<FileText className="text-primary" />}><NotasAnexo notas={emCob.notas} onVer={abrirNota} /></InlineNotice>
              ) : emBloqueado ? (
                <InlineNotice tone="warning" icon={<ShieldCheck />}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">Esta cobrança exige nota fiscal.</span>
                    <button onClick={() => { setEmOpen(false); pedirUploadNota(emCob!); }} className="shrink-0 font-semibold hover:underline">Anexar</button>
                  </div>
                </InlineNotice>
              ) : null}
            </div>
            <ModalFooter>
              <button type="button" onClick={() => setEmOpen(false)} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={handleEnviarEmail} disabled={emSending || emBloqueado || !emPara.trim()} className={btn.primary}>
                {emSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Enviar e-mail
              </button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      {/* Modal: WhatsApp */}
      <Sheet open={waOpen} onOpenChange={setWaOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          <ModalShell>
            <ModalHeader eyebrow="Cobrança · WhatsApp da empresa" title="Enviar por WhatsApp" onClose={() => setWaOpen(false)} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              <Campo label="Telefone (com DDD)"><Input type="tel" inputMode="tel" value={waTel} onChange={(e) => setWaTel(e.target.value)} placeholder="(11) 99999-9999" /></Campo>
              <Campo label="Mensagem"><Textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={10} className="font-mono text-[13px] leading-relaxed" /></Campo>
              {waCob?.notas.length ? (
                <InlineNotice tone="neutral" icon={<FileText className="text-primary" />}><NotasAnexo notas={waCob.notas} onVer={abrirNota} /></InlineNotice>
              ) : waCob?.exigir_nf && !waCob?.nota_fiscal_enviada ? (
                <InlineNotice tone="warning" icon={<ShieldCheck />}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">Esta cobrança exige nota fiscal.</span>
                    <button onClick={() => { setWaOpen(false); pedirUploadNota(waCob); }} className="shrink-0 font-semibold hover:underline">Anexar</button>
                  </div>
                </InlineNotice>
              ) : null}
            </div>
            <ModalFooter>
              <button type="button" onClick={() => setWaOpen(false)} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={handleEnviarWa} disabled={waSending || waBloqueado || !waTel.trim() || !waText.trim()} className={btn.primary}>
                {waSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}Enviar
              </button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>
    </main>
  );
}

/** Descrição curta de uma regra própria de envio. */
function descreverRegra(r: RegraAuto) {
  if (r.modo === 'off') return 'Desligado';
  if (r.modo === 'padrao') return 'Segue a regra padrão';
  const partes = [r.antes_dias > 0 ? `${r.antes_dias} dia${r.antes_dias > 1 ? 's' : ''} antes` : null, r.no_dia ? 'no dia' : null, r.atraso_diario ? 'todo dia em atraso' : null].filter(Boolean);
  return partes.length ? partes.join(', ') : 'Nenhum envio marcado';
}
