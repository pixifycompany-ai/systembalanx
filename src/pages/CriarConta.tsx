import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
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
    toast({ title: 'Conta criada!', description: 'Vamos configurar em poucos passos.' });
    navigate('/onboarding', { replace: true });
  };

  if (loading) {
    return <BalanxLoader />;
  }

  const fieldClass = 'h-12 rounded-[14px] bg-surface-2';
  const labelClass = 'text-[13px] font-semibold text-foreground';

  return (
    <AuthShell
      title={<>Comece agora, <span className="font-serif italic font-normal tracking-normal">sem planilha.</span></>}
    >
      <div className="mb-5">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">Criar conta</h2>
        <p className="mt-1 text-[14px] text-foreground-muted">Leva menos de um minuto.</p>
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
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isSubmitting}
            className={fieldClass}
          />
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
          Ao continuar você concorda com os <b className="font-semibold text-foreground">Termos</b> e a <b className="font-semibold text-foreground">Privacidade</b>.
        </p>
      </form>

      <p className="mt-4 text-center text-[14px] text-foreground-muted">
        Já tem conta? <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
