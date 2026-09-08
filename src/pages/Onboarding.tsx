import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserIcon, BuildingOffice2Icon, CheckIcon, ChevronRightIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import iso from '@/assets/brand/logo_isotipo.svg';

type TenantType = 'pessoal' | 'agencia';
type Step = 'tipo' | 'passos' | 'time' | 'pronto';

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('tipo');
  const [tipo, setTipo] = useState<TenantType>('pessoal');
  const [invites, setInvites] = useState<string[]>(['', '']);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Cria o tenant de verdade (owner = usuário) quando há sessão. Sem sessão
  // (confirmação de e-mail pendente), o wizard segue só visual e cria depois.
  const ensureTenant = async (): Promise<string | null> => {
    if (tenantId) return tenantId;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const nomeConta = tipo === 'agencia' ? (nome ? `${nome.split(' ')[0]} · Agência` : 'Minha agência') : (nome || 'Minha conta');
      const { data, error } = await (supabase as any).rpc('create_tenant_with_owner', { p_nome: nomeConta, p_tipo: tipo });
      if (error || !data) return null;
      setTenantId(data as string);
      return data as string;
    } catch { return null; }
  };

  const nome = useMemo(() => {
    try { return localStorage.getItem('onboarding:nome') || ''; } catch { return ''; }
  }, []);
  const primeiroNome = nome.split(' ')[0] || '';

  const persistTipo = (t: TenantType) => {
    setTipo(t);
    try { localStorage.setItem('onboarding:tipo', t); } catch { /* ignore */ }
  };

  const finish = () => {
    try { localStorage.setItem('onboarding:done', '1'); } catch { /* ignore */ }
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-14">

        {/* ===== TIPO DE CONTA ===== */}
        {step === 'tipo' && (
          <>
            <div className="mb-1.5">
              <p className="text-xs font-medium text-foreground-muted mb-0.5">Sua conta</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Como vai usar?</h1>
            </div>
            <p className="text-[12.5px] text-foreground-muted leading-relaxed mb-5">
              Isso define a linguagem e os relatórios. Dá pra ter as duas e trocar quando quiser.
            </p>

            <ChoiceCard
              selected={tipo === 'pessoal'}
              onClick={() => persistTipo('pessoal')}
              icon={<UserIcon className="h-5 w-5" />}
              iconClass="bg-primary/15 text-primary"
              title="Pessoal"
              desc="Organize contas, cartões, orçamento e metas de economia."
            />
            <ChoiceCard
              selected={tipo === 'agencia'}
              onClick={() => persistTipo('agencia')}
              icon={<BuildingOffice2Icon className="h-5 w-5" />}
              iconClass="bg-[hsl(var(--warning))]/16 text-[hsl(var(--warning))]"
              title="Agência"
              desc="Gestão financeira, clientes, contratos e MRR da sua agência."
            />

            <div className="flex-1" />
            <Button
              className="w-full h-12 rounded-2xl font-semibold text-[15px]"
              onClick={async () => { await ensureTenant(); setStep('passos'); }}
            >
              Continuar
            </Button>
          </>
        )}

        {/* ===== PRÓXIMOS PASSOS ===== */}
        {step === 'passos' && (
          <>
            <div className="mb-3.5">
              <p className="text-xs font-medium text-foreground-muted mb-0.5">Quase lá</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Próximos passos</h1>
            </div>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-xs font-semibold text-foreground-muted whitespace-nowrap">2 de 4</span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: '50%' }} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl px-4">
              <StepRow state="done" title="Conta criada" desc={`Perfil ${tipo === 'agencia' ? 'Agência' : 'Pessoal'} ativo`} />
              <StepRow state="done" title="E-mail confirmado" desc="Verifique sua caixa de entrada" />
              <StepRow state="now" n={3} title="Adicione uma conta" desc="Banco, carteira ou cartão" chevron />
              <StepRow state="next" n={4} title="Importe um extrato" desc="A IA categoriza pra você" />
              <StepRow state="next" n={5} title="Defina uma meta" desc="Reserva, viagem, orçamento…" />
            </div>

            <div className="flex-1" />
            <Button
              className="w-full h-12 rounded-2xl font-semibold text-[15px]"
              onClick={() => (tipo === 'agencia' ? setStep('time') : setStep('pronto'))}
            >
              Adicionar conta
            </Button>
            <button
              onClick={() => (tipo === 'agencia' ? setStep('time') : setStep('pronto'))}
              className="text-[12.5px] text-foreground-muted text-center mt-3 no-touch-min"
            >
              Fazer depois
            </button>
          </>
        )}

        {/* ===== CONVIDE SEU TIME (agência) ===== */}
        {step === 'time' && (
          <>
            <div className="mb-1.5">
              <p className="text-xs font-medium text-foreground-muted mb-0.5">Agência · Equipe</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Convide seu time</h1>
            </div>
            <p className="text-[12.5px] text-foreground-muted leading-relaxed mb-4">
              Todo mundo na mesma conta da agência, com as permissões certas.
            </p>

            <div className="space-y-2">
              {invites.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={val}
                    onChange={(e) => setInvites((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    placeholder="Adicionar e-mail…"
                    type="email"
                    className="h-11 flex-1"
                  />
                  <span className="text-[11px] font-semibold text-foreground-muted bg-surface-2 px-3 py-2.5 rounded-lg whitespace-nowrap">
                    {i === 0 ? 'Admin' : 'Membro'}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setInvites((prev) => [...prev, ''])}
              className="flex items-center gap-1.5 text-primary text-[12.5px] font-semibold mt-3 no-touch-min"
            >
              <PlusIcon className="h-4 w-4" /> Adicionar outro
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted mt-5 mb-2">Já na conta</p>
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                {(primeiroNome[0] || 'V').toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{nome || 'Você'} (você)</div>
                <div className="text-xs text-foreground-muted">Owner</div>
              </div>
            </div>

            <div className="flex-1" />
            <Button
              className="w-full h-12 rounded-2xl font-semibold text-[15px]"
              onClick={async () => {
                const validos = invites.map((e) => e.trim()).filter(Boolean);
                if (validos.length > 0) {
                  const tid = await ensureTenant();
                  if (tid) {
                    await (supabase as any).from('tenant_invites').insert(
                      validos.map((email, i) => ({ tenant_id: tid, email, papel: i === 0 ? 'admin' : 'membro' })),
                    );
                    toast({ title: 'Convites registrados', description: `${validos.length} convite(s) criado(s).` });
                  }
                }
                setStep('pronto');
              }}
            >
              Enviar convites
            </Button>
            <button onClick={() => setStep('pronto')} className="text-[12.5px] text-foreground-muted text-center mt-3 no-touch-min">
              Pular por agora
            </button>
          </>
        )}

        {/* ===== TUDO PRONTO ===== */}
        {step === 'pronto' && (
          <div className="flex flex-1 flex-col items-center text-center">
            <div className="flex-1" />
            <span
              className="grid h-[88px] w-[88px] place-items-center rounded-[24px]"
              style={{
                background:
                  'radial-gradient(120% 92% at 20% 8%, rgba(58,120,205,0.98), transparent 56%), radial-gradient(120% 90% at 92% 16%, rgba(216,152,70,0.72), transparent 50%), #0a1120',
                boxShadow: '0 12px 28px -8px rgba(60,120,210,0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              <img src={iso} alt="balanx" className="h-12 w-auto" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-6">
              Tudo pronto{primeiroNome ? `, ${primeiroNome}` : ''}!
            </h1>
            <p className="text-[13px] text-foreground-muted mt-2 max-w-[28ch] leading-relaxed">
              {tipo === 'agencia'
                ? 'Sua conta de agência está configurada. Gestão financeira, do primeiro dia.'
                : 'Sua conta Pessoal está configurada. Seu dinheiro, organizado desde o primeiro dia.'}
            </p>

            <div className="flex-1" />
            <Button className="w-full h-12 rounded-2xl font-semibold text-[15px]" onClick={finish}>
              Ir para o início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({
  selected, onClick, icon, iconClass, title, desc,
}: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; iconClass: string; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[18px] border p-4 text-left mb-2.5 transition-colors',
        selected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border/60 bg-surface/70 backdrop-blur-xl hover:border-border',
      )}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[14px]', iconClass)}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        <span className="block text-[11.5px] text-foreground-muted mt-0.5 leading-snug">{desc}</span>
      </span>
      {selected && (
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

function StepRow({
  state, n, title, desc, chevron,
}: {
  state: 'done' | 'now' | 'next'; n?: number; title: string; desc: string; chevron?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border/50 last:border-b-0">
      <span
        className={cn(
          'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11.5px] font-bold',
          state === 'done' && 'bg-[hsl(var(--success))] text-[#04120b]',
          state === 'now' && 'bg-primary text-primary-foreground',
          state === 'next' && 'bg-surface-2 text-foreground-muted',
        )}
      >
        {state === 'done' ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
      </span>
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-semibold', state === 'now' ? 'text-primary' : 'text-foreground')}>{title}</div>
        <div className="text-[11.5px] text-foreground-muted mt-0.5">{desc}</div>
      </div>
      {chevron && <ChevronRightIcon className="h-4 w-4 text-foreground-muted/60 shrink-0 mt-1" />}
    </div>
  );
}
