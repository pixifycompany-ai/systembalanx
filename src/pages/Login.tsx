import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PixifyLogo } from '@/components/shared/PixifyLogo';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect to dashboard
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: 'Email ou senha incorretos.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>);

  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo/Brand */}
        <div className="flex flex-col items-center text-center mb-7">
          <PixifyLogo size="lg" className="justify-center" />
          <p className="mt-3 text-sm text-foreground-muted">Sistema de Gestão Financeira</p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-2xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={isSubmitting}
                className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                className="h-11" />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold shadow-[0_10px_24px_-6px_hsl(var(--primary)/0.5)]"
              disabled={isSubmitting}>
              {isSubmitting ?
              <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </> :
              'Entrar'
              }
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-foreground-subtle">
          Acesso restrito
        </p>
      </div>
    </div>);

}