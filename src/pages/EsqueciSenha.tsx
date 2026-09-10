import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import loginVideo from '@/assets/brand/login.mp4';

export default function EsqueciSenha() {
  const { resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Campo obrigatório', description: 'Informe seu email.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await resetPassword(email.trim());
    setIsSubmitting(false);
    // Por segurança, mostramos sucesso mesmo que o email não exista (evita enumeração de contas).
    if (error) {
      toast({ title: 'Não foi possível enviar', description: 'Tente novamente em instantes.', variant: 'destructive' });
      return;
    }
    setSent(true);
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#04060b]">
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline src={loginVideo} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(3,5,10,0.35), rgba(3,5,10,0.05) 30%, rgba(3,5,10,0.55) 60%, rgba(3,5,10,0.94))',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-end px-5 pb-8 pt-20">
        <div className="mb-4">
          <PixifyLogo size="md" className="[&_span:last-child]:text-white" />
        </div>

        <h1
          className="mb-5 text-[26px] font-semibold leading-[1.15] tracking-tight text-white"
          style={{ textShadow: '0 2px 22px rgba(0,0,0,0.45)' }}
        >
          {sent ? 'Verifique seu email.' : 'Recuperar acesso.'}
        </h1>

        <div className="rounded-3xl p-4 backdrop-blur-2xl border border-white/10" style={{ background: 'rgba(16,22,34,0.46)' }}>
          {sent ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <MailCheck className="h-7 w-7" />
              </div>
              <p className="text-[13.5px] leading-relaxed text-white/80">
                Se existe uma conta para <span className="font-semibold text-white">{email.trim()}</span>, enviamos um link
                para redefinir a senha. Confira também o spam.
              </p>
              <Link to="/login" className="block">
                <Button className="w-full h-11 rounded-2xl font-semibold text-[15px]">Voltar para o login</Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-3.5 text-[13px] leading-relaxed text-white/70">
                Digite o email da sua conta. Enviaremos um link para você criar uma nova senha.
              </p>
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
                <Button
                  type="submit"
                  className="w-full h-12 rounded-2xl font-semibold text-[15px] shadow-[0_12px_26px_-6px_hsl(var(--primary)/0.6)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>
              </form>
              <p className="mt-3 text-center text-[12.5px] text-white/70">
                Lembrou a senha? <Link to="/login" className="font-semibold text-white">Entrar</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
