import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, ExternalLink, RefreshCw, XCircle, Trash2, Zap, Link2, Unlink, ChevronLeft, MessageCircle, HandCoins, Layers, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { COBRANCA_STATUS_LABEL, type Cobranca, type AsaasAssinatura } from '@/hooks/useCobrancas';
import { Button } from '@/components/ui/button';
import { ChoiceChip, NATIVE_SELECT_CLS, SECTION_LABEL_CLS } from '@/components/cobrancas/formParts';

const FORMAS: { value: string; label: string }[] = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

const toneCls: Record<string, string> = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  muted: 'bg-surface-2 text-foreground-muted',
};

const MENU_ITEM = 'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2';

interface Props {
  contratoId: string;
  cobranca?: Cobranca;
  busy?: boolean;
  contas: { id: string; nome: string; cor?: string | null }[];
  onCobrar: (forma: string, contaId: string | null, extra: { multa_percent: number; juros_percent: number }) => void;
  onListarAssinaturas: () => Promise<AsaasAssinatura[]>;
  onVincular: (subId: string, contaId: string | null) => void;
  onCancelar: () => void;
  onExcluir: () => void;
  onSincronizar: () => void;
  onWhatsapp: () => void;
  onReceberManual: () => void;
  /** Desfaz o vínculo do contrato com a assinatura do Asaas (não cancela no Asaas). */
  onDesvincular?: () => void;
  /** Contexto do contrato, para o popup de vincular mostrar de quem/qual é. */
  clienteNome?: string;
  contratoDescricao?: string;
  contratoValor?: number;
  /** Quantos contratos dividem esta fatura (agrupamento). 1 = cobrança normal. */
  grupoQtd?: number;
}

