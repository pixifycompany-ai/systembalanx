// Regra de envio automático de UMA cobrança (avulsa/parcelada): Padrão / Desligado /
// Personalizado. Prioridade no disparo: cobrança > contrato > padrão (Meu Perfil).
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type ModoRegra = 'padrao' | 'off' | 'custom';
export interface RegraAuto { modo: ModoRegra; antes_dias: number; no_dia: boolean; atraso_diario: boolean }

export const REGRA_PADRAO: RegraAuto = { modo: 'padrao', antes_dias: 0, no_dia: true, atraso_diario: true };

/** Regra salva numa cobrança → valor do formulário. */
export function regraDaCobranca(c: { auto_modo?: string | null; auto_antes_dias?: number | null; auto_no_dia?: boolean | null; auto_atraso_diario?: boolean | null }): RegraAuto {
  const modo: ModoRegra = c.auto_modo === 'off' || c.auto_modo === 'custom' ? c.auto_modo : 'padrao';
  if (modo !== 'custom') return { ...REGRA_PADRAO, modo };
  return { modo, antes_dias: c.auto_antes_dias ?? 0, no_dia: !!c.auto_no_dia, atraso_diario: !!c.auto_atraso_diario };
}

const CANAL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'e-mail', ambos: 'WhatsApp e e-mail' };

interface Props {
  value: RegraAuto;
  onChange: (r: RegraAuto) => void;
  /** Nome do contrato vinculado: "Padrão" passa a seguir a regra dele. */
  contratoNome?: string | null;
  /** Canal do cadastro do cliente (por onde a cobrança sai). */
  canal?: string | null;
}

export function RegraAutoCobranca({ value, onChange, contratoNome, canal }: Props) {
  const set = (p: Partial<RegraAuto>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface p-1">
        {([['padrao', 'Padrão'], ['off', 'Desligado'], ['custom', 'Personalizado']] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => set({ modo: v })}
            className={cn('no-touch-min h-9 rounded-full text-[12.5px] font-semibold transition-colors', value.modo === v ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground')}>
            {l}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] leading-snug text-foreground-muted">
        {value.modo === 'padrao'
          ? contratoNome ? <>Segue a regra do contrato <b>{contratoNome}</b>.</> : 'Usa a regra padrão (Meu Perfil → Cobrança automática).'
          : value.modo === 'off' ? 'Nunca dispara automático para esta cobrança (dá para enviar à mão).'
          : 'Regra só desta cobrança — vale mais que a do contrato e a padrão.'}
      </p>
      {value.modo === 'custom' && (
        <div className="rounded-[20px] border border-border px-3.5">
          <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
            <Label className="text-[13px] font-normal">Enviar <b>X dias antes</b></Label>
            <Input type="number" min="0" step="1" value={value.antes_dias} onChange={(e) => set({ antes_dias: Math.max(0, parseInt(e.target.value) || 0) })} className="w-20 text-center" />
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border py-2.5">
            <Label className="text-[13px] font-normal">Enviar <b>no dia</b></Label>
            <Switch checked={value.no_dia} onCheckedChange={(v) => set({ no_dia: v })} />
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-2.5">
            <Label className="text-[13px] font-normal">Reenviar <b>todo dia em atraso</b></Label>
            <Switch checked={value.atraso_diario} onCheckedChange={(v) => set({ atraso_diario: v })} />
          </div>
        </div>
      )}
      {canal && (
        <p className="text-[11.5px] text-foreground-muted">
          Sai por <b>{CANAL[canal] || canal}</b> — muda no cadastro do cliente (Canal de cobrança).
          {value.modo === 'custom' && value.atraso_diario ? ' Para de cobrar depois do limite de dias em atraso de Meu Perfil → Cobrança automática.' : ''}
        </p>
      )}
    </div>
  );
}
