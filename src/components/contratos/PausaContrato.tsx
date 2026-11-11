// Bloco "Pausa" no editar contrato: pausar a partir de uma data (com ou sem data
// para voltar), mudar a pausa ou reativar agora.
import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { FormSection, InlineNotice } from '@/components/cobrancas/formParts';
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
    <FormSection label="Pausa">
      {estado && !editando && (
        <InlineNotice tone="warning">{descreverPausa(contrato, hoje)}.</InlineNotice>
      )}

      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <DatePickerField label="Pausar a partir de" value={desde} onChange={setDesde} />
            <DatePickerField label="Voltar a cobrar em" value={ate} onChange={setAte} />
          </div>
          <p className="text-[11.5px] text-foreground-muted">
            Deixe "voltar a cobrar" vazio para pausar até você reativar. No período, o contrato não gera receitas
            {comAsaas ? ' e a assinatura fica suspensa no Asaas' : ''}.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={salvar} disabled={busy || !desde}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Salvar pausa
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={busy}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {estado ? (
            <>
              <Button type="button" size="sm" onClick={reativar} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />} {estado === 'agendada' ? 'Cancelar pausa' : 'Reativar agora'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)} disabled={busy}>Mudar datas</Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => { setDesde(hoje); setAte(''); setEditando(true); }}>
              <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar contrato
            </Button>
          )}
        </div>
      )}
    </FormSection>
  );
}
