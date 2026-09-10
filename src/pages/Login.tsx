import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import loginVideo from '@/assets/brand/login.mp4';
import { BalanxLoader } from '@/components/shared/BalanxLoader';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Detecta desktop (>=768px) de forma síncrona no 1º render p/ não piscar o layout mobile.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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

  // Campos do formulário — reaproveitados no mobile e no desktop (mesmo state/handlers).
  const formFields = (
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
      <div className="flex justify-end -mt-1">
        <Link to="/esqueci-senha" className="text-[12px] font-medium text-white/70 hover:text-white">
          Esqueci minha senha
        </Link>
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
  );

  // ---------------- DESKTOP (>=768px): split-screen vídeo | formulário ----------------
  if (isDesktop) {
    return (
      <div className="grid min-h-[100dvh] w-full grid-cols-2 bg-[#04060b]">
        {/* Coluna esquerda — vídeo + marca */}
        <div className="relative overflow-hidden">
          <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline src={loginVideo} />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(3,5,10,0.30), rgba(3,5,10,0.10) 40%, rgba(3,5,10,0.55) 100%)',
            }}
          />
          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            <PixifyLogo size="md" className="[&_span:last-child]:text-white" />
            <div>
              <h1
                className="text-[40px] font-semibold leading-[1.08] tracking-tight text-white xl:text-[46px]"
                style={{ textShadow: '0 2px 30px rgba(0,0,0,0.5)' }}
              >
                Suas finanças,<br />no controle.
              </h1>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
                Gestão financeira completa para sua agência e seus clientes — em um só lugar.
              </p>
            </div>
          </div>
        </div>

        {/* Coluna direita — formulário */}
        <div className="relative flex items-center justify-center px-8">
          {/* brilho ambiente AURO */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 55% at 70% 20%, hsl(var(--primary)/0.16), transparent 70%), radial-gradient(50% 40% at 20% 90%, hsl(var(--primary)/0.10), transparent 70%)',
            }}
          />
          <div className="relative z-10 w-full max-w-[380px]">
            <h2 className="text-[26px] font-semibold tracking-tight text-white">Entrar na conta</h2>
            <p className="mb-6 mt-1 text-[13.5px] text-white/60">Bem-vindo de volta. Acesse seu painel.</p>
            {formFields}
            <p className="mt-5 text-[13px] text-white/60">
              Não tem conta? <Link to="/criar-conta" className="font-semibold text-white hover:underline">Criar conta</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- MOBILE (<768px): layout original intacto ----------------
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
          {formFields}
          <p className="mt-3 text-center text-[12.5px] text-white/70">
            Não tem conta? <Link to="/criar-conta" className="font-semibold text-white">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
