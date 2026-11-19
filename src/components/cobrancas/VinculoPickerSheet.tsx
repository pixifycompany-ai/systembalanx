import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { OpcaoVinculo } from '@/lib/vinculoCobranca';
import { InlineNotice, SECTION_LABEL_CLS } from './formParts';
import { ModalFooter, ModalHeader, ModalShell } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';

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
    <Sheet open={open} onOpenChange={(o) => !salvando && onOpenChange(o)}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[600px]')}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <ModalShell>
          <ModalHeader eyebrow="Vínculo" title={title} onClose={() => !salvando && onOpenChange(false)} />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
            <p className="text-[12.5px] leading-relaxed text-foreground-muted">{subtitle}</p>
            <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5">
              <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição ou cliente" className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-foreground-muted" />
            </label>

            {opcoes === null ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</div>
            ) : visiveis.length === 0 ? (
              <p className="py-8 text-center text-sm text-foreground-muted">Nenhum(a) {tipoItem} encontrado(a) perto dessa data.</p>
            ) : (
              <div className="space-y-1.5">
                <p className={SECTION_LABEL_CLS}>Mais prováveis primeiro</p>
                {visiveis.map((o) => {
                  const ativo = sel === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSel(o.id)}
                      aria-pressed={ativo}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors',
                        ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface hover:bg-surface-2',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{o.titulo}</span>
                        <span className={cn('block truncate text-[12px]', ativo ? 'text-background/70' : 'text-foreground-muted')}>
                          {[o.cliente || 'Sem cliente', `vence ${formatDate(o.data)}`, STATUS[o.status] || o.status].join(' · ')}
                        </span>
                        {o.ocupada && <span className="mt-1 inline-block rounded-full bg-warning-bg px-2 py-px text-[10.5px] font-semibold text-warning-fg">Já ligada a outro(a)</span>}
                      </span>
                      <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums">{formatCurrency(o.valor)}</span>
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
          </div>
          <ModalFooter left={escolhida ? <span className="hidden text-[12px] text-foreground-muted sm:block">Passa a usar o valor e o vencimento da cobrança e dá baixa sozinho quando ela for paga.</span> : undefined}>
            <button type="button" className={btn.outline} onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</button>
            <button type="button" className={btn.primary} onClick={confirmar} disabled={!escolhida || salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Vincular
            </button>
          </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}
