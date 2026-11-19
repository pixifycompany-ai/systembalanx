import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, PageHeader } from '@/components/reskin/kit';
import { btn } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { usePendencias, type BlocoPendencia, type Pendencia } from '@/hooks/usePendencias';

const BLOCOS: { id: BlocoPendencia; titulo: string; descricao: string; icone: typeof AlertTriangle; tom: string }[] = [
  { id: 'risco', titulo: 'Dinheiro em risco', descricao: 'Cobranças e pagamentos que precisam de ação agora.', icone: AlertTriangle, tom: 'bg-danger-bg text-danger-fg' },
  { id: 'ajuste', titulo: 'Ajustes de cadastro', descricao: 'Dados que deixam saldo, previsões ou relatórios errados.', icone: Wrench, tom: 'bg-warning-bg text-warning-fg' },
  { id: 'documento', titulo: 'Documentos', descricao: 'Notas fiscais e boletos que faltam.', icone: FileText, tom: 'bg-info-bg text-info-fg' },
];

function Item({ p, onIgnorar, onRestaurar }: { p: Pendencia; onIgnorar?: () => Promise<void>; onRestaurar?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const rodar = async (fn?: () => Promise<void>) => {
    if (!fn) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar'); } finally { setBusy(false); }
  };
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] font-semibold text-foreground">{p.titulo}</p>
          {p.valor !== undefined && (
            <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-foreground sm:hidden">{formatCurrency(p.valor)}</span>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] text-foreground [overflow-wrap:anywhere]">{p.detalhe}</p>
        <p className="mt-0.5 text-[12px] text-foreground-muted">{p.porque}</p>
      </div>
      {p.valor !== undefined && (
        <span className="hidden w-28 shrink-0 text-right font-heading text-[14px] font-semibold tabular-nums text-foreground sm:block">{formatCurrency(p.valor)}</span>
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        {onRestaurar ? (
          <button type="button" className={cn(btn.outline, 'h-9 px-3.5 text-[13px]')} disabled={busy} onClick={() => rodar(onRestaurar)}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Voltar a mostrar
          </button>
        ) : (
          <>
            {p.acao && (
              <Link to={p.acao.href} className={cn(btn.primary, 'h-9 px-4 text-[13px]')}>{p.acao.label}</Link>
            )}
            {p.ignoravel && onIgnorar && (
              <button type="button" className={cn(btn.ghost, 'h-9 text-[13px]')} disabled={busy} onClick={() => rodar(onIgnorar)}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Não é problema
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export default function Pendencias() {
  const { pendencias, ignoradas, total, isLoading, refetch, ignorar, restaurar } = usePendencias();
  const [verIgnoradas, setVerIgnoradas] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5">
      <PageHeader eyebrow="Principal" title="Pendências">
        <button type="button" className={btn.icon} aria-label="Atualizar" title="Atualizar" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Procurando pendências…</div>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6 text-success-fg" />}
            title="Tudo em dia"
            description="Nenhuma cobrança vencida, ajuste de cadastro ou documento faltando."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            {BLOCOS.map((b) => {
              const n = pendencias.filter((p) => p.bloco === b.id).length;
              return (
                <a key={b.id} href={`#${b.id}`} className="rounded-[24px] border border-border bg-surface p-4 transition-colors hover:border-border-strong md:p-5">
                  <span className="flex items-center justify-between gap-2 text-[13px] text-foreground-muted"><span className="leading-tight">{b.titulo}</span><span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', b.tom)}><b.icone className="h-4 w-4" /></span></span>
                  <div className="mt-1 font-heading text-[26px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{n}</div>
                </a>
              );
            })}
          </div>

          {BLOCOS.map((b) => {
            const lista = pendencias.filter((p) => p.bloco === b.id);
            if (!lista.length) return null;
            return (
              <div key={b.id} id={b.id} className="scroll-mt-20">
                <Card title={`${b.titulo} · ${lista.length}`} sub={b.descricao}>
                  <ul>
                    {lista.map((p) => <Item key={p.chave} p={p} onIgnorar={() => ignorar(p.chave)} />)}
                  </ul>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {ignoradas.length > 0 && (
        <div>
          <button onClick={() => setVerIgnoradas((v) => !v)} className="text-[13px] font-medium text-foreground-muted hover:text-foreground">
            {verIgnoradas ? 'Esconder' : 'Ver'} {ignoradas.length} {ignoradas.length === 1 ? 'item marcado' : 'itens marcados'} como "não é problema"
          </button>
          {verIgnoradas && (
            <Card className="mt-3">
              <ul>
                {ignoradas.map((p) => <Item key={p.chave} p={p} onRestaurar={() => restaurar(p.chave)} />)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
