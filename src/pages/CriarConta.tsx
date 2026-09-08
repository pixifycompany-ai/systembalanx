import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
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
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-14">
        <div className="mb-8">
          <PixifyLogo size="sm" />
        </div>

        {/* Cabeçalho */}
        <div className="mb-6">
          <p className="text-xs font-medium text-foreground-muted mb-0.5">Comece agora</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Criar conta</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-[11px] font-semibold text-foreground-muted">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                autoComplete="name"
                disabled={isSubmitting}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-semibold text-foreground-muted">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                disabled={isSubmitting}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-semibold text-foreground-muted">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isSubmitting}
                className="h-11"
              />
              {/* Medidor de força */}
              <div className="flex gap-1 pt-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-[3px] flex-1 rounded-full transition-colors',
                      password.length === 0
                        ? 'bg-border'
                        : i < score
                          ? score <= 1 ? 'bg-[hsl(var(--danger))]' : score <= 2 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--success))]'
                          : 'bg-border',
                    )}
                  />
                ))}
              </div>
              {password.length > 0 && (
                <p className="text-[11px] text-foreground-muted pt-0.5">{STRENGTH_LABEL[score]}</p>
              )}
            </div>
          </div>

          <div className="flex-1" />

          <Button type="submit" className="w-full h-12 rounded-2xl font-semibold text-[15px] mt-8" disabled={isSubmitting}>
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>) : 'Criar conta'}
          </Button>

          <p className="text-[11px] text-foreground-muted text-center mt-4 leading-relaxed">
            Ao continuar você concorda com os <b className="text-foreground/80">Termos</b> e a <b className="text-foreground/80">Privacidade</b>.
          </p>
          <p className="text-[12.5px] text-foreground-muted text-center mt-2.5">
            Já tem conta? <Link to="/login" className="font-semibold text-primary">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
