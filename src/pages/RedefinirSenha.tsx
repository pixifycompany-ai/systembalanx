import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/AuthShell';

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
    <AuthShell title={estado === 'ok' ? 'Tudo certo!' : 'Nova senha.'}>
          {estado === 'verificando' && (
            <div className="flex items-center justify-center gap-2 py-8 text-foreground-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-[13.5px]">Validando o link…</span>
            </div>
          )}

          {estado === 'invalido' && (
            <div className="space-y-4 py-2 text-center">
              <p className="text-[13.5px] leading-relaxed text-foreground-muted">
                Este link de recuperação é inválido ou expirou. Solicite um novo para redefinir sua senha.
              </p>
              <Link to="/esqueci-senha" className="block">
                <Button className="w-full h-11 rounded-full font-semibold text-[15px]">Solicitar novo link</Button>
              </Link>
            </div>
          )}

          {estado === 'ok' && (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <p className="text-[13.5px] text-foreground-muted">Senha redefinida com sucesso. Redirecionando…</p>
            </div>
          )}

          {estado === 'pronto' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-semibold text-foreground">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="h-12 rounded-[14px] bg-surface-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-[13px] font-semibold text-foreground">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="h-12 rounded-[14px] bg-surface-2"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-full font-semibold text-[15px]"
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
    </AuthShell>
  );
}
