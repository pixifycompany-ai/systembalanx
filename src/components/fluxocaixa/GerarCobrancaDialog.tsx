// Gera cobrança(s) no Asaas a partir de lançamento(s) de receita já existentes.
// Se o lançamento é parcelado (recurrence_group_id), lista as demais parcelas em
// aberto e já deixa marcadas a atual e as próximas.
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Receipt } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';

const FORMAS = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

interface Parcela {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  temCobranca: boolean;
}

interface Props {
  transacao: TransacaoUnificada | null;
  contas: { id: string; nome: string; tipo?: string; ativa?: boolean }[];
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const hojeISO = () => format(new Date(), 'yyyy-MM-dd');

export function GerarCobrancaDialog({ transacao: t, contas, onOpenChange, onDone }: Props) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [forma, setForma] = useState('UNDEFINED');
  const [contaId, setContaId] = useState<string>('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const contasRecebimento = useMemo(
    () => contas.filter((c) => c.tipo !== 'cartao_credito' && c.ativa !== false),
    [contas],
  );

  // Carrega o lançamento (e as parcelas irmãs, se for parcelado) + quais já têm cobrança.
  useEffect(() => {
    if (!t) return;
    let cancel = false;
    (async () => {
      setCarregando(true);
      setForma('UNDEFINED');
      setContaId(t.conta_id || '');
      let q = supabase
        .from('receitas')
        .select('id, descricao, valor, data_vencimento, status')
        .in('status', ['pendente', 'atrasado'])
        .order('data_vencimento', { ascending: true });
      q = t.recurrence_group_id ? q.eq('recurrence_group_id', t.recurrence_group_id) : q.eq('id', t.id);
      const { data: recs } = await q;
      const lista = (recs || []) as Omit<Parcela, 'temCobranca'>[];
      const ids = lista.map((r) => r.id);
      // `cobrancas` não está nos tipos gerados do Supabase (mesmo padrão do resto do app).
      const { data: cobs } = ids.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await (supabase as any).from('cobrancas').select('receita_id, status').in('receita_id', ids)
        : { data: [] };
      const comCobranca = new Set(
        ((cobs || []) as { receita_id: string; status: string }[])
          .filter((c) => !['cancelado', 'estornado'].includes(c.status))
          .map((c) => c.receita_id),
      );
      const todas: Parcela[] = lista.map((r) => ({ ...r, valor: Number(r.valor), temCobranca: comCobranca.has(r.id) }));
      // Pré-seleção: a parcela clicada + as próximas, sem cobrança ainda.
      const pre = new Set(
        todas.filter((p) => !p.temCobranca && (p.id === t.id || p.data_vencimento >= t.data_vencimento)).map((p) => p.id),
      );
      if (!cancel) {
        setParcelas(todas);
        setSelecionadas(pre);
        setCarregando(false);
      }
    })();
    return () => { cancel = true; };
  }, [t]);

  if (!t) return null;

  const semCliente = !t.cliente_id;
  const elegiveis = parcelas.filter((p) => !p.temCobranca);
  const escolhidas = parcelas.filter((p) => selecionadas.has(p.id));
  const total = escolhidas.reduce((s, p) => s + p.valor, 0);
  const hoje = hojeISO();
  const ajustadas = escolhidas.filter((p) => p.data_vencimento < hoje).length;
  const parcelado = parcelas.length > 1;

  const toggle = (id: string) =>
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const gerar = async () => {
    if (!escolhidas.length) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-cobranca', {
        body: {
          action: 'criar-de-receitas',
          receita_ids: escolhidas.map((p) => p.id),
          forma_pagamento: forma,
          conta_id: contaId || null,
        },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          const b = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
          if (b?.error) msg = b.error;
        } catch { /* mantém msg */ }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const n = (data as { criadas?: number })?.criadas ?? escolhidas.length;
      toast.success(n > 1 ? `${n} cobranças criadas no Asaas!` : 'Cobrança criada no Asaas!', {
        description: 'Já aparecem em Cobranças, prontas para enviar.',
      });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar cobrança');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={!!t} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15"><Receipt className="h-4 w-4 text-primary" /></span>
            Gerar cobrança no Asaas
          </DialogTitle>
          <DialogDescription>
            {t.cliente?.nome ? <>Para <strong className="text-foreground">{t.cliente.nome}</strong> · a partir deste lançamento</> : 'A partir deste lançamento'}
          </DialogDescription>
        </DialogHeader>

        {semCliente ? (
          <p className="rounded-xl border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 p-3 text-sm text-foreground">
            Este lançamento não tem cliente. Edite o lançamento e vincule um cliente para gerar a cobrança.
          </p>
        ) : carregando ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando lançamentos…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {parcelado ? 'Parcelas em aberto' : 'Lançamento'}
                </Label>
                {parcelado && elegiveis.length > 1 && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setSelecionadas(selecionadas.size === elegiveis.length ? new Set() : new Set(elegiveis.map((p) => p.id)))
                    }
                  >
                    {selecionadas.size === elegiveis.length ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                )}
              </div>
              <div className="max-h-[260px] divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/60">
                {parcelas.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5',
                      p.temCobranca ? 'opacity-60' : 'cursor-pointer hover:bg-muted/40',
                    )}
                  >
                    <Checkbox
                      checked={selecionadas.has(p.id)}
                      disabled={p.temCobranca}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Selecionar ${p.descricao}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{p.descricao}</span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        vence {format(parseISO(p.data_vencimento), 'dd/MM/yyyy')}
                        {p.temCobranca ? ' · já tem cobrança' : p.data_vencimento < hoje ? ' · vencido (vai para hoje)' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(p.valor)}</span>
                  </label>
                ))}
                {parcelas.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum lançamento em aberto para cobrar.</p>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forma de pagamento</Label>
              <div className="flex flex-wrap gap-1.5">
                {FORMAS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setForma(f.value)}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                      forma === f.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta de recebimento</Label>
              <Select value={contaId || '_mesma'} onValueChange={(v) => setContaId(v === '_mesma' ? '' : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_mesma">Manter a do lançamento</SelectItem>
                  {contasRecebimento.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ajustadas > 0 && (
              <p className="text-[12px] text-muted-foreground">
                {ajustadas === 1 ? '1 lançamento vencido terá' : `${ajustadas} lançamentos vencidos terão`} vencimento hoje — o Asaas não aceita data retroativa.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Link to="/cobrancas" className="text-xs text-muted-foreground hover:text-foreground">Ver cobranças</Link>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={gerar} disabled={semCliente || carregando || enviando || escolhidas.length === 0}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {escolhidas.length > 1
                ? `Gerar ${escolhidas.length} cobranças · ${formatCurrency(total)}`
                : `Gerar cobrança${escolhidas.length ? ` · ${formatCurrency(total)}` : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
