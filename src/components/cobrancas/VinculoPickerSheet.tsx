import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { OpcaoVinculo } from '@/lib/vinculoCobranca';
import { InlineNotice, SheetFooter, SheetHeading, SECTION_LABEL_CLS } from './formParts';

const STATUS: Record<string, string> = {
  pendente: 'Aguardando', pago: 'Pago', vencido: 'Vencido', recebido: 'Recebido', atrasado: 'Atrasado',
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle: string;
  /** "cobrança" ou "lançamento": usado nos textos. */
  tipoItem: string;
  carregar: () => Promise<OpcaoVinculo[]>;
  onEscolher: (op: OpcaoVinculo) => Promise<boolean>;
}

/** Escolhe a cobrança de um lançamento (ou o lançamento de uma cobrança). */
export function VinculoPickerSheet({ open, onOpenChange, title, subtitle, tipoItem, carregar, onEscolher }: Props) {
  const [opcoes, setOpcoes] = useState<OpcaoVinculo[] | null>(null);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOpcoes(null); setBusca(''); setSel(null);
    carregar().then(setOpcoes).catch(() => setOpcoes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = opcoes || [];
    if (!q) return lista.slice(0, 40);
    return lista.filter((o) => `${o.titulo} ${o.cliente || ''}`.toLowerCase().includes(q)).slice(0, 40);
  }, [opcoes, busca]);
  const escolhida = (opcoes || []).find((o) => o.id === sel) || null;

  const confirmar = async () => {
    if (!escolhida) return;
    setSalvando(true);
    const ok = await onEscolher(escolhida);
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[600px] sm:mx-auto">
        <div className="mx-auto w-full max-w-[560px] space-y-4 pb-6 pt-1">
          <SheetHeading eyebrow="Vínculo" title={title} subtitle={subtitle} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição ou cliente" className="pl-9" />
          </div>

          {opcoes === null ? (
            <div className="flex items-center gap-2 py-8 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</div>
          ) : visiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground-muted">Nenhum(a) {tipoItem} encontrado(a) perto dessa data.</p>
          ) : (
            <div className="space-y-2">
              <p className={SECTION_LABEL_CLS}>Mais prováveis primeiro</p>
              {visiveis.map((o) => {
                const ativo = sel === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSel(o.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors',
                      ativo ? 'border-foreground bg-surface-2' : 'border-border bg-surface hover:border-border-strong',
                    )}
                  >
                    <span className={cn('mt-1 h-4 w-4 shrink-0 rounded-full border', ativo ? 'border-foreground bg-foreground shadow-[inset_0_0_0_3px_hsl(var(--surface-2))]' : 'border-border-strong')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-foreground">{o.titulo}</span>
                      <span className="block truncate text-[12px] text-foreground-muted">
                        {[o.cliente || 'Sem cliente', `vence ${formatDate(o.data)}`, STATUS[o.status] || o.status].join(' · ')}
                      </span>
                      {o.ocupada && <span className="mt-1 inline-block rounded-full bg-warning-bg px-2 py-px text-[10.5px] font-semibold text-warning-fg">Já ligada a outro(a)</span>}
                    </span>
                    <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(o.valor)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {escolhida?.ocupada && (
            <InlineNotice tone="warning">
              Este(a) {tipoItem} já está ligado(a) a outro item. Ao confirmar, o vínculo passa para cá e o outro fica sem vínculo (aparece na conciliação de Cobranças).
            </InlineNotice>
          )}
          {escolhida && (
            <p className="text-[12px] text-foreground-muted">O lançamento passa a usar o valor e o vencimento da cobrança e dá baixa sozinho quando ela for paga.</p>
          )}

          <SheetFooter>
            <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="lg" onClick={confirmar} disabled={!escolhida || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Vincular
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
