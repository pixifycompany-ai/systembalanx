// Volta da autorização do Google: troca o código e leva para Meu Perfil.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sincronizarGoogle, trocarCodigoGoogle } from '@/lib/googleAgenda';

export default function GoogleRetorno() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const code = params.get('code'); const state = params.get('state'); const negado = params.get('error');
    if (negado || !code || !state) {
      setErro(negado === 'access_denied' ? 'Você cancelou a autorização no Google.' : 'Não recebi a autorização do Google.');
      return;
    }
    trocarCodigoGoogle(code, state)
      .then(async (r) => {
        toast.success('Google conectado', { description: r.email ? `Conta ${r.email}. Sincronizando sua agenda…` : 'Sincronizando sua agenda…' });
        sincronizarGoogle().catch(() => {});
        navigate('/perfil?integracao=google', { replace: true });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao conectar'));
  }, [params, navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      {erro ? (
        <>
          <p className="text-[15px] font-semibold text-foreground">Não deu para conectar o Google</p>
          <p className="max-w-sm text-[13.5px] text-foreground-muted">{erro}</p>
          <button onClick={() => navigate('/perfil?integracao=google')} className="mt-2 text-[14px] font-semibold text-primary hover:underline">Voltar para Meu Perfil</button>
        </>
      ) : (
        <><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-[14px] text-foreground-muted">Conectando sua conta Google…</p></>
      )}
    </div>
  );
}
