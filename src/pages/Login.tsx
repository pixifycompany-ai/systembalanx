import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/AuthShell';
import { BalanxLoader } from '@/components/shared/BalanxLoader';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha email e senha.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: 'Email ou senha incorretos.', variant: 'destructive' });
    }
  };

  if (loading) {
    return <BalanxLoader />;
  }

  // Campos do formulário (dentro do cartão do AuthShell).
  const formFields = (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[13px] font-semibold text-foreground">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          disabled={isSubmitting}
          className="h-12 rounded-[14px] bg-surface-2"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[13px] font-semibold text-foreground">Senha</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={isSubmitting}
          className="h-12 rounded-[14px] bg-surface-2"
        />
      </div>
      <div className="flex justify-end -mt-1">
        <Link to="/esqueci-senha" className="text-[13px] font-medium text-primary hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button
        type="submit"
        className="w-full h-12 rounded-full font-semibold text-[15px]"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  );

  return (
    <AuthShell
      title={<>Seu financeiro, <span className="font-serif italic font-normal tracking-normal">no bolso.</span></>}
    >
      <div className="mb-5">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">Entrar</h2>
        <p className="mt-1 text-[14px] text-foreground-muted">Bem-vindo de volta.</p>
      </div>
      {formFields}
      <p className="mt-4 text-center text-[14px] text-foreground-muted">
        Ainda não tem conta? <Link to="/criar-conta" className="font-semibold text-primary hover:underline">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
