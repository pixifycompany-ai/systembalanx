// Quadro da conferência da fatura (PDF do banco × BALANX) e lista de lançamentos com "Editar".
// Os números vêm direto da ferramenta — a IARA só comenta, não reescreve.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, CreditCard, Layers, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { corrigirValorNaFatura, excluirDaFatura } from '@/lib/conferenciaFatura';
import type { ConferenciaFatura, GrupoConf, LancamentoLista, LinhaConf } from '@/hooks/useFinancialAdvisor';
import { LancamentoSheet, type AlvoSheet } from '@/components/iara/LancamentoSheet';

const dm = (d: string | null | undefined) => (d ? formatDate(d).slice(0, 5) : '—');
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : 'não deu certo');

function Cabeca({ titulo, n, total, cor, aberto, onClick }: { titulo: string; n: number; total: number; cor: string; aberto: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{titulo} <span className="font-normal text-foreground-muted">· {n}</span></span>
      <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', cor)}>{formatCurrency(total)}</span>
      <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground-muted transition-transform', aberto && 'rotate-180')} />
    </button>
  );
}

/** Itens do BALANX que não estão no arquivo: marca/desmarca e exclui (com confirmação). */
function BlocoSobram({ c }: { c: ConferenciaFatura }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(true);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(c.sobram.filter((s) => s.sugerir_excluir && s.id).map((s) => s.id!)));
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [rodando, setRodando] = useState(false);
  if (!c.sobram.length) return null;
  const sel = c.sobram.filter((s) => s.id && marcados.has(s.id) && !feitos.has(s.id));
  const somaSel = sel.reduce((t, s) => t + s.valor, 0);
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const excluir = async () => {
    setRodando(true);
    try {
      const ids = sel.map((s) => s.id!);
      const n = await excluirDaFatura(ids, c.fatura_id);
      setFeitos((f) => new Set([...f, ...ids]));
      toast.success(`${n} lançamento${n === 1 ? '' : 's'} excluído${n === 1 ? '' : 's'} da fatura.`);
      void qc.invalidateQueries();
    } catch (e) { toast.error(`Não consegui excluir: ${erroMsg(e)}`); }
    setRodando(false); setConfirmar(false);
  };
  return (
    <div className="border-t border-border">
      <Cabeca titulo="No BALANX e não no arquivo" n={c.sobram.length} total={c.soma_sobram} cor="text-info-fg" aberto={aberto} onClick={() => setAberto(!aberto)} />
      {aberto && (
        <div className="px-3 pb-3">
          <ul className="space-y-1">
            {c.sobram.map((l, i) => {
              const feito = !!l.id && feitos.has(l.id);
              const marcado = !!l.id && marcados.has(l.id);
              return (
                <li key={l.id || i}>
                  <label className={cn('flex items-start gap-2 text-[12px]', feito && 'opacity-50', l.id && !feito && 'cursor-pointer')}>
                    {l.id && !feito
                      ? <input type="checkbox" checked={marcado} onChange={() => alternar(l.id!)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[hsl(var(--danger))]" />
                      : <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center">{feito && <Check className="h-3 w-3 text-success-fg" />}</span>}
                    <span className="w-[38px] shrink-0 tabular-nums text-foreground-muted">{dm(l.data)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-foreground', feito && 'line-through')}>{l.descricao}</span>
                      <span className="block text-[10.5px] text-foreground-muted">
                        {feito ? 'excluído'
                          : l.possivel_duplicado ? <span className="text-warning-fg">duplicado — já tem um igual que bate com o arquivo</span>
                          : l.parcela ? `parcela ${l.parcela} — o banco costuma lançar quando a fatura fecha`
                          : l.proxima_fatura ? 'depois da última compra do arquivo — pode ser da próxima fatura'
                          : 'não aparece no arquivo do banco'}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(l.valor)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {sel.length > 0 && (confirmar ? (
            <div className="mt-2.5 rounded-[14px] bg-danger-bg px-3 py-2.5">
              <p className="text-[12px] leading-snug text-danger-fg">Excluir {sel.length} lançamento{sel.length === 1 ? '' : 's'} ({formatCurrency(somaSel)}) do BALANX? Não dá para desfazer.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={rodando} onClick={excluir} className="h-8 rounded-full bg-danger px-3.5 text-[12px] font-semibold text-white disabled:opacity-60">{rodando ? 'Excluindo…' : 'Sim, excluir'}</button>
                <button type="button" disabled={rodando} onClick={() => setConfirmar(false)} className="h-8 rounded-full border border-border bg-surface px-3.5 text-[12px] text-foreground">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmar(true)} className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 text-[12px] font-semibold text-danger-fg hover:bg-danger-bg">
              <Trash2 className="h-3.5 w-3.5" />Excluir {sel.length} marcado{sel.length === 1 ? '' : 's'} · {formatCurrency(somaSel)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mesma compra com valor diferente: corrige o BALANX para o valor do banco. */
function BlocoDiferentes({ c }: { c: ConferenciaFatura }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(true);
  const [feitos, setFeitos] = useState<Set<number>>(new Set());
  const [rodando, setRodando] = useState<number | null>(null);
  if (!c.valores_diferentes.length) return null;
  const corrigir = async (i: number) => {
    const v = c.valores_diferentes[i];
    if (!v.no_balanx.id) return;
    setRodando(i);
    try {
      await corrigirValorNaFatura(v.no_balanx.id, v.no_pdf.valor, c.fatura_id);
      setFeitos((f) => new Set([...f, i]));
      toast.success(`${v.no_pdf.descricao}: valor corrigido para ${formatCurrency(v.no_pdf.valor)}.`);
      void qc.invalidateQueries();
    } catch (e) { toast.error(`Não consegui corrigir: ${erroMsg(e)}`); }
    setRodando(null);
  };
  return (
    <div className="border-t border-border">
      <Cabeca titulo="Valores diferentes" n={c.valores_diferentes.length} total={c.soma_dif} cor="text-warning-fg" aberto={aberto} onClick={() => setAberto(!aberto)} />
      {aberto && (
        <ul className="space-y-1.5 px-3 pb-3">
          {c.valores_diferentes.map((v, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-[38px] shrink-0 tabular-nums text-foreground-muted">{dm(v.no_pdf.data)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{v.no_pdf.descricao}</span>
                <span className="block text-[10.5px] tabular-nums text-foreground-muted">banco {formatCurrency(v.no_pdf.valor)} · BALANX {formatCurrency(v.no_balanx.valor)}</span>
              </span>
              {feitos.has(i)
                ? <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-success-fg"><Check className="h-3.5 w-3.5" />corrigido</span>
                : v.no_balanx.id && (
                  <button type="button" disabled={rodando !== null} onClick={() => corrigir(i)}
                    className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[11.5px] font-semibold text-background hover:opacity-90 disabled:opacity-60">
                    {rodando === i ? '…' : 'Corrigir'}
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Batem por soma: um item do BALANX = várias linhas do arquivo (ou o contrário). */
function BlocoSomados({ grupos }: { grupos: GrupoConf[] }) {
  const [aberto, setAberto] = useState(false);
  if (!grupos.length) return null;
  const total = grupos.reduce((t, g) => t + g.valor, 0);
  return (
    <div className="border-t border-border">
      <Cabeca titulo="Batem pela soma" n={grupos.length} total={total} cor="text-success-fg" aberto={aberto} onClick={() => setAberto(!aberto)} />
      {aberto && (
        <ul className="space-y-2 px-3 pb-3">
          {grupos.map((g, i) => {
            const um = g.tipo === 'somado_no_balanx' ? g.balanx[0] : g.arquivo[0];
            const varios = g.tipo === 'somado_no_balanx' ? g.arquivo : g.balanx;
            return (
              <li key={i} className="text-[12px]">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 shrink-0 text-success-fg" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{g.tipo === 'somado_no_balanx' ? 'No BALANX' : 'No banco'}: {um.descricao}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatCurrency(g.valor)}</span>
                </div>
                <p className="ml-[22px] mt-0.5 text-[10.5px] leading-snug text-foreground-muted">
                  = {varios.length} {g.tipo === 'somado_no_balanx' ? 'linhas no arquivo' : 'lançamentos no BALANX'}: {varios.map((x) => `${dm(x.data)} ${formatCurrency(x.valor)}`).join(' + ')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Bloco({ titulo, total, tom, linhas, aberto: inicial = false, extra }: {
  titulo: string; total: number; tom: 'danger' | 'warn' | 'info'; linhas: LinhaConf[]; aberto?: boolean; extra?: (l: LinhaConf) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(inicial);
  if (!linhas.length) return null;
  const cor = tom === 'danger' ? 'text-danger-fg' : tom === 'warn' ? 'text-warning-fg' : 'text-info-fg';
  return (
    <div className="border-t border-border">
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{titulo} <span className="font-normal text-foreground-muted">· {linhas.length}</span></span>
        <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', cor)}>{formatCurrency(total)}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground-muted transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <ul className="space-y-1 px-3 pb-3">
          {linhas.map((l, i) => (
            <li key={i} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[42px] shrink-0 tabular-nums text-foreground-muted">{l.data ? formatDate(l.data).slice(0, 5) : '—'}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{l.descricao}{l.parcela ? ` (${l.parcela})` : ''}{extra?.(l)}</span>
              <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(l.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuadroConferencia({ c }: { c: ConferenciaFatura }) {
  const bate = Math.abs(c.diferenca) < 0.01;
  const sentido = bate ? 'Bate certinho' : c.diferenca < 0 ? `BALANX tem ${formatCurrency(-c.diferenca)} a mais` : `Faltam ${formatCurrency(c.diferenca)} no BALANX`;
  return (
    <div className="mt-2.5 overflow-hidden rounded-[20px] border border-border bg-surface">
      <div className="flex items-center gap-2 px-3 pt-3">
        <CreditCard className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">Conferência · {c.cartao}</span>
        <span className="shrink-0 text-[11.5px] text-foreground-muted">vence {formatDate(c.vencimento)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 py-3">
        <div className="rounded-[14px] bg-surface-2 px-2.5 py-2">
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">Banco (arquivo)</p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(c.total_pdf)}</p>
        </div>
        <div className="rounded-[14px] bg-surface-2 px-2.5 py-2">
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">BALANX</p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(c.total_balanx)}</p>
        </div>
        <div className={cn('rounded-[14px] px-2.5 py-2', bate ? 'bg-success-bg' : 'bg-warning-bg')}>
          <p className={cn('text-[10.5px] uppercase tracking-[0.06em]', bate ? 'text-success-fg' : 'text-warning-fg')}>Diferença</p>
          <p className={cn('mt-0.5 text-[12.5px] font-semibold leading-tight', bate ? 'text-success-fg' : 'text-warning-fg')}>{sentido}</p>
        </div>
      </div>
      <p className="px-3 pb-2.5 text-[11.5px] text-foreground-muted">
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-success-fg" />{c.conferidos + (c.agrupados?.length || 0)} batem{c.agrupados?.length ? ` (${c.agrupados.length} pela soma)` : ''} · no BALANX é a "Fatura de {c.fatura_balanx}"
        {c.total_pdf_impresso != null && Math.abs(c.total_pdf_impresso - c.total_pdf) > 0.01 ? ` · total impresso ${formatCurrency(c.total_pdf_impresso)}` : ''}
      </p>
      <Bloco titulo="Faltam lançar no BALANX" total={c.soma_faltam} tom="danger" linhas={c.faltam} aberto />
      <BlocoDiferentes c={c} />
      <BlocoSobram c={c} />
      <BlocoSomados grupos={c.agrupados || []} />
      {!bate && (
        <p className="border-t border-border px-3 py-2.5 text-[11.5px] leading-snug text-foreground-muted">
          {formatCurrency(c.soma_faltam)} que faltam {c.soma_dif ? `${c.soma_dif > 0 ? '+' : '−'} ${formatCurrency(Math.abs(c.soma_dif))} de diferença ` : ''}− {formatCurrency(c.soma_sobram)} a mais no BALANX = <b className="font-semibold text-foreground">{formatCurrency(c.diferenca)}</b>
          {c.sobram.some((s) => s.parcela) ? '. Parcelas que estão no BALANX e não no arquivo costumam entrar quando a fatura fecha: confira no app do banco.' : ''}
        </p>
      )}
      {c.aviso_leitura && (
        <p className="flex gap-2 border-t border-border bg-warning-bg/60 px-3 py-2.5 text-[11.5px] leading-snug text-warning-fg">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.aviso_leitura}
        </p>
      )}
      {c.aviso_fechamento && (
        <p className="flex gap-2 border-t border-border bg-warning-bg/60 px-3 py-2.5 text-[11.5px] leading-snug text-warning-fg">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.aviso_fechamento}
        </p>
      )}
    </div>
  );
}

/** Lançamentos que a IARA listou: cada um abre a janela de edição ali mesmo, sem sair da conversa. */
export function ListaLancamentosIara({ itens }: { itens: LancamentoLista[] }) {
  const [aberto, setAberto] = useState(itens.length <= 5);
  const [alvo, setAlvo] = useState<AlvoSheet | null>(null);
  return (
    <div className="mt-2.5 overflow-hidden rounded-[18px] border border-border bg-surface">
      <LancamentoSheet alvo={alvo} onClose={() => setAlvo(null)} />
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Pencil className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        <span className="min-w-0 flex-1 text-[12.5px] text-foreground-muted">{itens.length} lançamento{itens.length === 1 ? '' : 's'} · toque para abrir e editar</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground-muted transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <ul className="border-t border-border">
          {itens.map((l) => (
            <li key={l.id} className="flex items-center gap-2 border-t border-border px-3 py-2 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-foreground">{l.quem || l.descricao}</span>
                <span className="block truncate text-[11px] text-foreground-muted">{[l.quem ? l.descricao : '', l.data ? formatDate(l.data) : '', l.cartao ? 'no cartão' : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={cn('shrink-0 text-[12.5px] font-semibold tabular-nums', l.tipo === 'receita' ? 'text-success-fg' : 'text-foreground')}>{formatCurrency(l.valor)}</span>
              <button type="button" onClick={() => setAlvo({ modo: 'existente', id: l.id, tipo: l.tipo })} className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[11.5px] font-semibold text-background hover:opacity-90">Editar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
