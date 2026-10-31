import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/AuthShell';

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
    <AuthShell title={sent ? 'Verifique seu email.' : 'Recuperar acesso.'}>
          {sent ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MailCheck className="h-7 w-7" />
              </div>
              <p className="text-[13.5px] leading-relaxed text-foreground-muted">
                Se existe uma conta para <span className="font-semibold text-primary hover:underline">{email.trim()}</span>, enviamos um link
                para redefinir a senha. Confira também o spam.
              </p>
              <Link to="/login" className="block">
                <Button className="w-full h-11 rounded-full font-semibold text-[15px]">Voltar para o login</Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-3.5 text-[13px] leading-relaxed text-foreground-muted">
                Digite o email da sua conta. Enviaremos um link para você criar uma nova senha.
              </p>
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
                <Button
                  type="submit"
                  className="w-full h-12 rounded-full font-semibold text-[15px]"
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
              <p className="mt-3 text-center text-[12.5px] text-foreground-muted">
                Lembrou a senha? <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
              </p>
            </>
          )}
    </AuthShell>
  );
}
