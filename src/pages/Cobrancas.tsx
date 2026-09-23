import { useMemo, useRef, useState } from 'react';
import { useActionParam } from '@/hooks/useActionParam';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { IconButton } from '@/components/shared/IconButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCobrancas,
  preencherTemplate,
  COBRANCA_STATUS_LABEL,
  type Cobranca,
} from '@/hooks/useCobrancas';
import { useClientes } from '@/hooks/useClientes';
import { useContas } from '@/hooks/useContas';
import {
  RefreshCw, Plus, MoreHorizontal, ExternalLink, MessageCircle, HandCoins,
  XCircle, Trash2, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Repeat, Receipt, Wallet, CreditCard,
  Paperclip, FileText, ShieldCheck, ShieldOff,
} from 'lucide-react';

const toneCls: Record<string, string> = {
  success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]',
  muted: 'bg-white/8 text-foreground-muted',
};

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
type SortKey = 'cliente' | 'descricao' | 'tipo' | 'valor' | 'vencimento' | 'status';

function statusPill(status: string) {
  const meta = COBRANCA_STATUS_LABEL[status] ?? { label: status, tone: 'muted' as const };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold', toneCls[meta.tone])}>{meta.label}</span>;
}

export default function Cobrancas() {
  const isMobile = useIsMobile();
  const {
    cobrancas, loading, busyId,
    criarAvulsa, cancelar, excluir, sincronizar, receberManual, atualizarConta, atualizarForma, enviarWhatsapp,
    anexarNota, removerNota, setExigirNf, notaSignedUrl, whatsappTemplate,
  } = useCobrancas();
  const { clientes } = useClientes();
  const { contas } = useContas();

  const clienteById = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const contaById = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todas');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'vencimento', dir: 'asc' });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortIcon = (key: SortKey) =>
    sort.key !== key ? <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      : sort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;

  // Totais (todas as cobranças, ignorando canceladas para "a receber")
  const totais = useMemo(() => {
    let aReceber = 0, vencido = 0, recebido = 0;
    for (const c of cobrancas) {
      const v = Number(c.valor) || 0;
      if (c.status === 'pendente') aReceber += v;
      else if (c.status === 'vencido') vencido += v;
      else if (c.status === 'pago') recebido += v;
    }
    return { aReceber, vencido, recebido };
  }, [cobrancas]);

  const filtradas = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const list = cobrancas.filter((c) => {
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
  }, [cobrancas, tipoFiltro, statusFiltro, busca, sort, clienteById]);

  // ===== WhatsApp =====
  const [waOpen, setWaOpen] = useState(false);
  const [waTel, setWaTel] = useState('');
  const [waText, setWaText] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waCob, setWaCob] = useState<Cobranca | null>(null);
  const openWhatsapp = (cob: Cobranca) => {
    const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
    setWaCob(cob);
    setWaTel(cli?.telefone || '');
    setWaText(preencherTemplate(whatsappTemplate, {
      cliente: cli?.nome || 'cliente',
      descricao: cob.descricao || 'cobrança',
      valor: formatCurrency(Number(cob.valor)),
      vencimento: formatDate(cob.vencimento),
      link: cob.invoice_url || '',
    }));
    setWaOpen(true);
  };
  const waBloqueado = !!waCob?.exigir_nf && !waCob?.nota_fiscal_path;
  const handleEnviarWa = async () => {
    if (!waCob) return;
    if (waBloqueado) { toast.error('Esta cobrança exige nota fiscal anexada para disparar.'); return; }
    setWaSending(true);
    let doc: { url: string; nome: string } | null = null;
    if (waCob.nota_fiscal_path) {
      const url = await notaSignedUrl(waCob.nota_fiscal_path);
      if (url) doc = { url, nome: waCob.nota_fiscal_nome || 'nota-fiscal.pdf' };
    }
    const ok = await enviarWhatsapp(waTel, waText, doc);
    setWaSending(false);
    if (ok) setWaOpen(false);
  };

  // ===== Nova cobrança avulsa =====
  const [avulsaOpen, setAvulsaOpen] = useState(false);
  const emptyAvulsa = { cliente_id: '', valor: '', vencimento: '', descricao: '', forma: 'UNDEFINED', conta_id: '', multa: '', juros: '' };
  const [avulsa, setAvulsa] = useState(emptyAvulsa);
  const [avulsaSaving, setAvulsaSaving] = useState(false);
  const abrirAvulsa = () => { setAvulsa(emptyAvulsa); setAvulsaOpen(true); };
  useActionParam('novo', abrirAvulsa);
  const handleCriarAvulsa = async () => {
    if (!avulsa.cliente_id || !avulsa.valor || !avulsa.vencimento) return;
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
  const uploadTargetRef = useRef<string | null>(null);
  const pedirUploadNota = (cobranca_id: string) => { uploadTargetRef.current = cobranca_id; fileInputRef.current?.click(); };
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadTargetRef.current;
    e.target.value = '';
    if (file && id) await anexarNota(id, file);
  };
  const abrirNota = async (path: string) => {
    const url = await notaSignedUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  // ===== Menu de ações por cobrança =====
  const AcoesMenu = ({ cob }: { cob: Cobranca }) => {
    const busy = busyId === cob.id;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface/60 text-foreground-muted transition-colors hover:bg-surface-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1.5 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-2xl">
          {cob.invoice_url && (
            <a href={cob.invoice_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-white/5">
              <ExternalLink className="h-4 w-4 text-foreground-muted" /> Abrir link de pagamento
            </a>
          )}
          <button onClick={() => openWhatsapp(cob)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
            <MessageCircle className="h-4 w-4 text-[hsl(var(--success))]" /> Enviar por WhatsApp
          </button>
          {cob.status !== 'pago' && (
            <button onClick={() => receberManual(cob.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
              <HandCoins className="h-4 w-4 text-[hsl(var(--success))]" /> Identificar pagamento manual
            </button>
          )}
          {/* Nota fiscal (PDF) */}
          {cob.nota_fiscal_path ? (
            <>
              <button onClick={() => abrirNota(cob.nota_fiscal_path!)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
                <FileText className="h-4 w-4 text-primary" /> Ver nota fiscal
              </button>
              <button onClick={() => pedirUploadNota(cob.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
                <Paperclip className="h-4 w-4 text-foreground-muted" /> Trocar nota fiscal
              </button>
              <button onClick={() => removerNota(cob.id, cob.nota_fiscal_path)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[hsl(var(--danger))] transition-colors hover:bg-[hsl(var(--danger))]/10">
                <Trash2 className="h-4 w-4" /> Remover nota fiscal
              </button>
            </>
          ) : (
            <button onClick={() => pedirUploadNota(cob.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
              <Paperclip className="h-4 w-4 text-foreground-muted" /> Anexar nota fiscal (PDF)
            </button>
          )}
          <button onClick={() => setExigirNf(cob.id, !cob.exigir_nf)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
            {cob.exigir_nf ? <ShieldOff className="h-4 w-4 text-foreground-muted" /> : <ShieldCheck className="h-4 w-4 text-foreground-muted" />}
            {cob.exigir_nf ? 'Não exigir NF p/ disparar' : 'Exigir NF p/ disparar'}
          </button>
          {cob.status !== 'pago' && cob.status !== 'cancelado' && (
            <button onClick={() => abrirForma(cob)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
              <CreditCard className="h-4 w-4 text-foreground-muted" /> Alterar forma de recebimento
            </button>
          )}
          <button onClick={() => abrirConta(cob)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
            <Wallet className="h-4 w-4 text-foreground-muted" /> {cob.conta_id ? 'Alterar conta de recebimento' : 'Definir conta de recebimento'}
          </button>
          <button onClick={() => sincronizar(cob.contrato_id || undefined)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
            <RefreshCw className="h-4 w-4 text-foreground-muted" /> Sincronizar status
          </button>
          <button onClick={() => cancelar(cob.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
            <XCircle className="h-4 w-4 text-foreground-muted" /> Cancelar cobrança
          </button>
          <button onClick={() => excluir(cob.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[hsl(var(--danger))] transition-colors hover:bg-[hsl(var(--danger))]/10">
            <Trash2 className="h-4 w-4" /> Excluir cobrança
          </button>
        </PopoverContent>
      </Popover>
    );
  };

  const TipoBadge = ({ tipo }: { tipo: string }) =>
    tipo === 'recorrente' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
        <Repeat className="h-3 w-3" /> Recorrente
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-foreground-muted">
        <Receipt className="h-3 w-3" /> Avulsa
      </span>
    );

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
        eyebrow="Financeiro"
        title="Cobranças"
        actions={
          <>
            <IconButton label="Sincronizar com Asaas" onClick={() => sincronizar()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </IconButton>
            <IconButton label="Nova cobrança avulsa" emphasis="primary" onClick={abrirAvulsa}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </>
        }
      />

      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChosen} />

      <KpiTriple
        items={[
          { label: 'A receber', value: totais.aReceber, tone: 'amber' },
          { label: 'Vencido', value: totais.vencido, tone: 'red' },
          { label: 'Recebido', value: totais.recebido, tone: 'green' },
        ]}
      />

      {/* Filtros */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['todas', 'recorrente', 'avulsa'] as TipoFiltro[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                tipoFiltro === t ? 'bg-primary text-white' : 'border border-border/60 bg-surface/60 text-foreground-muted hover:bg-surface-2',
              )}
            >
              {t === 'todas' ? 'Todas' : t === 'recorrente' ? 'Recorrentes' : 'Avulsas'}
            </button>
          ))}
          <div className="ml-auto w-full sm:w-56">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou descrição…" className="h-9" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFiltro(s.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                statusFiltro === s.value ? 'bg-surface-2 text-foreground ring-1 ring-border-strong' : 'text-foreground-muted hover:bg-white/5',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" strokeWidth={1.6} />}
          title="Nenhuma cobrança"
          description={cobrancas.length === 0 ? 'Crie uma cobrança avulsa ou gere pelo contrato.' : 'Nenhuma cobrança bate com os filtros.'}
        />
      ) : isMobile ? (
        <div className="space-y-2.5">
          {filtradas.map((cob) => {
            const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
            return (
              <div key={cob.id} className="rounded-2xl border border-border/60 bg-surface/70 p-3.5 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{cli?.nome || '—'}</div>
                    <div className="truncate text-xs text-foreground-muted">{cob.descricao || 'Sem descrição'}</div>
                  </div>
                  <AcoesMenu cob={cob} />
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold tabular-nums text-foreground">{formatCurrency(Number(cob.valor))}</span>
                  {statusPill(cob.status)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
                  <TipoBadge tipo={cob.tipo} />
                  <span>Vence {formatDate(cob.vencimento)}</span>
                  <span>{FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}</span>
                  {cob.conta_id && contaById.get(cob.conta_id) && <span>· {contaById.get(cob.conta_id)!.nome}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-foreground-muted">
                <Th label="Cliente" onClick={() => toggleSort('cliente')} icon={sortIcon('cliente')} />
                <Th label="Descrição" onClick={() => toggleSort('descricao')} icon={sortIcon('descricao')} />
                <Th label="Tipo" onClick={() => toggleSort('tipo')} icon={sortIcon('tipo')} />
                <Th label="Valor" onClick={() => toggleSort('valor')} icon={sortIcon('valor')} align="right" />
                <Th label="Vencimento" onClick={() => toggleSort('vencimento')} icon={sortIcon('vencimento')} />
                <th className="px-3 py-2.5 font-semibold">Forma</th>
                <th className="px-3 py-2.5 font-semibold">Conta</th>
                <Th label="Status" onClick={() => toggleSort('status')} icon={sortIcon('status')} />
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((cob) => {
                const cli = cob.cliente_id ? clienteById.get(cob.cliente_id) : undefined;
                const conta = cob.conta_id ? contaById.get(cob.conta_id) : undefined;
                return (
                  <tr key={cob.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{cli?.nome || '—'}</span>
                        {cob.nota_fiscal_path && <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Nota fiscal anexada" />}
                        {cob.exigir_nf && !cob.nota_fiscal_path && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" aria-label="Exige nota fiscal" />}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[220px] truncate text-foreground-muted">{cob.descricao || '—'}</td>
                    <td className="px-3 py-3"><TipoBadge tipo={cob.tipo} /></td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{formatCurrency(Number(cob.valor))}</td>
                    <td className="px-3 py-3 text-foreground-muted">{formatDate(cob.vencimento)}</td>
                    <td className="px-3 py-3">
                      {cob.status !== 'pago' && cob.status !== 'cancelado' ? (
                        <button onClick={() => abrirForma(cob)} className="rounded-md px-1.5 py-0.5 text-left text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground">
                          {FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}
                        </button>
                      ) : (
                        <span className="px-1.5 text-foreground-muted">{FORMA_LABEL[cob.forma_pagamento] || cob.forma_pagamento}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => abrirConta(cob)} className={cn('rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-white/5', conta ? 'text-foreground-muted' : 'text-primary')}>
                        {conta?.nome || 'Definir'}
                      </button>
                    </td>
                    <td className="px-3 py-3">{statusPill(cob.status)}</td>
                    <td className="px-3 py-3 text-right"><AcoesMenu cob={cob} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet: Nova cobrança avulsa */}
      <Sheet open={avulsaOpen} onOpenChange={setAvulsaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.95] backdrop-blur-2xl sm:max-w-[520px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[480px] pb-6 pt-1">
            <p className="text-xs font-medium text-foreground-muted">Cobrança</p>
            <h2 className="mt-0.5 mb-4 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Nova cobrança avulsa</h2>

            <div className="space-y-3.5">
              <div>
                <Label className="text-xs">Cliente</Label>
                <select
                  value={avulsa.cliente_id}
                  onChange={(e) => setAvulsa((p) => ({ ...p, cliente_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-border-strong"
                >
                  <option value="">Selecione…</option>
                  {clientesAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={avulsa.valor} onChange={(e) => setAvulsa((p) => ({ ...p, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
                </div>
                <DatePickerField label="Vencimento" value={avulsa.vencimento || undefined} onChange={(d) => setAvulsa((p) => ({ ...p, vencimento: d }))} required />
              </div>

              <div>
                <Label className="text-xs">Descrição</Label>
                <Input value={avulsa.descricao} onChange={(e) => setAvulsa((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex.: Serviço avulso setembro" className="mt-1" />
              </div>

              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {FORMAS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setAvulsa((p) => ({ ...p, forma: f.value }))}
                      className={cn('rounded-lg border py-1.5 text-[11px] font-semibold transition-colors', avulsa.forma === f.value ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Conta (recebimento)</Label>
                <select
                  value={avulsa.conta_id}
                  onChange={(e) => setAvulsa((p) => ({ ...p, conta_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-border-strong"
                >
                  <option value="">Sem conta (defino depois)</option>
                  {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Multa atraso %</Label>
                  <Input type="number" step="0.01" min="0" value={avulsa.multa} onChange={(e) => setAvulsa((p) => ({ ...p, multa: e.target.value }))} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Juros ao mês %</Label>
                  <Input type="number" step="0.01" min="0" value={avulsa.juros} onChange={(e) => setAvulsa((p) => ({ ...p, juros: e.target.value }))} placeholder="0" className="mt-1" />
                </div>
              </div>
              <p className="-mt-1 text-[11px] leading-snug text-foreground-muted">Multa/juros só incidem se atrasar. Juros é <b>ao mês</b> (proporcional aos dias de atraso). O valor recebido de juros/multa entra como receita extra na baixa.</p>

              <Button
                className="w-full"
                onClick={handleCriarAvulsa}
                disabled={avulsaSaving || !avulsa.cliente_id || !avulsa.valor || !avulsa.vencimento}
              >
                {avulsaSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar cobrança no Asaas
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: alterar forma de recebimento */}
      <Sheet open={formaOpen} onOpenChange={setFormaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[80dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.95] backdrop-blur-2xl sm:max-w-[460px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[420px] pb-6 pt-1">
            <p className="text-xs font-medium text-foreground-muted">Cobrança</p>
            <h2 className="mt-0.5 mb-1 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Forma de recebimento</h2>
            {formaCob && (
              <p className="mb-4 text-sm text-foreground-muted">
                {(formaCob.cliente_id && clienteById.get(formaCob.cliente_id)?.nome) || '—'} · {formatCurrency(Number(formaCob.valor))}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormaSel(f.value)}
                  className={cn('rounded-lg border py-2.5 text-sm font-semibold transition-colors', formaSel === f.value ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted hover:bg-surface-2')}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-foreground-muted">
              {formaCob?.tipo === 'recorrente' ? 'Atualiza a assinatura e as faturas pendentes no Asaas.' : 'Atualiza a fatura no Asaas.'} O link de pagamento continua o mesmo.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setFormaOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSalvarForma} disabled={formaSaving}>
                {formaSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: definir/alterar conta de recebimento */}
      <Sheet open={contaOpen} onOpenChange={setContaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[80dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.95] backdrop-blur-2xl sm:max-w-[460px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[420px] pb-6 pt-1">
            <p className="text-xs font-medium text-foreground-muted">Cobrança</p>
            <h2 className="mt-0.5 mb-1 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Conta de recebimento</h2>
            {contaCob && (
              <p className="mb-4 text-sm text-foreground-muted">
                {(contaCob.cliente_id && clienteById.get(contaCob.cliente_id)?.nome) || '—'} · {formatCurrency(Number(contaCob.valor))}
              </p>
            )}
            <Label className="text-xs">Conta</Label>
            <select
              value={contaSel}
              onChange={(e) => setContaSel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-border-strong"
            >
              <option value="">Sem conta</option>
              {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <p className="mt-2 text-[11px] text-foreground-muted">Atualiza também a receita "a receber" vinculada.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setContaOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSalvarConta} disabled={contaSaving}>
                {contaSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: WhatsApp */}
      <Sheet open={waOpen} onOpenChange={setWaOpen}>
        <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.9] backdrop-blur-2xl sm:max-w-[520px] sm:mx-auto">
          <div className="mx-auto w-full max-w-[480px] pb-6 pt-1">
            <p className="text-xs font-medium text-foreground-muted">Cobrança</p>
            <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Enviar por WhatsApp</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs">Telefone (com DDD)</Label>
                <Input value={waTel} onChange={(e) => setWaTel(e.target.value)} placeholder="(11) 99999-9999" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={10} className="mt-1 font-mono text-[13px] leading-relaxed" />
              </div>
              {/* Status da nota fiscal */}
              {waCob?.nota_fiscal_path ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 text-xs text-foreground">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">Vai anexar: {waCob.nota_fiscal_nome || 'nota-fiscal.pdf'}</span>
                  <button onClick={() => abrirNota(waCob.nota_fiscal_path!)} className="ml-auto shrink-0 text-primary hover:underline">ver</button>
                </div>
              ) : waCob?.exigir_nf ? (
                <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-3 py-2 text-xs text-[hsl(var(--warning))]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Esta cobrança exige nota fiscal.</span>
                  <button onClick={() => { setWaOpen(false); pedirUploadNota(waCob.id); }} className="ml-auto shrink-0 font-semibold hover:underline">Anexar</button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setWaOpen(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleEnviarWa} disabled={waSending || waBloqueado || !waTel.trim() || !waText.trim()}>
                  {waSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Th({ label, onClick, icon, align = 'left' }: { label: string; onClick: () => void; icon: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={cn('px-3 py-2.5 font-semibold', align === 'right' && 'text-right')}>
      <button onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', align === 'right' && 'flex-row-reverse')}>
        {label} {icon}
      </button>
    </th>
  );
}
