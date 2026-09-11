import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { PLAN } from '@/lib/plans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function Assinatura() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTenant, acessoAtivo, trialDias, role, refresh } = useTenant();
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('anual');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [precoMensal, setPrecoMensal] = useState(PLAN.precoMensal);
  const [precoAnualParcela, setPrecoAnualParcela] = useState(PLAN.precoAnualParcela);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('plataforma_config').select('preco_mensal, preco_anual_parcela').eq('id', true).maybeSingle();
      if (data) {
        setPrecoMensal(Number(data.preco_mensal));
        setPrecoAnualParcela(Number(data.preco_anual_parcela));
      }
    })();
  }, []);
  const precoAnualTotal = precoAnualParcela * 12;

  const podeAssinar = role === 'owner' || role === 'admin';
  const cortesia = !!activeTenant?.cortesia;
  const assinaturaAtiva = activeTenant?.status_assinatura === 'ativa';
  const cicloAtual = (activeTenant?.ciclo as 'mensal' | 'anual' | null) ?? null;
  const descontoPct = precoMensal > precoAnualParcela ? Math.round((1 - precoAnualParcela / precoMensal) * 100) : 0;

  const chamarAsaas = async (novoCiclo: 'mensal' | 'anual', precisaCpf: boolean) => {
    if (!activeTenant) return;
    if (precisaCpf && !cpfCnpj.replace(/\D/g, '')) { toast({ title: 'Informe seu CPF ou CNPJ', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ tenant_id: activeTenant.id, ciclo: novoCiclo, cpfCnpj }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao assinar');
      await refresh();
      if (data.changed) {
        toast({ title: 'Plano alterado!', description: data.message || 'A mudança passa a valer no próximo vencimento.' });
      } else if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
        toast({ title: 'Quase lá!', description: 'Abrimos a fatura pra você pagar (Pix, boleto ou cartão).' });
      } else {
        toast({ title: 'Assinatura criada', description: 'Acompanhe o pagamento no ASAAS.' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao assinar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const assinar = () => chamarAsaas(ciclo, true);
  const mudarPlano = (novo: 'mensal' | 'anual') => chamarAsaas(novo, false);

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-md px-5 pt-12 pb-16">
        <button onClick={() => navigate('/')} className="mb-5 inline-flex items-center gap-1.5 text-sm text-foreground-muted">
          <ArrowLeftIcon className="h-4 w-4" /> Voltar
        </button>

        <p className="text-xs font-medium text-foreground-muted mb-0.5">Assinatura</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-1">Plano {PLAN.nome}</h1>
        <p className="text-sm text-foreground-muted mb-5">{PLAN.descricao}</p>

        {cortesia ? (
          <div className="rounded-2xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 p-4 mb-5">
            <div className="text-sm font-semibold text-foreground">Acesso liberado (cortesia)</div>
            <div className="text-xs text-foreground-muted mt-0.5">Tudo liberado. Bom trabalho!</div>
          </div>
        ) : assinaturaAtiva ? (
          <div className="space-y-3 mb-5">
            <div className="rounded-2xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 p-4">
              <div className="text-sm font-semibold text-foreground">Assinatura ativa</div>
              <div className="text-xs text-foreground-muted mt-0.5">
                Plano {cicloAtual === 'anual' ? 'Anual' : 'Mensal'} · {cicloAtual === 'anual' ? `12× ${fmt(precoAnualParcela)}` : `${fmt(precoMensal)}/mês`}
              </div>
            </div>

            {podeAssinar && cicloAtual !== 'anual' && descontoPct > 0 && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="text-sm font-semibold text-foreground">Economize {descontoPct}% no plano Anual</div>
                <div className="text-xs text-foreground-muted mt-0.5 mb-3">
                  Pague 12× {fmt(precoAnualParcela)} em vez de {fmt(precoMensal)}/mês. A mudança começa no próximo vencimento — sem cobrança dupla.
                </div>
                <Button className="w-full h-11 rounded-2xl font-semibold" onClick={() => mudarPlano('anual')} disabled={loading}>
                  {loading ? 'Alterando…' : 'Mudar para Anual'}
                </Button>
              </div>
            )}

            {podeAssinar && cicloAtual === 'anual' && (
              <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                <div className="text-sm font-semibold text-foreground">Você está no melhor preço (Anual)</div>
                <button
                  onClick={() => mudarPlano('mensal')}
                  disabled={loading}
                  className="mt-1.5 text-xs font-medium text-foreground-muted underline underline-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Alterando…' : 'Prefiro voltar para o mensal'}
                </button>
              </div>
            )}

            {!podeAssinar && (
              <p className="text-xs text-foreground-muted text-center py-1">Só o responsável (owner/admin) pode mudar o plano.</p>
            )}
          </div>
        ) : (
          <>
            {typeof trialDias === 'number' && (
              <div className={cn('rounded-xl px-4 py-2.5 mb-5 text-sm font-medium',
                acessoAtivo ? 'bg-primary/10 text-primary' : 'bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]')}>
                {acessoAtivo ? `Você tem ${trialDias} dia(s) de teste restante(s).` : 'Seu período de teste terminou. Assine para continuar.'}
              </div>
            )}

            {/* Toggle ciclo */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setCiclo('anual')}
                className={cn('relative rounded-2xl border p-4 text-left transition-colors',
                  ciclo === 'anual' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border/60 bg-surface/70')}
              >
                {precoMensal > precoAnualParcela && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] px-1.5 py-0.5 rounded-full">
                    -{Math.round((1 - precoAnualParcela / precoMensal) * 100)}%
                  </span>
                )}
                <div className="text-xs text-foreground-muted">Anual</div>
                <div className="text-lg font-bold text-foreground">12× {fmt(precoAnualParcela)}</div>
                <div className="text-[11px] text-foreground-muted">{fmt(precoAnualTotal)}/ano</div>
              </button>
              <button
                onClick={() => setCiclo('mensal')}
                className={cn('rounded-2xl border p-4 text-left transition-colors',
                  ciclo === 'mensal' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border/60 bg-surface/70')}
              >
                <div className="text-xs text-foreground-muted">Mensal</div>
                <div className="text-lg font-bold text-foreground">{fmt(precoMensal)}</div>
                <div className="text-[11px] text-foreground-muted">por mês</div>
              </button>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-5">
              {PLAN.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckIcon className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--success))]" strokeWidth={2.4} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {podeAssinar ? (
              <>
                <div className="space-y-1.5 mb-4">
                  <Label className="text-xs">CPF ou CNPJ (para a cobrança)</Label>
                  <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                <Button className="w-full h-12 rounded-2xl font-semibold" onClick={assinar} disabled={loading}>
                  {loading ? 'Gerando cobrança…' : `Assinar — ${ciclo === 'anual' ? `12× ${fmt(precoAnualParcela)}` : fmt(precoMensal)}`}
                </Button>
                <p className="text-[11px] text-foreground-muted text-center mt-3">Pagamento via Pix, boleto ou cartão pelo ASAAS. Cancele quando quiser.</p>
              </>
            ) : (
              <p className="text-sm text-foreground-muted text-center py-4">Peça ao responsável (owner/admin) da conta para assinar.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
