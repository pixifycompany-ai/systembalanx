// Bloco "Pausa" no editar contrato: pausar a partir de uma data (com ou sem data
// para voltar), mudar a pausa ou reativar agora.
import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { btn } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';
import { descreverPausa, estadoPausa, pausarContrato, reativarContrato, type ContratoPausavel } from '@/lib/pausaContrato';

export function PausaContrato({ contrato, onChange }: { contrato: ContratoPausavel; onChange: () => void | Promise<void> }) {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const estado = estadoPausa(contrato, hoje);
  const [editando, setEditando] = useState(false);
  const [desde, setDesde] = useState(contrato.pausado_desde || hoje);
  const [ate, setAte] = useState(contrato.pausado_ate || '');
  const [busy, setBusy] = useState(false);
  const comAsaas = !!contrato.asaas_subscription_id;

  const salvar = async () => {
    setBusy(true);
    try {
      const r = await pausarContrato(contrato, desde, ate || null);
      toast.success(desde <= hoje ? 'Contrato pausado' : 'Pausa marcada', {
        description: [
          'As receitas em aberto do período saíram do fluxo de caixa.',
          comAsaas ? (desde <= hoje ? 'A assinatura foi suspensa no Asaas.' : 'A assinatura do Asaas é suspensa no dia do início.') : '',
          r?.canceladas ? `${r.canceladas} cobrança(s) aguardando cancelada(s).` : '',
        ].filter(Boolean).join(' '),
      });
      setEditando(false);
      await onChange();
    } catch (e) {
      toast.error('Não foi possível pausar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const reativar = async () => {
    setBusy(true);
    try {
      await reativarContrato(contrato);
      toast.success(estado === 'agendada' ? 'Pausa cancelada' : 'Contrato reativado', {
        description: comAsaas ? 'A assinatura voltou a cobrar no Asaas e as receitas foram lançadas de novo.' : 'As receitas dos próximos 12 meses foram lançadas de novo.',
      });
      await onChange();
    } catch (e) {
      toast.error('Não foi possível reativar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface-2/60 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-foreground-muted"><Pause className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="block text-[14px] text-foreground">Pausa</span>
          <span className="block text-[12px] text-foreground-muted">{estado && !editando ? `${descreverPausa(contrato, hoje)}.` : 'Para de gerar receitas por um tempo, sem encerrar o contrato.'}</span>
        </span>
      </div>

      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <DatePickerField label="Pausar a partir de" value={desde} onChange={setDesde} />
            <DatePickerField label="Voltar a cobrar em" value={ate} onChange={setAte} />
          </div>
          <p className="text-[12px] text-foreground-muted">
            Deixe "voltar a cobrar" vazio para pausar até você reativar. No período, o contrato não gera receitas
            {comAsaas ? ' e a assinatura fica suspensa no Asaas' : ''}.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditando(false)} disabled={busy} className={cn(btn.outline, 'h-9 flex-1 text-[13px]')}>Cancelar</button>
            <button type="button" onClick={salvar} disabled={busy || !desde} className={cn(btn.primary, 'h-9 flex-1 text-[13px]')}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar pausa
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {estado ? (
            <>
              <button type="button" onClick={reativar} disabled={busy} className={cn(btn.primary, 'h-9 flex-1 text-[13px]')}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {estado === 'agendada' ? 'Cancelar pausa' : 'Reativar agora'}
              </button>
              <button type="button" onClick={() => setEditando(true)} disabled={busy} className={cn(btn.outline, 'h-9 flex-1 text-[13px]')}>Mudar datas</button>
            </>
          ) : (
            <button type="button" onClick={() => { setDesde(hoje); setAte(''); setEditando(true); }} className={cn(btn.outline, 'h-9 w-full text-[13px]')}>
              <Pause className="h-3.5 w-3.5" /> Pausar contrato
            </button>
          )}
        </div>
      )}
    </div>
  );
}
