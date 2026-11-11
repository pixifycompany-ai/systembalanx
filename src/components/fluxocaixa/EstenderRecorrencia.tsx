// "Estender recorrência" no detalhe do lançamento: série solta (sem contrato)
// ganha mais N lançamentos na mesma frequência, valor e dia.
import { useState } from 'react';
import { Loader2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { carregarSerie, estenderSerie, planejarExtensao, podeEstender, type LancamentoBase } from '@/lib/estenderRecorrencia';

const FREQ: Record<string, string> = {
  semanal: 'semanal', quinzenal: 'quinzenal', mensal: 'mensal', bimestral: 'bimestral',
  trimestral: 'trimestral', semestral: 'semestral', anual: 'anual',
};

export function EstenderRecorrencia({ lancamento, onChange }: { lancamento: LancamentoBase; onChange?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [serie, setSerie] = useState<Awaited<ReturnType<typeof carregarSerie>> | null>(null);
  const [qtd, setQtd] = useState(12);
  const [busy, setBusy] = useState(false);

  if (!podeEstender(lancamento)) return null;

  const abrir = async () => {
    setAberto(true);
    setBusy(true);
    try { setSerie(await carregarSerie(lancamento)); }
    catch (e) { toast.error('Não foi possível ler a série', { description: e instanceof Error ? e.message : String(e) }); setAberto(false); }
    finally { setBusy(false); }
  };

  const plano = serie?.length && qtd > 0 ? planejarExtensao(serie, qtd) : null;

  const confirmar = async () => {
    if (!serie?.length || !plano) return;
    setBusy(true);
    try {
      await estenderSerie(lancamento, serie, qtd);
      toast.success(`${qtd} lançamento(s) criado(s)`, { description: `Até ${formatDate(plano.novos.at(-1)!.data_vencimento)}.` });
      setAberto(false);
      setSerie(null);
      onChange?.();
    } catch (e) {
      toast.error('Não foi possível estender', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!aberto) {
    return (
      <button
        onClick={abrir}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-2"
      >
        <Repeat className="h-4 w-4" /> Estender recorrência
      </button>
    );
  }

  const ultimo = serie?.length ? [...serie].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).at(-1)! : null;

  return (
    <div className="space-y-3 rounded-[18px] border border-border p-3.5">
      <p className="text-[13.5px] font-semibold text-foreground">Estender recorrência</p>
      {busy && !serie ? (
        <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Lendo a série…</div>
      ) : ultimo && plano ? (
        <>
          <p className="text-[12.5px] text-foreground-muted">
            Série {FREQ[plano.freq]} com {serie!.length} lançamento(s); o último vence em {formatDate(ultimo.data_vencimento)}
            {' '}({formatCurrency(Number(ultimo.valor))}).
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[3, 6, 12, 24].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQtd(n)}
                className={cn('rounded-full border px-3 py-1.5 text-[12.5px] font-medium', qtd === n ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground-muted')}
              >
                +{n}
              </button>
            ))}
            <Input
              type="number"
              min={1}
              max={60}
              value={qtd}
              onChange={(e) => setQtd(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
              className="h-8 w-20 rounded-full text-[12.5px]"
              aria-label="Quantos lançamentos a mais"
            />
          </div>
          {plano.novos.length > 0 && (
            <p className="text-[12.5px] text-foreground">
              Cria de {formatDate(plano.novos[0].data_vencimento)} a {formatDate(plano.novos.at(-1)!.data_vencimento)}
              {plano.renomear.length ? `, e a numeração da série passa para "/${plano.totalNovo}"` : ''}.
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmar} disabled={busy || qtd < 1}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Criar {qtd}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)} disabled={busy}>Cancelar</Button>
          </div>
        </>
      ) : (
        <p className="text-[12.5px] text-foreground-muted">Não achei os outros lançamentos desta série.</p>
      )}
    </div>
  );
}
