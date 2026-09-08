import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import loginVideo from '@/assets/brand/login.mp4';

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
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#04060b]">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#04060b]">
      {/* Vídeo de fundo */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        src={loginVideo}
      />
      {/* Scrim pra legibilidade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(3,5,10,0.35), rgba(3,5,10,0.05) 30%, rgba(3,5,10,0.55) 60%, rgba(3,5,10,0.94))',
        }}
      />

      {/* Conteúdo (ancorado embaixo, estilo app premium) */}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-end px-5 pb-8 pt-20">
        <div className="mb-4">
          <PixifyLogo size="md" className="[&_span:last-child]:text-white" />
        </div>

        <h1
          className="mb-5 text-[26px] font-semibold leading-[1.15] tracking-tight text-white"
          style={{ textShadow: '0 2px 22px rgba(0,0,0,0.45)' }}
        >
          Suas finanças,<br />no controle.
        </h1>

        {/* Card de vidro */}
        <div className="rounded-3xl p-4 backdrop-blur-2xl border border-white/10" style={{ background: 'rgba(16,22,34,0.46)' }}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-medium uppercase tracking-wide text-white/70">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={isSubmitting}
                className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-medium uppercase tracking-wide text-white/70">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/40"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl font-semibold text-[15px] shadow-[0_12px_26px_-6px_hsl(var(--primary)/0.6)]"
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
          <p className="mt-3 text-center text-[11px] text-white/55">Acesso restrito · balanx.com.br</p>
        </div>
      </div>
    </div>
  );
}
