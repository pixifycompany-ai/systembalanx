import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import loginVideo from '@/assets/brand/login.mp4';

type Estado = 'verificando' | 'pronto' | 'invalido' | 'ok';

export default function RedefinirSenha() {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // O Supabase entrega o link de recuperação com um token na URL. O client
  // detecta esse token e emite o evento PASSWORD_RECOVERY, criando uma sessão
  // temporária que autoriza a troca de senha.
  useEffect(() => {
    // Erro explícito no link (expirado/já usado) vem no hash da URL.
    const hash = window.location.hash || '';
    if (hash.includes('error')) {
      setEstado('invalido');
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setEstado('pronto');
      }
    });

    // Caso a sessão já tenha sido criada antes do listener montar.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setEstado('pronto');
      else {
        // Dá um tempo pro detectSessionInUrl processar o token; se não vier, é inválido.
        setTimeout(() => {
          setEstado((e) => (e === 'verificando' ? 'invalido' : e));
        }, 2500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'As senhas não coincidem', description: 'Confira e tente novamente.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Não foi possível alterar', description: 'O link pode ter expirado. Solicite um novo.', variant: 'destructive' });
      return;
    }
    setEstado('ok');
    toast({ title: 'Senha alterada!', description: 'Você já pode entrar com a nova senha.' });
    setTimeout(() => navigate('/', { replace: true }), 1400);
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
          {estado === 'ok' ? 'Tudo certo!' : 'Nova senha.'}
        </h1>

        <div className="rounded-3xl p-4 backdrop-blur-2xl border border-white/10" style={{ background: 'rgba(16,22,34,0.46)' }}>
          {estado === 'verificando' && (
            <div className="flex items-center justify-center gap-2 py-8 text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-[13.5px]">Validando o link…</span>
            </div>
          )}

          {estado === 'invalido' && (
            <div className="space-y-4 py-2 text-center">
              <p className="text-[13.5px] leading-relaxed text-white/80">
                Este link de recuperação é inválido ou expirou. Solicite um novo para redefinir sua senha.
              </p>
              <Link to="/esqueci-senha" className="block">
                <Button className="w-full h-11 rounded-2xl font-semibold text-[15px]">Solicitar novo link</Button>
              </Link>
            </div>
          )}

          {estado === 'ok' && (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <p className="text-[13.5px] text-white/80">Senha redefinida com sucesso. Redirecionando…</p>
            </div>
          )}

          {estado === 'pronto' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-medium uppercase tracking-wide text-white/70">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-[11px] font-medium uppercase tracking-wide text-white/70">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                    Salvando...
                  </>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
