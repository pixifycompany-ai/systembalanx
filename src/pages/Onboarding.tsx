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
import { AURO_ICON_BG, PixifyLogo } from '@/components/shared/PixifyLogo';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW } from '@/components/shared/navyTokens';
import { HexWatermark } from '@/components/shared/NavySurface';

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
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] md:pt-14">
        <PixifyLogo size="sm" className="mb-8 md:mb-10" />

        {/* ===== TIPO DE CONTA ===== */}
        {step === 'tipo' && (
          <>
            <StepProgress atual={1} />
            <MobilePageHeader
              className="mb-2 md:mb-2"
              eyebrow="Sua conta"
              title={<>Como vai <span className="font-serif italic font-normal tracking-normal">usar?</span></>}
            />
            <p className="mb-5 text-[14px] leading-relaxed text-foreground-muted">
              Isso define a linguagem e os relatórios. Dá pra ter as duas e trocar quando quiser.
            </p>

            <ChoiceCard
              selected={tipo === 'pessoal'}
              onClick={() => persistTipo('pessoal')}
              icon={<UserIcon className="h-5 w-5" />}
              iconClass="bg-info-bg text-info-fg"
              title="Pessoal"
              desc="Organize contas, cartões, orçamento e metas de economia."
            />
            <ChoiceCard
              selected={tipo === 'agencia'}
              onClick={() => persistTipo('agencia')}
              icon={<BuildingOffice2Icon className="h-5 w-5" />}
              iconClass="bg-warning-bg text-warning-fg"
              title="Agência"
              desc="Gestão financeira, clientes, contratos e MRR da sua agência."
            />

            <div className="flex-1" />
            <Button
              className="h-12 w-full rounded-full text-[15px] font-semibold"
              onClick={async () => { await ensureTenant(); setStep('passos'); }}
            >
              Continuar
            </Button>
          </>
        )}

        {/* ===== PRÓXIMOS PASSOS ===== */}
        {step === 'passos' && (
          <>
            <StepProgress atual={2} />
            <MobilePageHeader
              className="mb-4 md:mb-5"
              eyebrow="Quase lá"
              title={<>Próximos <span className="font-serif italic font-normal tracking-normal">passos</span></>}
            />

            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Checklist</h2>
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              <StepRow state="done" title="Conta criada" desc={`Perfil ${tipo === 'agencia' ? 'Agência' : 'Pessoal'} ativo`} />
              <StepRow state="done" title="E-mail confirmado" desc="Verifique sua caixa de entrada" />
              <StepRow state="now" n={3} title="Adicione uma conta" desc="Banco, carteira ou cartão" chevron />
              <StepRow state="next" n={4} title="Importe um extrato" desc="A IA categoriza pra você" />
              <StepRow state="next" n={5} title="Defina uma meta" desc="Reserva, viagem, orçamento…" />
            </div>

            <div className="flex-1" />
            <Button
              className="h-12 w-full rounded-full text-[15px] font-semibold"
              onClick={() => (tipo === 'agencia' ? setStep('time') : setStep('pronto'))}
            >
              Adicionar conta
            </Button>
            <button
              onClick={() => (tipo === 'agencia' ? setStep('time') : setStep('pronto'))}
              className="mt-3 text-center text-[13px] font-medium text-foreground-muted no-touch-min"
            >
              Fazer depois
            </button>
          </>
        )}

        {/* ===== CONVIDE SEU TIME (agência) ===== */}
        {step === 'time' && (
          <>
            <StepProgress atual={3} />
            <MobilePageHeader
              className="mb-2 md:mb-2"
              eyebrow="Agência · Equipe"
              title={<>Convide seu <span className="font-serif italic font-normal tracking-normal">time</span></>}
            />
            <p className="mb-5 text-[14px] leading-relaxed text-foreground-muted">
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
                    className="h-12 flex-1 rounded-[14px] bg-surface"
                  />
                  <span className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-surface-2 px-3.5 text-[12px] font-semibold text-foreground-muted">
                    {i === 0 ? 'Admin' : 'Membro'}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setInvites((prev) => [...prev, ''])}
              className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-primary no-touch-min"
            >
              <PlusIcon className="h-4 w-4" /> Adicionar outro
            </button>

            <h2 className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Já na conta</h2>
            <div className="flex items-center gap-3 rounded-[20px] border border-border bg-surface px-3.5 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-info-bg text-[13px] font-semibold text-info-fg">
                {(primeiroNome[0] || 'V').toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-foreground">{nome || 'Você'} (você)</div>
                <div className="text-[12px] text-foreground-muted">Owner</div>
              </div>
            </div>

            <div className="flex-1" />
            <Button
              className="h-12 w-full rounded-full text-[15px] font-semibold"
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
            <button onClick={() => setStep('pronto')} className="mt-3 text-center text-[13px] font-medium text-foreground-muted no-touch-min">
              Pular por agora
            </button>
          </>
        )}

        {/* ===== TUDO PRONTO ===== */}
        {step === 'pronto' && (
          <div className="flex flex-1 flex-col">
            <div className="flex-1" />
            <div
              className="relative isolate flex flex-col items-center overflow-hidden rounded-[20px] px-6 py-10 text-center text-white md:rounded-3xl"
              style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}
            >
              <HexWatermark />
              <span
                className="grid h-[88px] w-[88px] place-items-center rounded-[24px]"
                style={{
                  background: AURO_ICON_BG,
                  boxShadow: '0 10px 24px -10px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.14)',
                }}
              >
                <img src={iso} alt="balanx" className="h-[54px] w-auto" />
              </span>
              <h1 className="mt-6 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
                Tudo <span className="font-serif italic font-normal tracking-normal">pronto</span>{primeiroNome ? `, ${primeiroNome}` : ''}!
              </h1>
              <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-white/75">
              {tipo === 'agencia'
                ? 'Sua conta de agência está configurada. Gestão financeira, do primeiro dia.'
                : 'Sua conta Pessoal está configurada. Seu dinheiro, organizado desde o primeiro dia.'}
              </p>
            </div>

            <div className="flex-1" />
            <Button className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold" onClick={finish}>
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
        'mb-2.5 flex w-full items-center gap-3 rounded-[20px] border bg-surface p-4 text-left transition-colors',
        selected ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:bg-surface-2',
      )}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[13px]', iconClass)}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-foreground-muted">{desc}</span>
      </span>
      {selected && (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground text-background">
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
    <div className="flex items-start gap-3 border-b border-border py-3.5 last:border-b-0">
      <span
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
          state === 'done' && 'bg-success-bg text-success-fg',
          state === 'now' && 'bg-primary text-primary-foreground',
          state === 'next' && 'bg-surface-2 text-foreground-muted',
        )}
      >
        {state === 'done' ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
      </span>
      <div className="flex-1 min-w-0">
        <div className={cn('text-[14px] font-semibold', state === 'now' ? 'text-primary' : 'text-foreground')}>{title}</div>
        <div className="mt-0.5 text-[12px] text-foreground-muted">{desc}</div>
      </div>
      {chevron && <ChevronRightIcon className="mt-1.5 h-4 w-4 shrink-0 text-foreground-muted" />}
    </div>
  );
}

/** Barra de progresso do onboarding (segmentos em pílula). */
function StepProgress({ atual, total = 4 }: { atual: number; total?: number }) {
  return (
    <div className="mb-5 flex items-center gap-3" aria-label={`Passo ${atual} de ${total}`}>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < atual ? 'bg-primary' : 'bg-surface-3')} />
        ))}
      </div>
      <span className="whitespace-nowrap text-[12px] font-semibold text-foreground-muted">{atual} de {total}</span>
    </div>
  );
}
