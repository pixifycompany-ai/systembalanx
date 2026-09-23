import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { AsaasAssinatura } from '@/hooks/useCobrancas';

export interface ContratoParaAgrupar {
  id: string;
  cliente_id: string;
  descricao: string;
  valor: number;
  recorrencia: string;
  dia_vencimento: number | null;
  status: string;
  cobrado: boolean; // já tem cobrança no Asaas
}

const FORMAS = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contratos: ContratoParaAgrupar[];
  nomeCliente: (id: string) => string;
  contas: { id: string; nome: string }[];
  listarAssinaturas: (clienteId: string) => Promise<AsaasAssinatura[]>;
  agrupar: (p: {
    contrato_ids: string[]; modo: 'criar' | 'vincular'; asaas_subscription_id?: string; forma_pagamento?: string;
    conta_id?: string | null; dia_vencimento?: number; multa_percent?: number; juros_percent?: number;
  }) => Promise<boolean>;
}

export function AgruparCobrancaSheet({ open, onOpenChange, contratos, nomeCliente, contas, listarAssinaturas, agrupar }: Props) {
  const [modo, setModo] = useState<'criar' | 'vincular'>('criar');
  const [forma, setForma] = useState('UNDEFINED');
  const [contaId, setContaId] = useState('');
  const [dia, setDia] = useState('');
  const [multa, setMulta] = useState('');
  const [juros, setJuros] = useState('');
  const [assinaturas, setAssinaturas] = useState<AsaasAssinatura[] | null>(null);
  const [subId, setSubId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const total = useMemo(() => Math.round(contratos.reduce((s, c) => s + (Number(c.valor) || 0), 0) * 100) / 100, [contratos]);
  const clienteId = contratos[0]?.cliente_id;

  // Mesmas regras que o servidor valida (a assinatura do Asaas é de um cliente e um ciclo só).
  const problemas = useMemo(() => {
    const p: string[] = [];
    if (contratos.length < 2) p.push('Selecione pelo menos 2 contratos.');
    if (new Set(contratos.map((c) => c.cliente_id)).size > 1) p.push('Os contratos precisam ser do mesmo cliente.');
    if (new Set(contratos.map((c) => c.recorrencia)).size > 1) p.push('Os contratos precisam ter a mesma recorrência.');
    if (contratos.some((c) => c.recorrencia === 'unico')) p.push('Contrato de pagamento único não entra em assinatura.');
    const inativos = contratos.filter((c) => c.status !== 'ativo');
    if (inativos.length) p.push(`Só contratos ativos: ${inativos.map((c) => c.descricao).join(', ')}.`);
    const cobrados = contratos.filter((c) => c.cobrado);
    if (cobrados.length) p.push(`Já têm cobrança no Asaas (cancele antes): ${cobrados.map((c) => c.descricao).join(', ')}.`);
    return p;
  }, [contratos]);

  useEffect(() => {
    if (!open) return;
    setModo('criar'); setForma('UNDEFINED'); setContaId(''); setMulta(''); setJuros('');
    setAssinaturas(null); setSubId('');
    setDia(String(Math.min(Math.max(Number(contratos[0]?.dia_vencimento) || 10, 1), 28)));
  }, [open, contratos]);

  const abrirVincular = async () => {
    setModo('vincular');
    if (assinaturas !== null || !clienteId) return;
    const lista = await listarAssinaturas(clienteId);
    setAssinaturas(lista);
  };

  const sub = assinaturas?.find((s) => s.id === subId);
  const diverge = !!sub && Math.abs(Number(sub.value) - total) >= 0.01;

  const podeEnviar = problemas.length === 0 && !salvando && (modo === 'criar' || !!subId);

  const handleAgrupar = async () => {
    setSalvando(true);
    const ok = await agrupar({
      contrato_ids: contratos.map((c) => c.id),
      modo,
      asaas_subscription_id: modo === 'vincular' ? subId : undefined,
      forma_pagamento: forma,
      conta_id: contaId || null,
      dia_vencimento: Number(dia) || undefined,
      multa_percent: parseFloat(multa) || 0,
      juros_percent: parseFloat(juros) || 0,
    });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  const contaSelect = (
    <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="mt-1 w-full rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-border-strong">
      <option value="">Sem conta (defino depois)</option>
      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.95] backdrop-blur-2xl sm:max-w-[560px] sm:mx-auto">
        <div className="mx-auto w-full max-w-[520px] pb-6 pt-1">
          <p className="text-xs font-medium text-foreground-muted">Cobrança</p>
          <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Cobrar juntos num boleto só</h2>
          {clienteId && <p className="mt-0.5 text-sm text-foreground-muted">{nomeCliente(clienteId)}</p>}

          {/* Contratos do grupo */}
          <div className="mt-4 rounded-xl border border-border/60 bg-surface/40">
            {contratos.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 last:border-0">
                <span className="min-w-0 truncate text-[13px] text-foreground">{c.descricao}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-foreground-muted">{formatCurrency(Number(c.valor))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-white/[0.03] px-3 py-2">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground"><Layers className="h-3.5 w-3.5 text-primary" /> Total por fatura</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-foreground-muted">No financeiro entra uma receita por contrato; ao pagar, todas são baixadas juntas.</p>

          {problemas.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger))]/10 px-3 py-2">
              {problemas.map((p) => (
                <p key={p} className="flex items-start gap-1.5 text-[12px] text-[hsl(var(--danger))]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p}</p>
              ))}
            </div>
          )}

          {/* Modo */}
          <div className="mt-4 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setModo('criar')} className={cn('rounded-lg border py-2 text-xs font-semibold transition-colors', modo === 'criar' ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}>Criar assinatura nova</button>
            <button type="button" onClick={abrirVincular} className={cn('rounded-lg border py-2 text-xs font-semibold transition-colors', modo === 'vincular' ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}>Vincular existente</button>
          </div>

          {modo === 'criar' ? (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {FORMAS.map((f) => (
                    <button key={f.value} type="button" onClick={() => setForma(f.value)} className={cn('rounded-lg border py-1.5 text-[11px] font-semibold transition-colors', forma === f.value ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Dia do vencimento</Label>
                  <Input type="number" min="1" max="28" value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Conta (recebimento)</Label>
                  {contaSelect}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Multa atraso (%)</Label>
                  <Input type="number" step="0.01" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Juros ao mês (%)</Label>
                  <Input type="number" step="0.01" min="0" value={juros} onChange={(e) => setJuros(e.target.value)} placeholder="0" className="mt-1" />
                </div>
              </div>
              <p className="text-[11px] text-foreground-muted">Os contratos passam a vencer todos nesse dia. Multa/juros só incidem se atrasar — juros é <b>ao mês</b>.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Conta (recebimento)</Label>
                {contaSelect}
              </div>
              <div>
                <Label className="text-xs">Assinaturas deste cliente no Asaas</Label>
                {assinaturas === null ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</div>
                ) : assinaturas.length === 0 ? (
                  <p className="py-2 text-xs text-foreground-muted">Nenhuma assinatura encontrada para este cliente no Asaas.</p>
                ) : (
                  <div className="mt-1 max-h-52 space-y-1 overflow-y-auto">
                    {assinaturas.map((s) => (
                      <button key={s.id} type="button" disabled={s.vinculada} onClick={() => setSubId(s.id)}
                        className={cn('w-full rounded-lg border px-3 py-2 text-left transition-colors',
                          subId === s.id ? 'border-primary bg-primary/10' : 'border-border/60 bg-surface/60 hover:bg-surface-2',
                          s.vinculada && 'cursor-not-allowed opacity-50')}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(s.value))}</span>
                          <span className="text-[10px] text-foreground-muted">{s.vinculada ? 'já vinculada' : s.nextDueDate || ''}</span>
                        </div>
                        <div className="truncate text-[11px] text-foreground-muted">{s.description || 'Sem descrição'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {diverge && (
                <p className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-3 py-2 text-[11.5px] text-[hsl(var(--warning))]">
                  A assinatura cobra {formatCurrency(Number(sub!.value))} e a soma dos contratos é {formatCurrency(total)}. Vale o valor do Asaas: os contratos serão ajustados proporcionalmente.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleAgrupar} disabled={!podeEnviar}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {modo === 'criar' ? `Criar cobrança de ${formatCurrency(total)}` : 'Vincular e agrupar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
