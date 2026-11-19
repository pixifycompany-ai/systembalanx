// Painel de conexão que a IARA abre na conversa ("conecta meu WhatsApp", "liga o Google",
// "configura o atalho do iPhone"…). Reaproveita os mesmos painéis de Meu Perfil.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Download, Loader2, MessageCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { WhatsAppPainel } from '@/components/perfil/WhatsAppPainel';
import { GoogleAgendaPainel } from '@/components/perfil/GoogleAgendaPainel';
import { AtalhoIphonePainel } from '@/components/perfil/AtalhoIphonePainel';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { btn } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';

const TITULOS: Record<string, { titulo: string; icone: React.ReactNode }> = {
  whatsapp: { titulo: 'WhatsApp da empresa', icone: <MessageCircle className="h-4 w-4" /> },
  google: { titulo: 'Google Agenda e Tarefas', icone: <span className="text-[13px] font-semibold">G</span> },
  atalho_iphone: { titulo: 'Atalho do iPhone', icone: <Smartphone className="h-4 w-4" /> },
  notificacoes: { titulo: 'Notificações no celular', icone: <Bell className="h-4 w-4" /> },
  asaas: { titulo: 'Conta Asaas', icone: <span className="text-[13px] font-semibold">A</span> },
  instalar_app: { titulo: 'Instalar o app', icone: <Download className="h-4 w-4" /> },
};

function Notificacoes() {
  const { user } = useAuth();
  const { profile, updatePushEnabled } = useProfile();
  const [busy, setBusy] = useState(false);
  const ativar = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { subscribeForPush, isPushSupported } = await import('@/utils/pushSubscription');
      if (!isPushSupported()) { toast.error('Este navegador não recebe notificações. No iPhone, instale o app na Tela de Início primeiro.'); return; }
      const { error } = await subscribeForPush(user.id);
      if (error) { toast.error(error.message); return; }
      const r = await updatePushEnabled(true);
      if (r.error) toast.error('Erro ao salvar a preferência');
      else toast.success('Notificações ativadas. Aviso diário às 8h.');
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-foreground-muted">Avisos do que vence no dia, recebimentos e lembretes da IARA direto no seu celular.</p>
      {profile?.push_enabled
        ? <p className="rounded-2xl bg-success-bg px-3.5 py-3 text-[13px] text-success-fg">Notificações já estão ativadas neste aparelho.</p>
        : <button type="button" className={cn(btn.primary, 'w-full')} onClick={ativar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Ativar notificações</button>}
      <p className="text-[11.5px] text-foreground-muted">No iPhone, as notificações só funcionam com o BALANX instalado na Tela de Início.</p>
    </div>
  );
}

function InstalarApp() {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-foreground">
      <div>
        <p className="font-medium">iPhone (Safari)</p>
        <p className="text-foreground-muted">Toque em <b>Compartilhar</b> (o quadrado com a seta) → <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>.</p>
      </div>
      <div>
        <p className="font-medium">Android (Chrome)</p>
        <p className="text-foreground-muted">Toque no menu <b>⋮</b> → <b>Instalar app</b> (ou "Adicionar à tela inicial").</p>
      </div>
      <div>
        <p className="font-medium">Computador (Chrome/Edge)</p>
        <p className="text-foreground-muted">Clique no ícone de instalar na barra de endereço.</p>
      </div>
    </div>
  );
}

function Asaas() {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-foreground-muted">
        Com o Asaas, as cobranças saem com Pix, boleto e cartão, e a baixa é automática quando o cliente paga.
        A chave de API é uma credencial: ela é colada só na tela segura de Meu Perfil, nunca aqui no chat.
      </p>
      <button type="button" className={cn(btn.primary, 'w-full')} onClick={() => navigate('/perfil?abrir=asaas')}>Abrir a conexão do Asaas</button>
    </div>
  );
}

export function ConexaoIara({ tipo }: { tipo: string }) {
  const t = TITULOS[tipo];
  if (!t) return null;
  return (
    <section className="mt-3 overflow-hidden rounded-[20px] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-foreground">{t.icone}</span>
        <p className="text-[14px] font-semibold text-foreground">{t.titulo}</p>
      </div>
      <div className="p-4">
        {tipo === 'whatsapp' && <WhatsAppPainel />}
        {tipo === 'google' && <GoogleAgendaPainel />}
        {tipo === 'atalho_iphone' && <AtalhoIphonePainel />}
        {tipo === 'notificacoes' && <Notificacoes />}
        {tipo === 'asaas' && <Asaas />}
        {tipo === 'instalar_app' && <InstalarApp />}
      </div>
    </section>
  );
}
