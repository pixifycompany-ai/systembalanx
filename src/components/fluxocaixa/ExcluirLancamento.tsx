// Confirmação de exclusão de UM lançamento do Fluxo de caixa.
// Se ele faz parte de uma série (recorrência ou "x/y" solto — mesma regra do
// "Estender série"), oferece: só este / este e os próximos / a série inteira.
// Nas opções de série NUNCA apaga o que já foi pago/recebido, nem receitas com
// cobrança ativa no Asaas (essas precisam ser canceladas em Cobranças antes).
// Parcelas de compra no cartão (fatura) e receitas de contrato não entram aqui.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { btn } from '@/components/reskin/estilos';
import { carregarSerie, podeEstender } from '@/lib/estenderRecorrencia';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';

type Modo = 'este' | 'proximos' | 'serie';
type ItemSerie = { id: string; valor: number; data_vencimento: string; status: string };

const efetivado = (s: string) => s === 'pago' || s === 'recebido';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: TransacaoUnificada | undefined;
  /** Exclui só o lançamento aberto (fluxo atual). */
  onExcluirEste: () => void;
  /** Exclui vários da mesma tabela (série). Deve atualizar a lista e as contas. */
  onExcluirVarios: (ids: string[], tabela: 'receitas' | 'despesas') => Promise<boolean>;
  isLoading?: boolean;
}

