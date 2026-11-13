import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/AuthShell';
import { BalanxLoader } from '@/components/shared/BalanxLoader';
import { cn } from '@/lib/utils';

/** Força de senha 0..4 */
function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABEL = ['Muito fraca', 'Fraca', 'Ok', 'Boa', 'Senha forte'];

export default function CriarConta() {
  const { user, loading, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  // Projeto exige confirmar o e-mail → mostra o aviso em vez de seguir pro onboarding
  const [confirmarEmail, setConfirmarEmail] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const score = passwordScore(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !password) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha nome, e-mail e senha.', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Senha muito curta', description: 'Use ao menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await signUp(email, password, nome);
    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
      return;
    }
    // Guarda o nome para o onboarding e segue para o wizard
    try { localStorage.setItem('onboarding:nome', nome); } catch { /* ignore */ }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setConfirmarEmail(true); return; }
    navigate('/onboarding', { replace: true });
  };

  if (loading) {
    return <BalanxLoader />;
  }

  const fieldClass = 'h-12 rounded-[14px] bg-surface-2';
  const labelClass = 'text-[13px] font-semibold text-foreground';

  return (
    <AuthShell
      foto="sofa"
      title={<>Comece agora, <span className="font-serif italic font-normal tracking-normal">sem planilha.</span></>}
    >
      {confirmarEmail ? (
        <div className="py-2 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><MailCheck className="h-6 w-6" /></span>
          <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-foreground">Confirme seu e-mail</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-foreground-muted">
            Enviamos um link para <b className="font-semibold text-foreground">{email}</b>. Abra o e-mail e toque no link para continuar a configuração.
          </p>
          <Link to="/login" className="mt-5 inline-flex h-11 items-center rounded-full border border-border px-5 text-[14px] font-semibold text-foreground hover:bg-surface-2">Ir para o login</Link>
        </div>
      ) : (<>
      <div className="mb-5">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">Criar conta</h2>
        <p className="mt-1 text-[14px] text-foreground-muted">Leva menos de um minuto.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['14 dias grátis', 'Sem cartão', 'Cancele quando quiser'].map((t) => (
            <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-success-bg px-2.5 text-[12px] font-semibold text-success-fg">✓ {t}</span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="nome" className={labelClass}>Nome</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como podemos te chamar?"
            autoComplete="name"
            disabled={isSubmitting}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className={labelClass}>E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            disabled={isSubmitting}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className={labelClass}>Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={verSenha ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
              disabled={isSubmitting}
              className={cn(fieldClass, 'pr-12')}
            />
            <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-foreground-muted hover:bg-surface-3 hover:text-foreground">
              {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* Medidor de força */}
          <div className="flex gap-1 pt-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  password.length === 0
                    ? 'bg-surface-3'
                    : i < score
                      ? score <= 1 ? 'bg-[hsl(var(--danger))]' : score <= 2 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--success))]'
                      : 'bg-surface-3',
                )}
              />
            ))}
          </div>
          {password.length > 0 && (
            <p className="pt-0.5 text-[12px] text-foreground-muted">{STRENGTH_LABEL[score]}</p>
          )}
        </div>

        <Button type="submit" className="!mt-5 h-12 w-full rounded-full text-[15px] font-semibold" disabled={isSubmitting}>
          {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>) : 'Criar conta'}
        </Button>

        <p className="text-center text-[12px] leading-relaxed text-foreground-muted">
          Ao continuar você concorda com os <a href="https://www.balanx.com.br/termos" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">Termos de Uso</a> e a <a href="https://www.balanx.com.br/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">Política de Privacidade</a>.
        </p>
      </form>

      <p className="mt-4 text-center text-[14px] text-foreground-muted">
        Já tem conta? <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
      </p>
      </>)}
    </AuthShell>
  );
}
