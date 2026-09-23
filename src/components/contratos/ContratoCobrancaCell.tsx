import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, ExternalLink, RefreshCw, XCircle, Trash2, Zap, Link2, ChevronLeft, MessageCircle, HandCoins, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { COBRANCA_STATUS_LABEL, type Cobranca, type AsaasAssinatura } from '@/hooks/useCobrancas';

const FORMAS: { value: string; label: string }[] = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

const toneCls: Record<string, string> = {
  success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]',
  muted: 'bg-white/8 text-foreground-muted',
};

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
  /** Quantos contratos dividem esta fatura (agrupamento). 1 = cobrança normal. */
  grupoQtd?: number;
}

export function ContratoCobrancaCell({ contratoId, cobranca, busy, contas, onCobrar, onListarAssinaturas, onVincular, onCancelar, onExcluir, onSincronizar, onWhatsapp, onReceberManual, grupoQtd = 1 }: Props) {
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
      className="w-full rounded-lg border border-border/60 bg-surface/60 px-2.5 py-2 text-sm text-foreground outline-none focus:border-border-strong"
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
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur-xl transition-colors hover:bg-surface-2">
            <Zap className="h-3.5 w-3.5 text-primary" /> Cobrar via Asaas
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-2xl">
          {mode === 'criar' ? (
            <>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FORMAS.map((f) => (
                  <button key={f.value} onClick={() => setForma(f.value)} className={cn('rounded-lg border py-1.5 text-xs font-semibold transition-colors', forma === f.value ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}>
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Conta (recebimento)</p>
              {contaSelect}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Multa atraso %</p>
                  <Input type="number" step="0.01" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} placeholder="0" className="h-9 text-sm" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Juros ao mês %</p>
                  <Input type="number" step="0.01" min="0" value={juros} onChange={(e) => setJuros(e.target.value)} placeholder="0" className="h-9 text-sm" />
                </div>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-foreground-muted">Multa/juros só incidem se atrasar. Juros é <b>ao mês</b> (proporcional aos dias de atraso).</p>
              <button onClick={() => onCobrar(forma, contaId || null, { multa_percent: parseFloat(multa) || 0, juros_percent: parseFloat(juros) || 0 })} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white transition-transform active:scale-[0.99]">
                Criar cobrança nova
              </button>
              <button onClick={abrirVincular} className="mt-2 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
                <Link2 className="h-3.5 w-3.5" /> Já existe no Asaas? Vincular
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setMode('criar')} className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground-muted hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Conta (recebimento)</p>
              {contaSelect}
              <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Assinaturas no Asaas</p>
              {loadingList ? (
                <div className="flex items-center gap-2 py-3 text-xs text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</div>
              ) : !assinaturas || assinaturas.length === 0 ? (
                <p className="py-2 text-xs text-foreground-muted">Nenhuma assinatura encontrada pra este cliente no Asaas.</p>
              ) : (
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {assinaturas.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.vinculada}
                      onClick={() => onVincular(s.id, contaId || null)}
                      className={cn('w-full rounded-lg border border-border/60 bg-surface/60 px-2.5 py-2 text-left transition-colors', s.vinculada ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-2')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(s.value))}</span>
                        <span className="text-[10px] text-foreground-muted">{s.vinculada ? 'já vinculada' : (s.nextDueDate || '')}</span>
                      </div>
                      <div className="truncate text-[11px] text-foreground-muted">{s.description || 'Sem descrição'}</div>
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
        <button className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80', toneCls[meta.tone])}>
          {meta.label}
          {grupoQtd > 1
            ? <span className="inline-flex items-center gap-0.5 opacity-80"><Layers className="h-3 w-3" />{grupoQtd}</span>
            : cobranca.tipo === 'recorrente' && <RefreshCw className="h-3 w-3 opacity-70" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-2xl">
        {grupoQtd > 1 && (
          <p className="mb-1 flex items-start gap-1.5 rounded-lg bg-primary/10 px-2.5 py-2 text-[11px] leading-snug text-foreground">
            <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Boleto único de {grupoQtd} contratos. As ações abaixo valem para todos.
          </p>
        )}
        {cobranca.invoice_url && (
          <a href={cobranca.invoice_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-white/5">
            <ExternalLink className="h-4 w-4 text-foreground-muted" /> Abrir link de pagamento
          </a>
        )}
        <button onClick={onWhatsapp} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
          <MessageCircle className="h-4 w-4 text-[hsl(var(--success))]" /> Enviar por WhatsApp
        </button>
        {cobranca.status !== 'pago' && (
          <button onClick={onReceberManual} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
            <HandCoins className="h-4 w-4 text-[hsl(var(--success))]" /> Identificar pagamento manual
          </button>
        )}
        <button onClick={onSincronizar} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
          <RefreshCw className="h-4 w-4 text-foreground-muted" /> Sincronizar status
        </button>
        <button onClick={onCancelar} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
          <XCircle className="h-4 w-4 text-foreground-muted" /> Cancelar cobrança
        </button>
        <button onClick={onExcluir} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[hsl(var(--danger))] transition-colors hover:bg-[hsl(var(--danger))]/10">
          <Trash2 className="h-4 w-4" /> Excluir cobrança
        </button>
      </PopoverContent>
    </Popover>
  );
}