export function ContratoCobrancaCell({ contratoId, cobranca, busy, contas, onCobrar, onListarAssinaturas, onVincular, onCancelar, onExcluir, onSincronizar, onWhatsapp, onReceberManual, onDesvincular, clienteNome, contratoDescricao, contratoValor, grupoQtd = 1 }: Props) {
  const [forma, setForma] = useState('UNDEFINED');
  const [contaId, setContaId] = useState('');
  const [multa, setMulta] = useState('');
  const [juros, setJuros] = useState('');
  const [mode, setMode] = useState<'criar' | 'vincular'>('criar');
  const [assinaturas, setAssinaturas] = useState<AsaasAssinatura[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const abrirVincular = async () => {
    setMode('vincular');
    setLoadingList(true);
    const list = await onListarAssinaturas();
    setAssinaturas(list);
    setLoadingList(false);
  };

  if (busy) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> …</span>;
  }

  const contaSelect = (
    <select
      value={contaId}
      onChange={(e) => setContaId(e.target.value)}
      className={NATIVE_SELECT_CLS}
    >
      <option value="">Sem conta (defino depois)</option>
      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  );

  // Sem cobrança → criar nova OU vincular existente
  if (!cobranca) {
    return (
      <Popover onOpenChange={(o) => { if (!o) { setMode('criar'); setAssinaturas(null); } }}>
        <PopoverTrigger asChild>
          <button className="no-touch-min inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-foreground transition-colors hover:border-border-strong">
            <Zap className="h-3.5 w-3.5 text-primary" /> Cobrar via Asaas
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] max-w-[92vw] rounded-[20px] border border-border bg-surface p-4">
          {/* Contexto: de qual contrato/cliente é esta cobrança */}
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 text-primary"><Zap className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-foreground">{contratoDescricao || 'Contrato'}</p>
              <p className="truncate text-[12px] text-foreground-muted">
                {[clienteNome, contratoValor ? formatCurrency(Number(contratoValor)) : null].filter(Boolean).join(' · ') || 'Cobrança via Asaas'}
              </p>
            </div>
          </div>
          {mode === 'criar' ? (
            <>
              <p className={cn(SECTION_LABEL_CLS, 'mb-2')}>Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FORMAS.map((f) => (
                  <ChoiceChip key={f.value} active={forma === f.value} onClick={() => setForma(f.value)}>
                    {f.label}
                  </ChoiceChip>
                ))}
              </div>
              <p className={cn(SECTION_LABEL_CLS, 'mt-4 mb-2')}>Conta (recebimento)</p>
              {contaSelect}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-foreground-muted">Multa atraso %</p>
                  <Input type="number" step="0.01" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-foreground-muted">Juros ao mês %</p>
                  <Input type="number" step="0.01" min="0" value={juros} onChange={(e) => setJuros(e.target.value)} placeholder="0" />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-foreground-muted">Multa/juros só incidem se atrasar. Juros é <b>ao mês</b> (proporcional aos dias de atraso).</p>
              <Button onClick={() => onCobrar(forma, contaId || null, { multa_percent: parseFloat(multa) || 0, juros_percent: parseFloat(juros) || 0 })} className="mt-4 w-full" size="lg">
                Criar cobrança nova
              </Button>
              <button onClick={abrirVincular} className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-primary hover:underline">
                <Link2 className="h-3.5 w-3.5" /> Já existe no Asaas? Vincular
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setMode('criar')} className="mb-3 flex items-center gap-1 text-[12px] font-medium text-foreground-muted hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <p className={cn(SECTION_LABEL_CLS, 'mb-2')}>Conta (recebimento)</p>
              {contaSelect}
              <p className={cn(SECTION_LABEL_CLS, 'mt-4 mb-2')}>
                Assinaturas no Asaas{clienteNome ? <span className="normal-case text-foreground"> · {clienteNome}</span> : ''}
              </p>
              {loadingList ? (
                <div className="flex items-center gap-2 py-3 text-xs text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</div>
              ) : !assinaturas || assinaturas.length === 0 ? (
                <p className="py-2 text-xs text-foreground-muted">Nenhuma assinatura encontrada pra este cliente no Asaas.</p>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                  {assinaturas.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.vinculada}
                      onClick={() => onVincular(s.id, contaId || null)}
                      className={cn('w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-left transition-colors', s.vinculada ? 'opacity-60 cursor-not-allowed' : 'hover:border-border-strong hover:bg-surface-2')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">{formatCurrency(Number(s.value))}</span>
                        {s.vinculada
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-fg"><CheckCircle2 className="h-3 w-3" /> vinculada</span>
                          : <span className="text-[11px] text-foreground-muted">vence {s.nextDueDate || '—'}</span>}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-foreground-muted">{s.description || 'Sem descrição'}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px] font-medium text-foreground-muted">
                        {s.cycle && <span className="rounded-full bg-surface-2 px-2 py-0.5">{s.cycle}</span>}
                        {s.billingType && <span className="rounded-full bg-surface-2 px-2 py-0.5">{s.billingType}</span>}
                        {s.status && <span className="rounded-full bg-surface-2 px-2 py-0.5">{s.status}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  const meta = COBRANCA_STATUS_LABEL[cobranca.status] ?? { label: cobranca.status, tone: 'muted' as const };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn('no-touch-min inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold transition-opacity hover:opacity-80', toneCls[meta.tone])}>
          {meta.label}
          {grupoQtd > 1
            ? <span className="inline-flex items-center gap-0.5 opacity-80"><Layers className="h-3 w-3" />{grupoQtd}</span>
            : cobranca.tipo === 'recorrente' && <RefreshCw className="h-3 w-3 opacity-70" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 rounded-[20px] border border-border bg-surface p-1.5">
        {grupoQtd > 1 && (
          <p className="mb-1 flex items-start gap-1.5 rounded-xl bg-info-bg px-2.5 py-2 text-[11.5px] leading-snug text-info-fg">
            <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Boleto único de {grupoQtd} contratos. As ações abaixo valem para todos.
          </p>
        )}
        {cobranca.invoice_url && (
          <a href={cobranca.invoice_url} target="_blank" rel="noopener noreferrer" className={MENU_ITEM}>
            <ExternalLink className="h-4 w-4 text-foreground-muted" /> Abrir link de pagamento
          </a>
        )}
        <button onClick={onWhatsapp} className={MENU_ITEM}>
          <MessageCircle className="h-4 w-4 text-success-fg" /> Enviar por WhatsApp
        </button>
        {cobranca.status !== 'pago' && (
          <button onClick={onReceberManual} className={MENU_ITEM}>
            <HandCoins className="h-4 w-4 text-success-fg" /> Identificar pagamento manual
          </button>
        )}
        <button onClick={onSincronizar} className={MENU_ITEM}>
          <RefreshCw className="h-4 w-4 text-foreground-muted" /> Sincronizar status
        </button>
        <button onClick={onCancelar} className={MENU_ITEM}>
          <XCircle className="h-4 w-4 text-foreground-muted" /> Cancelar cobrança
        </button>
        {onDesvincular && cobranca.asaas_subscription_id && (
          <button onClick={onDesvincular} className={MENU_ITEM}>
            <Unlink className="h-4 w-4 text-foreground-muted" /> Desvincular do Asaas
          </button>
        )}
        <button onClick={onExcluir} className={cn(MENU_ITEM, 'text-danger-fg hover:bg-danger-bg')}>
          <Trash2 className="h-4 w-4" /> Excluir cobrança
        </button>
      </PopoverContent>
    </Popover>
  );
}
