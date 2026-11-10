import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActionParam } from '@/hooks/useActionParam';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { IconButton } from '@/components/shared/IconButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ChoiceChip, FormSection, InitialsAvatar, InlineNotice, NATIVE_SELECT_CLS, SECTION_LABEL_CLS, SheetFooter, SheetHeading, iniciais } from '@/components/cobrancas/formParts';
import { SectionCard } from '@/components/shared/SectionCard';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VinculoPickerSheet } from '@/components/cobrancas/VinculoPickerSheet';
import { desvincularCobranca, opcoesReceitas, vincularCobrancaReceita } from '@/lib/vinculoCobranca';
import {
  RefreshCw, Plus, MoreHorizontal, ExternalLink, MessageCircle, HandCoins,
  XCircle, Trash2, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Repeat, Receipt, Wallet, CreditCard,
  Paperclip, FileText, ShieldCheck, ShieldOff, Layers, KeyRound, Users, Mail, CalendarOff, CalendarCheck, Search, AlertTriangle, Check, Link2, Unlink,
} from 'lucide-react';

const toneCls: Record<string, string> = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  muted: 'bg-surface-2 text-foreground-muted',
};

const MENU_ITEM = 'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2';
const MENU_ITEM_DANGER = 'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-danger-fg transition-colors hover:bg-danger-bg';

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
  const isMobile = useIsMobile();
  const {
    cobrancas, loading, busyId,
    criarAvulsa, criarAvulsaParcelada, cancelar, excluir, sincronizar, receberManual, atualizarConta, atualizarCliente, atualizarForma, enviarWhatsapp, enviarEmail,
    anexarNotas, removerNota, setExigirNf, setEnvioPix, notaSignedUrl, marcarNotasEnviadas, conciliarListar, conciliarAplicar, whatsappTemplate, pixCfg, emailCfg,
    fimSemanaPadrao, setFimSemanaPadrao, setEnviarFimSemana, reload,
  } = useCobrancas();
  const [conciliarOpen, setConciliarOpen] = useState(false);
  // Vínculo manual cobrança ↔ lançamento (só cobrança de uma linha; fatura agrupada usa a conciliação)
  const [vinculoCob, setVinculoCob] = useState<FaturaView | null>(null);
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
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'vencimento', dir: 'asc' });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortIcon = (key: SortKey) =>
    sort.key !== key ? <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      : sort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;

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
    return { aReceber, vencido, recebido };
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
      if (statusFiltro !== 'todos' && c.status !== statusFiltro) return false;
      if (term) {
        const nome = (c.cliente_id && clienteById.get(c.cliente_id)?.nome) || '';
        if (!nome.toLowerCase().includes(term) && !(c.descricao || '').toLowerCase().includes(term)) return false;
      }
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (c: Cobranca): string | number => {
      switch (sort.key) {
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
  }, [faturasView, tipoFiltro, statusFiltro, busca, sort, clienteById, periodo]);

  // ===== Seleção em massa (fim de semana) =====
  const toggleSel = (id: string) => setSelecionadas((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
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

  // ===== Nova cobrança avulsa =====
  const [avulsaOpen, setAvulsaOpen] = useState(false);
  const emptyAvulsa = { cliente_id: '', valor: '', vencimento: '', descricao: '', forma: 'UNDEFINED', conta_id: '', multa: '', juros: '' };
  const [avulsa, setAvulsa] = useState(emptyAvulsa);
  const [avulsaSaving, setAvulsaSaving] = useState(false);
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
  const abrirAvulsa = () => { setAvulsa(emptyAvulsa); setParcelar(false); setPc(emptyPc); setPcRows([]); setAvulsaOpen(true); };
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

  // ===== Menu de ações por cobrança =====
  const AcoesMenu = ({ cob }: { cob: FaturaView }) => {
    const busy = busyId === cob.id;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button aria-label="Ações da cobrança" className="no-touch-min inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 rounded-[20px] border border-border bg-surface p-1.5">
          {cob.invoice_url && (
            <a href={cob.invoice_url} target="_blank" rel="noopener noreferrer" className={MENU_ITEM}>
              <ExternalLink className="h-4 w-4 text-foreground-muted" /> Abrir link de pagamento
            </a>
          )}
          <button onClick={() => openWhatsapp(cob)} className={MENU_ITEM}>
            <MessageCircle className="h-4 w-4 text-success-fg" /> Enviar por WhatsApp
          </button>
          <button onClick={() => openEmail(cob)} className={MENU_ITEM}>
            <Mail className="h-4 w-4 text-primary" /> Enviar por e-mail
          </button>
          {cob.status !== 'pago' && (
            <button onClick={() => receberManual(cob.id)} className={MENU_ITEM}>
              <HandCoins className="h-4 w-4 text-success-fg" /> Identificar pagamento manual
            </button>
          )}
          {cob.linhas.length === 1 && (
            <>
              <button onClick={() => setVinculoCob(cob)} className={MENU_ITEM}>
                <Link2 className="h-4 w-4 text-foreground-muted" /> {cob.receita_id ? 'Trocar lançamento vinculado' : 'Vincular a um lançamento'}
              </button>
              {cob.receita_id && (
                <button onClick={() => desvincular(cob)} className={MENU_ITEM}>
                  <Unlink className="h-4 w-4 text-foreground-muted" /> Desvincular lançamento
                </button>
              )}
            </>
          )}
          {/* Nota fiscal (PDF) */}
          {cob.notas.length > 0 && (
            <div className="my-1 rounded-xl bg-surface-2/60 p-1">
              <p className="px-2 pb-0.5 pt-1 text-[11px] font-medium text-foreground-muted">
                Notas fiscais · {cob.notas.length}/{MAX_NOTAS_FISCAIS}
              </p>
              {cob.notas.map((n) => (
                <div key={n.path} className="flex items-center gap-1">
                  <button onClick={() => abrirNota(n.path)} className={cn(MENU_ITEM, 'min-w-0 flex-1 py-1.5')} title={`Ver ${n.nome}`}>
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{n.nome}</span>
                  </button>
                  <button
                    onClick={() => removerNota(n)}
                    aria-label={`Remover ${n.nome}`}
                    className="no-touch-min inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-danger-bg hover:text-danger-fg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {cob.notas.length < MAX_NOTAS_FISCAIS && (
            <button onClick={() => pedirUploadNota(cob)} className={MENU_ITEM}>
              <Paperclip className="h-4 w-4 text-foreground-muted" />
              {cob.notas.length ? 'Anexar mais notas fiscais' : 'Anexar notas fiscais (PDF)'}
            </button>
          )}
          <button onClick={() => setExigirNf(cob.linhas.map((l) => l.id), !cob.exigir_nf)} className={MENU_ITEM}>
            {cob.exigir_nf ? <ShieldOff className="h-4 w-4 text-foreground-muted" /> : <ShieldCheck className="h-4 w-4 text-foreground-muted" />}
            {cob.exigir_nf ? 'Não exigir NF p/ disparar' : 'Exigir NF p/ disparar'}
          </button>
          <button onClick={() => setEnvioPix(cob.linhas.map((l) => l.id), !cob.envio_pix)} className={MENU_ITEM}>
            <KeyRound className={cn('h-4 w-4', cob.envio_pix ? 'text-success-fg' : 'text-foreground-muted')} />
            {cob.envio_pix ? 'Voltar ao link/boleto do Asaas' : 'Cobrar com chave PIX (WhatsApp e e-mail)'}
          </button>
          {cob.status !== 'pago' && cob.status !== 'cancelado' && (
            <button onClick={() => abrirForma(cob)} className={MENU_ITEM}>
              <CreditCard className="h-4 w-4 text-foreground-muted" /> Alterar forma de recebimento
            </button>
          )}
          <button onClick={() => abrirConta(cob)} className={MENU_ITEM}>
            <Wallet className="h-4 w-4 text-foreground-muted" /> {cob.conta_id ? 'Alterar conta de recebimento' : 'Definir conta de recebimento'}
          </button>
          <button onClick={() => abrirCliente(cob)} className={MENU_ITEM}>
            <Users className="h-4 w-4 text-foreground-muted" /> {cob.cliente_id ? 'Alterar cliente' : 'Vincular a um cliente'}
          </button>
          <button onClick={() => sincronizar(cob.contrato_id || undefined)} className={MENU_ITEM}>
            <RefreshCw className="h-4 w-4 text-foreground-muted" /> Sincronizar status
          </button>
          <button onClick={() => cancelar(cob.id)} className={MENU_ITEM}>
            <XCircle className="h-4 w-4 text-foreground-muted" /> Cancelar cobrança
          </button>
          <button onClick={() => excluir(cob.id)} className={MENU_ITEM_DANGER}>
            <Trash2 className="h-4 w-4" /> Excluir cobrança
          </button>
        </PopoverContent>
      </Popover>
    );
  };

  const TipoBadge = ({ tipo }: { tipo: string }) =>
    tipo === 'recorrente' ? (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-info-bg px-2 py-0.5 text-[10.5px] font-semibold text-info-fg">
        <Repeat className="h-3 w-3" /> Recorrente
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-foreground-muted">
        <Receipt className="h-3 w-3" /> Avulsa
      </span>
    );

  // Mobile: lista agrupada por dia de vencimento (mantém a ordem de `filtradas`).
  const gruposMobile = useMemo(() => {
    const out: { key: string; titulo: string; itens: FaturaView[] }[] = [];
    for (const c of filtradas) {
      const k = c.vencimento || 'sem';
      const last = out[out.length - 1];
      if (last && last.key === k) { last.itens.push(c); continue; }
      const titulo = c.vencimento ? format(parseISO(c.vencimento), "EEE · d MMM", { locale: ptBR }) : 'Sem vencimento';
      out.push({ key: k, titulo, itens: [c] });
    }
    // chave única por bloco (o mesmo dia pode reaparecer se a ordem não for por vencimento)
    return out.map((g, i) => ({ ...g, key: `${g.key}-${i}` }));
  }, [filtradas]);

  const STATUS_TABS: { value: string; label: string }[] = [
    { value: 'todos', label: 'Todas' },
    { value: 'pendente', label: 'Aguardando' },
    { value: 'vencido', label: 'Vencido' },
    { value: 'pago', label: 'Pago' },
    { value: 'cancelado', label: 'Cancelado' },
  ];

  return (
    <main className="container py-4 md:py-6">
      <MobilePageHeader
        eyebrow="Gestão · Financeiro"
        title="Cobranças"
        actions={
          <>
            <IconButton label="Sincronizar com Asaas" onClick={() => sincronizar()} disabled={loading} className="h-10 w-10 rounded-full">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </IconButton>
            <Button onClick={abrirAvulsa} className="gap-1.5" aria-label="Nova cobrança avulsa">
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Nova</span>
              <span className="hidden sm:inline">Nova cobrança</span>
            </Button>
          </>
        }
      />

      <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onFileChosen} />

      {/* Seletor de período (por vencimento) */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Tabs value={periodoModo} onValueChange={(v) => setPeriodoModo(v as 'mes' | 'custom' | 'tudo')}>
          <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="custom">Período</TabsTrigger>
            <TabsTrigger value="tudo">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>

        {periodoModo === 'mes' && (
          <div className="flex items-center justify-between gap-1 rounded-full border border-border bg-surface p-1 sm:min-w-[300px]">
            <button aria-label="Mês anterior" onClick={() => setMesRef(format(addMonths(parseISO(`${mesRef}-01`), -1), 'yyyy-MM'))}
              className="no-touch-min grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-border"><ChevronLeft className="h-4 w-4" /></button>
            <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold capitalize text-foreground">
              {format(parseISO(`${mesRef}-01`), 'MMMM yyyy', { locale: ptBR })}
              <button onClick={() => setMesRef(format(new Date(), 'yyyy-MM'))} className="text-[12px] font-medium normal-case text-primary hover:underline">hoje</button>
            </span>
            <button aria-label="Próximo mês" onClick={() => setMesRef(format(addMonths(parseISO(`${mesRef}-01`), 1), 'yyyy-MM'))}
              className="no-touch-min grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-border"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}

        {periodoModo === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customDe} onChange={(e) => setCustomDe(e.target.value)} className="min-w-0 flex-1 rounded-full bg-surface sm:w-[160px] sm:flex-none" />
            <span className="text-xs text-foreground-muted">até</span>
            <Input type="date" value={customAte} onChange={(e) => setCustomAte(e.target.value)} className="min-w-0 flex-1 rounded-full bg-surface sm:w-[160px] sm:flex-none" />
          </div>
        )}

        <span className="text-[12px] text-foreground-muted sm:ml-auto">
          {periodoModo === 'tudo' ? 'Todas as cobranças' : 'Valores por vencimento no período'}
        </span>
      </div>

      <KpiTriple
        className="md:mb-6"
        items={[
          { label: 'A receber', value: totais.aReceber, tone: 'amber' },
          { label: 'Vencido', value: totais.vencido, tone: 'red' },
          { label: 'Recebido', value: totais.recebido, tone: 'green' },
        ]}
      />

      {falhasEmail.length > 0 && (
        <div className="mb-4 rounded-[20px] border border-transparent bg-danger-bg px-4 py-3.5 text-danger-fg md:mb-6">
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
                    {fat && <Button size="sm" variant="outline" onClick={() => openEmail(fat)}>Reenviar</Button>}
                    <Button size="sm" variant="ghost" onClick={() => dispensarFalha(f.id)}>Dispensar</Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mb-4 grid gap-3 md:mb-6 md:grid-cols-2">
        {/* Fim de semana: padrão global + ação em massa (seleção) */}
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[20px] border border-border bg-surface px-4 py-3', (semReceita === 0 || selecionadas.size > 0) && 'md:col-span-2')}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 text-foreground"><CalendarCheck className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">Enviar no fim de semana <span className="font-normal text-foreground-muted">(padrão)</span></p>
              <p className="text-[12px] text-foreground-muted">Desligado: segura sáb/dom e dispara na segunda</p>
            </div>
            <Switch checked={fimSemanaPadrao} onCheckedChange={setFimSemanaPadrao} aria-label="Enviar no fim de semana (padrão)" />
          </div>
          {selecionadas.size > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-2.5 md:ml-auto md:w-auto md:border-l md:border-t-0 md:pl-3 md:pt-0">
              <span className="text-[12.5px] font-semibold text-foreground">{selecionadas.size} selecionada(s):</span>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => aplicarFimSemana(true)}>
                <CalendarCheck className="mr-1.5 h-3.5 w-3.5 text-success-fg" /> Enviar no fim de semana
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => aplicarFimSemana(false)}>
                <CalendarOff className="mr-1.5 h-3.5 w-3.5 text-warning-fg" /> Não enviar
              </Button>
              <button onClick={limparSel} className="text-[12px] font-medium text-foreground-muted hover:text-foreground">limpar</button>
            </div>
          )}
        </div>

        {/* Aviso: cobranças sem vínculo com o financeiro */}
        {semReceita > 0 && (
          <div className={cn('flex items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3', selecionadas.size > 0 && 'md:col-span-2')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-warning-bg text-warning-fg"><AlertTriangle className="h-[18px] w-[18px]" /></span>
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-foreground">
              <b>{semReceita} {semReceita === 1 ? 'cobrança sem' : 'cobranças sem'} vínculo com o financeiro.</b>{' '}
              <span className="text-foreground-muted">Não aparecem como receita a receber nem dão baixa ao pagar.</span>
            </p>
            <Button size="sm" onClick={() => setConciliarOpen(true)} className="shrink-0">Conciliar</Button>
          </div>
        )}
      </div>

      {/* Filtros: status em pílulas · tipo segmentado · busca */}
      <div className="mb-4 flex flex-col gap-3 md:mb-5 lg:flex-row lg:items-center lg:justify-between">
        <ScrollPills aria-label="Filtrar por status">
          {STATUS_TABS.map((s) => (
            <Pill key={s.value} active={statusFiltro === s.value} onClick={() => setStatusFiltro(s.value)}>
              {s.label}
            </Pill>
          ))}
        </ScrollPills>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as TipoFiltro)}>
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="recorrente">Recorrentes</TabsTrigger>
              <TabsTrigger value="avulsa">Avulsas</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou descrição…" className="rounded-full bg-surface pl-10" />
          </div>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={<Receipt className="h-6 w-6" strokeWidth={1.6} />}
            title="Nenhuma cobrança"
            description={cobrancas.length === 0 ? 'Crie uma cobrança avulsa ou gere pelo contrato.' : 'Nenhuma cobrança bate com os filtros.'}
          />
        </SectionCard>
      ) : isMobile ? (
        <div className="flex flex-col gap-1">
          {gruposMobile.map((g) => (
            <div key={g.key} className="flex flex-col">
              <div className="flex items-baseline justify-between px-0.5 pb-1.5 pt-2.5">
                <span className={SECTION_LABEL_CLS}>{g.titulo}</span>
                <span className="text-[12px] text-foreground-muted">{g.itens.length} {g.itens.length === 1 ? 'cobrança' : 'cobranças'}</span>
              </div>
              <div className="rounded-[20px] border border-border bg-surface px-3.5">
                {g.itens.map((cob) => {
                  const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
                  const sel = selecionadas.has(cob.id);
                  const nomeAvatar = cli?.nome || cob.asaas_customer_nome || '';
                  return (
                    <div key={cob.id} className="border-b border-border py-3 last:border-b-0">
                      <div className="flex items-center gap-3">
                        {/* Avatar = seleção (toque para marcar) */}
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={sel}
                          aria-label="Selecionar cobrança"
                          onClick={() => toggleSel(cob.id)}
                          className={cn(
                            'no-touch-min grid h-10 w-10 shrink-0 place-items-center rounded-[13px] font-heading text-[13px] font-semibold transition-colors',
                            sel ? 'bg-foreground text-background' : 'bg-surface-2 text-foreground',
                          )}
                        >
                          {sel ? <Check className="h-4 w-4" strokeWidth={2.6} /> : iniciais(nomeAvatar)}
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {cli?.nome ? (
                              <span className="truncate text-[14px] font-semibold text-foreground">{cli.nome}</span>
                            ) : cob.asaas_customer_nome ? (
                              <button onClick={() => abrirCliente(cob)} className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-foreground-muted">
                                <span className="truncate">{cob.asaas_customer_nome}</span>
                                <span className="shrink-0 rounded-full bg-info-bg px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-info-fg">Asaas</span>
                              </button>
                            ) : (
                              <button onClick={() => abrirCliente(cob)} className="truncate text-[14px] font-semibold text-primary">Vincular cliente</button>
                            )}
                            {cob.linhas.length > 1 && <GrupoChip qtd={cob.linhas.length} />}
                          </div>
                          <span className="truncate text-[12px] text-foreground-muted">{cob.descricao || 'Sem descrição'}</span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">{formatCurrency(Number(cob.valor))}</span>
                          {statusPill(cob.status)}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 pl-[52px]">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-foreground-muted">
                          <TipoBadge tipo={cob.tipo} />
                          <span>{FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}</span>
                          {cob.conta_id && contaById.get(cob.conta_id) && <span>· {contaById.get(cob.conta_id)!.nome}</span>}
                          {cob.enviar_fim_semana === false && <span className="inline-flex items-center gap-1"><CalendarOff className="h-3 w-3" />sem fim de semana</span>}
                        </div>
                        <AcoesMenu cob={cob} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SectionCard flush className="overflow-hidden">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-5 md:pl-6">
                  <Checkbox checked={todasSelecionadas} onCheckedChange={toggleTodas} aria-label="Selecionar todas" />
                </TableHead>
                <Th label="Cliente" onClick={() => toggleSort('cliente')} icon={sortIcon('cliente')} />
                <Th label="Descrição" onClick={() => toggleSort('descricao')} icon={sortIcon('descricao')} />
                <Th label="Tipo" onClick={() => toggleSort('tipo')} icon={sortIcon('tipo')} />
                <Th label="Valor" onClick={() => toggleSort('valor')} icon={sortIcon('valor')} align="right" />
                <Th label="Vencimento" onClick={() => toggleSort('vencimento')} icon={sortIcon('vencimento')} />
                <TableHead className="px-3">Forma</TableHead>
                <TableHead className="px-3">Conta</TableHead>
                <Th label="Status" onClick={() => toggleSort('status')} icon={sortIcon('status')} />
                <TableHead className="pr-5 md:pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((cob) => {
                const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
                const conta = cob.conta_id ? contaById.get(cob.conta_id) : undefined;
                return (
                  <TableRow key={cob.id} data-state={selecionadas.has(cob.id) ? 'selected' : undefined} className="border-b border-border">
                    <TableCell className="pl-5 md:pl-6">
                      <Checkbox checked={selecionadas.has(cob.id)} onCheckedChange={() => toggleSel(cob.id)} aria-label="Selecionar cobrança" />
                    </TableCell>
                    <TableCell className="px-3 font-medium text-foreground">
                      <div className="flex min-w-0 items-center gap-3">
                        <InitialsAvatar nome={cli?.nome || cob.asaas_customer_nome} className="h-9 w-9 rounded-[12px] text-[12px]" />
                        <div className="flex min-w-0 items-center gap-1.5">
                          {cli?.nome ? (
                            <span className="truncate font-semibold">{cli.nome}</span>
                          ) : cob.asaas_customer_nome ? (
                            <button onClick={() => abrirCliente(cob)} className="group flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 text-left transition-colors hover:bg-surface-2" title="Vir do Asaas — clique para vincular a um cliente">
                              <span className="truncate text-foreground-muted">{cob.asaas_customer_nome}</span>
                              <span className="shrink-0 rounded-full bg-info-bg px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-info-fg">Asaas · vincular</span>
                            </button>
                          ) : (
                            <button onClick={() => abrirCliente(cob)} className="rounded-full px-1.5 py-0.5 text-left font-semibold text-primary transition-colors hover:bg-surface-2">
                              Vincular cliente
                            </button>
                          )}
                          {cob.linhas.length > 1 && <GrupoChip qtd={cob.linhas.length} />}
                          {cob.notas.length > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary" aria-label={`${cob.notas.length} nota(s) fiscal(is) anexada(s)`}>
                              <Paperclip className="h-3.5 w-3.5" />{cob.notas.length > 1 && cob.notas.length}
                            </span>
                          )}
                          {!cob.notas.length && cob.nota_fiscal_enviada && <FileText className="h-3.5 w-3.5 shrink-0 text-success-fg" aria-label="Nota fiscal enviada" />}
                          {cob.exigir_nf && !cob.notas.length && !cob.nota_fiscal_enviada && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-warning-fg" aria-label="Exige nota fiscal" />}
                          {cob.enviar_fim_semana === false && <CalendarOff className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" aria-label="Não dispara no fim de semana" />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate px-3 text-foreground-muted">{cob.descricao || '—'}</TableCell>
                    <TableCell className="px-3"><TipoBadge tipo={cob.tipo} /></TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-right font-heading font-semibold tabular-nums tracking-[-0.02em] text-foreground">{formatCurrency(Number(cob.valor))}</TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-foreground-muted">{formatDate(cob.vencimento)}</TableCell>
                    <TableCell className="px-3">
                      {cob.status !== 'pago' && cob.status !== 'cancelado' ? (
                        <button onClick={() => abrirForma(cob)} className="whitespace-nowrap rounded-full px-2 py-0.5 text-left text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground">
                          {FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}
                        </button>
                      ) : (
                        <span className="whitespace-nowrap px-2 text-foreground-muted">{FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3">
                      <button onClick={() => abrirConta(cob)} className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-left transition-colors hover:bg-surface-2', conta ? 'text-foreground-muted' : 'font-medium text-primary')}>
                        {conta?.nome || 'Definir'}
                      </button>
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex flex-col items-start gap-1">
                        {statusPill(cob.status)}
                        {!cob.receita_id && cob.status !== 'cancelado' && cob.status !== 'estornado' && (
                          <button onClick={() => setConciliarOpen(true)} className="text-[10.5px] font-semibold text-warning-fg hover:underline">sem receita</button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-5 text-right md:pr-6"><AcoesMenu cob={cob} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      )}


      {/* Sheet: Nova cobrança avulsa */}
      <Sheet open={avulsaOpen} onOpenChange={setAvulsaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[520px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[480px] space-y-6 pb-6 pt-1">
            <SheetHeading eyebrow="Cobrança" title="Nova cobrança avulsa" />

            <FormSection label="Cliente">
              <div className="space-y-1.5">
                <Label className="sr-only">Cliente</Label>
                <select
                  value={avulsa.cliente_id}
                  onChange={(e) => setAvulsa((p) => ({ ...p, cliente_id: e.target.value }))}
                  className={NATIVE_SELECT_CLS}
                >
                  <option value="">Selecione…</option>
                  {clientesAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </FormSection>

            <FormSection label="Valor e vencimento">
              {/* Parcelar com datas/valores personalizados */}
              <div className="flex items-center justify-between gap-3 rounded-[20px] border border-border px-3.5 py-3">
                <div className="min-w-0">
                  <Label className="text-[13.5px] font-semibold">Parcelar</Label>
                  <p className="text-[11.5px] text-foreground-muted">Cada parcela vira uma cobrança no Asaas, com data e valor que você define.</p>
                </div>
                <Switch checked={parcelar} onCheckedChange={(v) => setParcelar(v)} />
              </div>

              {!parcelar ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px] text-foreground-muted">Valor (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={avulsa.valor} onChange={(e) => setAvulsa((p) => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
                  </div>
                  <DatePickerField label="Vencimento" value={avulsa.vencimento || undefined} onChange={(d) => setAvulsa((p) => ({ ...p, vencimento: d }))} required />
                </div>
              ) : (
                <div className="space-y-3.5 rounded-[20px] border border-border p-3.5">
                  {/* Gerador */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-foreground-muted">Valor total (R$)</Label>
                      <Input type="number" step="0.01" min="0" value={pc.total} onChange={(e) => setPc((p) => ({ ...p, total: e.target.value }))} placeholder="1.200,00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-foreground-muted">Nº de parcelas</Label>
                      <Input type="number" min="2" max="60" step="1" value={pc.count} onChange={(e) => setPc((p) => ({ ...p, count: parseInt(e.target.value) || 2 }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-foreground-muted">1ª parcela</Label>
                      <Input type="date" value={pc.first} onChange={(e) => setPc((p) => ({ ...p, first: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-foreground-muted">A cada (dias)</Label>
                      <Input type="number" min="1" step="1" value={pc.intervalo} onChange={(e) => setPc((p) => ({ ...p, intervalo: parseInt(e.target.value) || 30 }))} placeholder="30" />
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={gerarParcelas}>Gerar parcelas</Button>

                  {pcRows.length > 0 && (
                    <>
                      <div className="max-h-64 overflow-y-auto border-t border-border pr-0.5">
                        {pcRows.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
                            <span className="w-6 shrink-0 text-[12px] font-semibold text-foreground-muted">{i + 1}ª</span>
                            <Input type="date" value={r.vencimento} onChange={(e) => setPcRows((prev) => prev.map((x, j) => j === i ? { ...x, vencimento: e.target.value } : x))} className="min-w-0 flex-1" />
                            <Input type="number" step="0.01" min="0" value={r.valor} onChange={(e) => setPcRows((prev) => prev.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} className="w-28 tabular-nums" />
                            <button type="button" aria-label="Remover parcela" onClick={() => setPcRows((prev) => prev.filter((_, j) => j !== i))} className="no-touch-min grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger-fg hover:bg-danger-bg">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <button type="button" onClick={() => setPcRows((prev) => [...prev, { valor: '0', vencimento: format(addDays(parseISO(prev[prev.length - 1]?.vencimento || format(new Date(), 'yyyy-MM-dd')), Math.max(1, Number(pc.intervalo) || 30)), 'yyyy-MM-dd') }])} className="font-semibold text-primary hover:underline">+ Adicionar parcela</button>
                        <span className="text-foreground-muted">Soma: <b className="font-heading tabular-nums text-foreground">{formatCurrency(somaParcelas)}</b> ({pcRows.length}x)</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </FormSection>

            <FormSection label="Detalhes">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-foreground-muted">Descrição</Label>
                <Input value={avulsa.descricao} onChange={(e) => setAvulsa((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex.: Serviço avulso setembro" />
              </div>
            </FormSection>

            <FormSection label="Pagamento">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-foreground-muted">Forma de pagamento</Label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {FORMAS.map((f) => (
                    <ChoiceChip key={f.value} active={avulsa.forma === f.value} onClick={() => setAvulsa((p) => ({ ...p, forma: f.value }))}>
                      {f.label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-foreground-muted">Conta (recebimento)</Label>
                <select
                  value={avulsa.conta_id}
                  onChange={(e) => setAvulsa((p) => ({ ...p, conta_id: e.target.value }))}
                  className={NATIVE_SELECT_CLS}
                >
                  <option value="">Sem conta (defino depois)</option>
                  {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-foreground-muted">Multa atraso %</Label>
                  <Input type="number" step="0.01" min="0" value={avulsa.multa} onChange={(e) => setAvulsa((p) => ({ ...p, multa: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-foreground-muted">Juros ao mês %</Label>
                  <Input type="number" step="0.01" min="0" value={avulsa.juros} onChange={(e) => setAvulsa((p) => ({ ...p, juros: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <p className="text-[11.5px] leading-snug text-foreground-muted">Multa/juros só incidem se atrasar. Juros é <b>ao mês</b> (proporcional aos dias de atraso). O valor recebido de juros/multa entra como receita extra na baixa.</p>
            </FormSection>

            <div className="border-t border-border pt-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleCriarAvulsa}
                disabled={avulsaSaving || !avulsa.cliente_id || (parcelar ? pcRows.length < 2 : (!avulsa.valor || !avulsa.vencimento))}
              >
                {avulsaSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {parcelar ? `Criar ${pcRows.length || ''}${pcRows.length ? 'x' : ''} parcela(s) no Asaas` : 'Criar cobrança no Asaas'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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

      {/* Sheet: alterar forma de recebimento */}
      <Sheet open={formaOpen} onOpenChange={setFormaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[80dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[460px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[420px] space-y-5 pb-6 pt-1">
            <SheetHeading
              eyebrow="Cobrança"
              title="Forma de recebimento"
              subtitle={formaCob ? <>{(formaCob.cliente_id && clienteById.get(formaCob.cliente_id)?.nome) || '—'} · {formatCurrency(Number(formaCob.valor))}</> : undefined}
            />
            <FormSection label="Forma">
              <div className="grid grid-cols-2 gap-2">
                {FORMAS.map((f) => (
                  <ChoiceChip key={f.value} active={formaSel === f.value} onClick={() => setFormaSel(f.value)} className="h-11 text-sm">
                    {f.label}
                  </ChoiceChip>
                ))}
              </div>
              <p className="text-[11.5px] text-foreground-muted">
                {formaCob?.tipo === 'recorrente' ? 'Atualiza a assinatura e as faturas pendentes no Asaas.' : 'Atualiza a fatura no Asaas.'} O link de pagamento continua o mesmo.
              </p>
            </FormSection>
            <SheetFooter>
              <Button variant="outline" size="lg" onClick={() => setFormaOpen(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleSalvarForma} disabled={formaSaving}>
                {formaSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: definir/alterar conta de recebimento */}
      <Sheet open={contaOpen} onOpenChange={setContaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[80dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[460px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[420px] space-y-5 pb-6 pt-1">
            <SheetHeading
              eyebrow="Cobrança"
              title="Conta de recebimento"
              subtitle={contaCob ? <>{(contaCob.cliente_id && clienteById.get(contaCob.cliente_id)?.nome) || '—'} · {formatCurrency(Number(contaCob.valor))}</> : undefined}
            />
            <FormSection label="Conta">
              <div className="space-y-1.5">
                <Label className="sr-only">Conta</Label>
                <select
                  value={contaSel}
                  onChange={(e) => setContaSel(e.target.value)}
                  className={NATIVE_SELECT_CLS}
                >
                  <option value="">Sem conta</option>
                  {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <p className="text-[11.5px] text-foreground-muted">Atualiza também a receita "a receber" vinculada.</p>
              </div>
            </FormSection>
            <SheetFooter>
              <Button variant="outline" size="lg" onClick={() => setContaOpen(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleSalvarConta} disabled={contaSaving}>
                {contaSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: vincular cliente (cobrança veio do Asaas sem cliente) */}
      <Sheet open={clienteOpen} onOpenChange={setClienteOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[80dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[460px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[420px] space-y-5 pb-6 pt-1">
            <SheetHeading
              eyebrow="Cobrança"
              title="Vincular a um cliente"
              subtitle={clienteCob ? <>{clienteCob.descricao || '—'} · {formatCurrency(Number(clienteCob.valor))} · vence {formatDate(clienteCob.vencimento)}</> : undefined}
            />
            {clienteCob?.asaas_customer_nome && !clienteCob?.cliente_id && (
              <InlineNotice tone="info" icon={<Users />}>
                No Asaas está como <b>{clienteCob.asaas_customer_nome}</b>. Confirme o cliente do BALANX abaixo (já sugeri um se o nome bateu).
              </InlineNotice>
            )}
            <FormSection label="Cliente">
              <div className="space-y-1.5">
                <Label className="sr-only">Cliente</Label>
                <select
                  value={clienteSel}
                  onChange={(e) => setClienteSel(e.target.value)}
                  className={NATIVE_SELECT_CLS}
                >
                  <option value="">Sem cliente</option>
                  {clientesOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <p className="text-[11.5px] text-foreground-muted">Liga também a receita "a receber" a esse cliente. Ideal para cobranças criadas direto no Asaas.</p>
              </div>
            </FormSection>
            <SheetFooter>
              <Button variant="outline" size="lg" onClick={() => setClienteOpen(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleSalvarCliente} disabled={clienteSaving}>
                {clienteSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: E-mail */}
      <Sheet open={emOpen} onOpenChange={setEmOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[520px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[480px] space-y-6 pb-6 pt-1">
            <SheetHeading
              eyebrow="Cobrança"
              title="Enviar por e-mail"
              subtitle={emCob ? <>{emCob.descricao || '—'} · {formatCurrency(Number(emCob.valor))} · vence {formatDate(emCob.vencimento)}</> : undefined}
            />
            <FormSection label="Destinatário">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-foreground-muted">Para (e-mail do cliente)</Label>
                <Input type="email" value={emPara} onChange={(e) => setEmPara(e.target.value)} placeholder="contato@cliente.com" />
              </div>
            </FormSection>
            <FormSection label="Mensagem">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-foreground-muted">Mensagem de abertura</Label>
                <Textarea value={emIntro} onChange={(e) => setEmIntro(e.target.value)} rows={3} className="text-[13px] leading-relaxed" />
                <p className="text-[11.5px] text-foreground-muted">{emCob?.envio_pix && pixCfg.chave ? 'O e-mail vai com valor, vencimento e a chave PIX (sem boleto nem link do Asaas).' : 'O e-mail já inclui valor, vencimento e o botão de pagamento do Asaas.'}</p>
              </div>
              {emCob?.notas.length ? (
                <InlineNotice tone="neutral" icon={<FileText className="text-primary" />}>
                  <NotasAnexo notas={emCob.notas} onVer={abrirNota} />
                </InlineNotice>
              ) : emBloqueado ? (
                <InlineNotice tone="warning" icon={<ShieldCheck />}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">Esta cobrança exige nota fiscal.</span>
                    <button onClick={() => { setEmOpen(false); pedirUploadNota(emCob!); }} className="shrink-0 font-semibold hover:underline">Anexar</button>
                  </div>
                </InlineNotice>
              ) : null}
            </FormSection>
            <SheetFooter>
              <Button variant="outline" size="lg" onClick={() => setEmOpen(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleEnviarEmail} disabled={emSending || emBloqueado || !emPara.trim()}>
                {emSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Enviar e-mail
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: WhatsApp */}
      <Sheet open={waOpen} onOpenChange={setWaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[520px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[480px] space-y-6 pb-6 pt-1">
            <SheetHeading eyebrow="Cobrança" title="Enviar por WhatsApp" />
            <FormSection label="Destinatário">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-foreground-muted">Telefone (com DDD)</Label>
                <Input value={waTel} onChange={(e) => setWaTel(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </FormSection>
            <FormSection label="Mensagem">
              <div className="space-y-1.5">
                <Label className="sr-only">Mensagem</Label>
                <Textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={10} className="font-mono text-[13px] leading-relaxed" />
              </div>
              {/* Status da nota fiscal */}
              {waCob?.notas.length ? (
                <InlineNotice tone="neutral" icon={<FileText className="text-primary" />}>
                  <NotasAnexo notas={waCob.notas} onVer={abrirNota} />
                </InlineNotice>
              ) : waCob?.exigir_nf && !waCob?.nota_fiscal_enviada ? (
                <InlineNotice tone="warning" icon={<ShieldCheck />}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">Esta cobrança exige nota fiscal.</span>
                    <button onClick={() => { setWaOpen(false); pedirUploadNota(waCob); }} className="shrink-0 font-semibold hover:underline">Anexar</button>
                  </div>
                </InlineNotice>
              ) : null}
            </FormSection>
            <SheetFooter>
              <Button variant="outline" size="lg" onClick={() => setWaOpen(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleEnviarWa} disabled={waSending || waBloqueado || !waTel.trim() || !waText.trim()}>
                {waSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                Enviar
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

// Fatura que cobra vários contratos num boleto só
function GrupoChip({ qtd }: { qtd: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-info-bg px-2 py-px text-[10.5px] font-semibold text-info-fg" title="Boleto único de vários contratos">
      <Layers className="h-3 w-3" /> {qtd} contratos
    </span>
  );
}

function Th({ label, onClick, icon, align = 'left', className }: { label: string; onClick: () => void; icon: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <TableHead className={cn('px-3', align === 'right' && 'text-right', className)}>
      <button onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', align === 'right' && 'flex-row-reverse')}>
        {label} {icon}
      </button>
    </TableHead>
  );
}