export function ExcluirLancamento({ open, onOpenChange, item, onExcluirEste, onExcluirVarios, isLoading }: Props) {
  const [serie, setSerie] = useState<ItemSerie[] | null>(null);
  const [comCobranca, setComCobranca] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [modo, setModo] = useState<Modo>('este');
  const [apagando, setApagando] = useState(false);

  const transf = item?.tabela_origem === 'transferencia';
  const candidato = !!item && !transf && podeEstender(item);

  useEffect(() => {
    if (!open || !item || !candidato) { setSerie(null); setModo('este'); return; }
    let vivo = true;
    setCarregando(true);
    setModo('este');
    (async () => {
      try {
        const linhas = (await carregarSerie(item)) as unknown as ItemSerie[];
        // Só é série se o próprio lançamento faz parte do conjunto e há outros.
        const ok = linhas.some((l) => l.id === item.id) && linhas.length > 1;
        let cob = new Set<string>();
        if (ok && item.tabela_origem === 'receitas') {
          const { data } = await supabase.from('cobrancas')
            .select('receita_id').in('receita_id', linhas.map((l) => l.id)).not('status', 'in', '(cancelado,estornado)');
          cob = new Set(((data || []) as { receita_id: string }[]).map((c) => c.receita_id));
        }
        if (vivo) { setSerie(ok ? linhas : null); setComCobranca(cob); }
      } catch {
        if (vivo) setSerie(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [open, item, candidato]);

  // O que cada opção apaga (e o que fica de fora e por quê).
  const plano = useMemo(() => {
    if (!item || !serie) return null;
    const alvo = (m: Modo) => (m === 'proximos' ? serie.filter((s) => s.data_vencimento >= item.data_vencimento) : serie);
    const calc = (m: Modo) => {
      const base = alvo(m);
      const apagar = base.filter((s) => !efetivado(s.status) && !comCobranca.has(s.id));
      return {
        apagar,
        total: apagar.reduce((t, s) => t + Number(s.valor), 0),
        pagos: base.filter((s) => efetivado(s.status)).length,
        cobranca: base.filter((s) => !efetivado(s.status) && comCobranca.has(s.id)).length,
      };
    };
    return { proximos: calc('proximos'), serie: calc('serie') };
  }, [item, serie, comCobranca]);

  const ent = item?.tipo === 'entrada';
  const verbo = ent ? 'recebid' : 'pag';
  const escolhido = modo === 'este' || !plano ? null : plano[modo];

  const confirmar = async () => {
    if (!item) return;
    if (modo === 'este' || !escolhido) { onExcluirEste(); return; }
    if (!escolhido.apagar.length) return;
    setApagando(true);
    const ok = await onExcluirVarios(escolhido.apagar.map((s) => s.id), item.tabela_origem as 'receitas' | 'despesas');
    setApagando(false);
    if (ok) onOpenChange(false);
  };

  const obs = (p: { pagos: number; cobranca: number }) => [
    p.pagos ? `${p.pagos} já ${verbo}${p.pagos > 1 ? 'os' : 'o'} fica${p.pagos > 1 ? 'm' : ''}` : '',
    p.cobranca ? `${p.cobranca} com cobrança no Asaas fica${p.cobranca > 1 ? 'm' : ''} (cancele em Cobranças)` : '',
  ].filter(Boolean).join(' · ');

  const ocupado = isLoading || apagando;
  const opcoes: { v: Modo; t: string; d?: string; vazio?: boolean }[] = plano ? [
    { v: 'este', t: 'Só este' },
    { v: 'proximos', t: 'Este e os próximos', d: `${plano.proximos.apagar.length} lançamento${plano.proximos.apagar.length === 1 ? '' : 's'} · ${formatCurrency(plano.proximos.total)}${obs(plano.proximos) ? ` · ${obs(plano.proximos)}` : ''}`, vazio: !plano.proximos.apagar.length },
    { v: 'serie', t: 'A série inteira', d: `${plano.serie.apagar.length} lançamento${plano.serie.apagar.length === 1 ? '' : 's'} · ${formatCurrency(plano.serie.total)}${obs(plano.serie) ? ` · ${obs(plano.serie)}` : ''}`, vazio: !plano.serie.apagar.length },
  ] : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className="rounded-t-[26px] bg-surface p-0 sm:max-w-[460px]">
        <div className="p-5 pb-safe">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-danger-bg text-danger-fg"><Trash2 className="h-5 w-5" /></span>
          <h2 className="mt-3 font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">
            {transf ? 'Excluir esta transferência?' : plano ? 'Excluir lançamento da série?' : 'Excluir este lançamento?'}
          </h2>
          <div className="mt-1 text-[13.5px] text-foreground-muted">
            {item
              ? <><b className="font-medium text-foreground">{item.descricao}</b> · {formatCurrency(item.valor)} · {formatDate(item.data_vencimento)}. Não dá para desfazer.</>
              : 'Esta ação não pode ser desfeita.'}
          </div>

          {carregando && <p className="mt-4 flex items-center gap-2 text-[12.5px] text-foreground-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Verificando a série…</p>}

          {plano && (
            <div className="mt-4 space-y-1.5" role="radiogroup" aria-label="O que excluir">
              {opcoes.map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={modo === o.v} disabled={o.vazio} onClick={() => setModo(o.v)}
                  className={cn('flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors disabled:opacity-45',
                    modo === o.v ? 'border-foreground bg-surface-2/60' : 'border-border hover:bg-surface-2/40')}>
                  <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border', modo === o.v ? 'border-foreground' : 'border-border-strong')}>
                    {modo === o.v && <span className="h-2 w-2 rounded-full bg-foreground" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] text-foreground">{o.t}</span>
                    {o.d && <span className="block text-[12px] text-foreground-muted">{o.vazio ? `Nada a excluir — ${obs(o.v === 'proximos' ? plano.proximos : plano.serie) || 'todos já efetivados'}` : o.d}</span>}
                  </span>
                </button>
              ))}
              <p className="px-1 pt-1 text-[11.5px] text-foreground-subtle">Lançamentos já {verbo}os nunca são apagados pelas opções de série.</p>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={cn(btn.outline, 'h-11 flex-1')}>Cancelar</button>
            <button type="button" onClick={confirmar} disabled={ocupado || carregando || (!!escolhido && !escolhido.apagar.length)}
              className="h-11 flex-1 rounded-full bg-danger text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-50">
              {ocupado ? 'Excluindo…' : escolhido ? `Excluir ${escolhido.apagar.length}` : 'Excluir'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
