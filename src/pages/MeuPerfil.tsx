import { useState, useRef, useEffect, useCallback, ChangeEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet as SheetUI, SheetContent } from '@/components/ui/sheet';
import { BalanxLoader } from '@/components/shared/BalanxLoader';
import { toast } from 'sonner';
import {
  AlertTriangle, Bell, BellRing, Camera, Check, ChevronRight, Copy, Loader2, Lock, LogOut, Mail, MessageSquareText,
  Moon, RefreshCw, ShieldCheck, Smartphone, Sparkles, Trash2, User,
} from 'lucide-react';
import { MfaManager } from '@/components/auth/MfaManager';
import { GoogleAgendaPainel } from '@/components/perfil/GoogleAgendaPainel';
import { statusGoogle } from '@/lib/googleAgenda';
import { AtalhoIphonePainel } from '@/components/perfil/AtalhoIphonePainel';
import { WhatsAppPainel } from '@/components/perfil/WhatsAppPainel';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { PageHeader, Segmented, ModalHeader, ModalShell, Campo } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';

/* Logos (Simple Icons, CC0; Asaas: símbolo do logo oficial) */
const LOGO = {
  asaas: <svg viewBox="0 0 20.4 17" className="h-[15px] w-[18px] fill-current" aria-hidden><path fillRule="evenodd" d="M5.98205 10.2322L10.1409 2.69007L14.2997 10.2122C13.1319 9.68231 11.6566 9.41707 10.0791 9.41707C8.60379 9.41707 7.17003 9.6823 5.98144 10.2322M8.05167 2.30256L0 16.6326H2.45848L3.46243 14.7777C4.63023 12.6376 6.6381 11.4757 10.0797 11.4757C13.5214 11.4757 15.6729 12.6376 16.8407 14.7984L17.8239 16.6332H20.3643L11.8009 1.42655C11.3912 0.692898 10.8177 0.386904 9.87491 0.386904H2.97085L4.02493 1.45879C4.66691 2.09755 5.1707 2.30256 6.0652 2.30256H8.05167Z" /></svg>,
  wpp: <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>,
  gcal: <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-current" aria-hidden><path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" /></svg>,
  apple: <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-current" aria-hidden><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></svg>,
};

const SECOES = [['conta', 'Conta'], ['seguranca', 'Segurança'], ['notificacoes', 'Notificações'], ['cobranca', 'Cobrança'], ['integracoes', 'Integrações'], ['perigo', 'Zona de perigo']] as const;

type Sheet = null | 'nome' | 'email' | 'senha' | 'mfa' | 'excluir' | 'asaas' | 'regras' | 'google' | 'atalho' | 'whatsapp';

export default function MeuPerfil() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, avatarSignedUrl, loading, updateNome, updatePushEnabled, uploadAvatar } = useProfile();
  const { activeTenant } = useTenant();
  const { theme, setTheme } = useTheme();
  const [secaoAtiva, setSecaoAtiva] = useState<string>('conta');
  const irPara = (id: string) => { setSecaoAtiva(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  // WhatsApp da empresa (só leitura; quem grava é a função whatsapp-conexao).
  const [whatsNumero, setWhatsNumero] = useState<string | null>(null);
  const carregarWhats = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('whatsapp_conexoes').select('numero, estado').maybeSingle();
    const d = String(data?.numero || '').replace(/\D/g, '').replace(/^55/, '');
    setWhatsNumero(data && data.estado === 'open' ? (d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : d) : null);
  }, []);
  useEffect(() => { carregarWhats(); }, [carregarWhats]);

  const [nome, setNome] = useState('');
  const [savingNome, setSavingNome] = useState(false);
  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ===== Cobrança (Asaas) =====
  const [asaasKey, setAsaasKey] = useState('');
  const [asaasEnv, setAsaasEnv] = useState<'production' | 'sandbox'>('production');
  const [asaasConnecting, setAsaasConnecting] = useState(false);
  const [asaasStatus, setAsaasStatus] = useState<{ connected: boolean; accountName: string | null; env: string; webhookToken: string | null } | null>(null);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-cobranca-webhook`;
  const WHATSAPP_TPL_PADRAO = 'Olá {cliente}! 👋\n\nSua cobrança de *{descricao}* {prazo}:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\nLink para pagamento:\n{link}\n\nQualquer dúvida, é só chamar!';
  const WHATSAPP_TPL_PIX_PADRAO = 'Olá {cliente}! 👋\n\nSua cobrança de *{descricao}* {prazo}:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\n🔑 *Chave PIX:* {pix}\n👤 Em nome de: {titular}\n\nApós o pagamento, é só enviar o comprovante. Obrigado!';
  const [whatsappTpl, setWhatsappTpl] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [pixChave, setPixChave] = useState('');
  const [pixTitular, setPixTitular] = useState('');
  const [whatsappTplPix, setWhatsappTplPix] = useState('');
  const [savingPix, setSavingPix] = useState(false);
  // E-mail de cobrança (assunto + corpo). Mesmos placeholders do WhatsApp.
  const EMAIL_ASSUNTO_PADRAO = 'Cobrança: {descricao} — vence {vencimento}';
  const EMAIL_CORPO_PADRAO = 'Segue sua cobrança de {descricao}. Qualquer dúvida, é só responder este e-mail.';
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailCorpo, setEmailCorpo] = useState('');
  const [savingEmailTpl, setSavingEmailTpl] = useState(false);

  const salvarEmailTpl = async () => {
    if (!user) return;
    setSavingEmailTpl(true);
    const { error } = await (supabase as any).from('cobranca_config').update({
      email_assunto: emailAssunto.trim() || null,
      email_corpo: emailCorpo.trim() || null,
    }).eq('user_id', user.id);
    setSavingEmailTpl(false);
    if (error) toast.error('Erro ao salvar e-mail');
    else toast.success('Template de e-mail salvo');
  };

  const salvarPix = async () => {
    if (!user) return;
    setSavingPix(true);
    const { error } = await (supabase as any).from('cobranca_config').update({
      pix_chave: pixChave.trim() || null,
      pix_titular: pixTitular.trim() || null,
      whatsapp_template_pix: whatsappTplPix,
    }).eq('user_id', user.id);
    setSavingPix(false);
    if (error) toast.error('Erro ao salvar PIX');
    else toast.success('Chave PIX e mensagem salvas');
  };

  // Regras globais de envio automático por WhatsApp
  const [autoCfg, setAutoCfg] = useState({ enabled: false, antesDias: 0, noDia: true, atrasoDiario: false, atrasoMax: 0 });
  const [savingAuto, setSavingAuto] = useState(false);

  const loadAsaasStatus = async () => {
    // Status da conexão: só colunas que sempre existem — uma coluna nova ausente
    // (migração ainda não rodada) NÃO pode esconder a conexão do Asaas.
    const { data: base } = await (supabase as any)
      .from('cobranca_config')
      .select('asaas_account_name, asaas_env, webhook_token')
      .maybeSingle();
    if (base) {
      setAsaasStatus({ connected: true, accountName: base.asaas_account_name ?? null, env: base.asaas_env ?? 'production', webhookToken: base.webhook_token ?? null });
    } else {
      setAsaasStatus({ connected: false, accountName: null, env: 'production', webhookToken: null });
    }

    // Extras (template, PIX, regras de auto-envio): tolerante a colunas ausentes.
    setWhatsappTpl(WHATSAPP_TPL_PADRAO);
    setWhatsappTplPix(WHATSAPP_TPL_PIX_PADRAO);
    setEmailAssunto(EMAIL_ASSUNTO_PADRAO);
    setEmailCorpo(EMAIL_CORPO_PADRAO);
    const carregarExtra = async (cols: string, apply: (d: any) => void) => {
      const { data, error } = await (supabase as any).from('cobranca_config').select(cols).maybeSingle();
      if (!error && data) apply(data);
    };
    await carregarExtra('whatsapp_template', (d) => d.whatsapp_template && setWhatsappTpl(d.whatsapp_template));
    await carregarExtra('whatsapp_template_pix, pix_chave, pix_titular', (d) => {
      setPixChave(d.pix_chave || '');
      setPixTitular(d.pix_titular || '');
      setWhatsappTplPix(d.whatsapp_template_pix || WHATSAPP_TPL_PIX_PADRAO);
    });
    await carregarExtra('email_assunto, email_corpo', (d) => {
      if (d.email_assunto) setEmailAssunto(d.email_assunto);
      if (d.email_corpo) setEmailCorpo(d.email_corpo);
    });
    await carregarExtra('auto_wpp_enabled, auto_wpp_antes_dias, auto_wpp_no_dia, auto_wpp_atraso_diario, auto_wpp_atraso_max_dias', (d) => setAutoCfg((p) => ({
      ...p,
      enabled: !!d.auto_wpp_enabled,
      antesDias: d.auto_wpp_antes_dias ?? 0,
      noDia: d.auto_wpp_no_dia ?? true,
      atrasoDiario: !!d.auto_wpp_atraso_diario,
      atrasoMax: d.auto_wpp_atraso_max_dias ?? 0,
    })));
  };

  const salvarAutoCfg = async () => {
    if (!user) return;
    setSavingAuto(true);
    const { error } = await (supabase as any).from('cobranca_config').update({
      auto_wpp_enabled: autoCfg.enabled,
      auto_wpp_antes_dias: Math.max(0, Number(autoCfg.antesDias) || 0),
      auto_wpp_no_dia: autoCfg.noDia,
      auto_wpp_atraso_diario: autoCfg.atrasoDiario,
      auto_wpp_atraso_max_dias: Math.max(0, Number(autoCfg.atrasoMax) || 0),
    }).eq('user_id', user.id);
    setSavingAuto(false);
    if (error) toast.error('Erro ao salvar regras de envio');
    else toast.success('Regras de envio automático salvas');
  };

  const salvarWhatsappTpl = async () => {
    if (!user) return;
    setSavingTpl(true);
    const { error } = await (supabase as any).from('cobranca_config').update({ whatsapp_template: whatsappTpl }).eq('user_id', user.id);
    setSavingTpl(false);
    if (error) toast.error('Erro ao salvar mensagem');
    else toast.success('Mensagem padrão salva');
  };
  useEffect(() => { loadAsaasStatus(); }, []);
  // Google Agenda: status na linha do menu; ?integracao=google abre o painel (volta do Google).
  const [googleEmail, setGoogleEmail] = useState<string | null | undefined>(undefined);
  const carregarGoogle = () => statusGoogle().then((s) => setGoogleEmail(s ? (s.email || 'conectado') : null)).catch(() => setGoogleEmail(null));
  useEffect(() => {
    carregarGoogle();
    if (new URLSearchParams(window.location.search).get('integracao') === 'google') setSheet('google');
  }, []);

  const handleConectarAsaas = async () => {
    if (!asaasKey.trim()) return;
    setAsaasConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-cobranca-conectar', {
        body: { action: 'conectar', apiKey: asaasKey.trim(), env: asaasEnv },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Falha ao conectar');
      toast.success('Asaas conectado!', { description: (data as any)?.accountName ? `Conta: ${(data as any).accountName}` : undefined });
      setAsaasKey('');
      await loadAsaasStatus();
      setSheet(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao conectar');
    } finally {
      setAsaasConnecting(false);
    }
  };

  const handleDesconectarAsaas = async () => {
    setAsaasConnecting(true);
    try {
      await supabase.functions.invoke('asaas-cobranca-conectar', { body: { action: 'desconectar' } });
      toast.success('Asaas desconectado');
      await loadAsaasStatus();
      setSheet(null);
    } finally {
      setAsaasConnecting(false);
    }
  };

  const handleExcluirConta = async () => {
    if (confirmText.trim().toUpperCase() !== 'EXCLUIR') return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/excluir-conta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Falha ao excluir a conta');
      toast.success('Conta excluída', { description: 'Todos os seus dados foram apagados. Até logo.' });
      await signOut();
      navigate('/login', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir a conta');
      setDeleting(false);
    }
  };

  if (!loading && profile && nome === '' && profile.nome) setNome(profile.nome);
  if (user && email === '' && user.email) setEmail(user.email);

  const handleSaveNome = async () => {
    setSavingNome(true);
    const { error } = await updateNome(nome.trim());
    setSavingNome(false);
    if (error) toast.error('Erro ao salvar nome');
    else { toast.success('Nome atualizado'); setSheet(null); }
  };

  const handleAvatarPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Sem bloqueio por tamanho: o uploadAvatar comprime/redimensiona automaticamente
    // (foto de celular ~5–12MB cai pra ~100–400KB). Só evitamos arquivos absurdos.
    if (file.size > 40 * 1024 * 1024) { toast.error('Imagem muito grande (máx. 40 MB).'); return; }
    setUploading(true);
    const { error } = await uploadAvatar(file);
    setUploading(false);
    if (error) toast.error('Erro ao enviar avatar');
    else toast.success('Avatar atualizado');
  };

  const handleSaveEmail = async () => {
    if (!email.trim() || email === user?.email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) toast.error(error.message);
    else { toast.success('Verifique seu novo e-mail para confirmar a alteração'); setSheet(null); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return toast.error('A nova senha precisa de ao menos 6 caracteres');
    if (newPassword !== confirmPassword) return toast.error('As senhas não conferem');
    if (!user?.email) return;
    setSavingPassword(true);
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (reauthErr) { setSavingPassword(false); return toast.error('Senha atual incorreta'); }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast.error(error.message);
    else { toast.success('Senha alterada'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSheet(null); }
  };

  const handleTogglePush = async (enabled: boolean) => {
    if (!user) return;
    setPushSaving(true);
    try {
      if (enabled) {
        const { subscribeForPush } = await import('@/utils/pushSubscription');
        const { error: subErr } = await subscribeForPush(user.id);
        if (subErr) { toast.error(subErr.message); setPushSaving(false); return; }
      } else {
        const { unsubscribeFromPush } = await import('@/utils/pushSubscription');
        await unsubscribeFromPush();
      }
      const { error } = await updatePushEnabled(enabled);
      if (error) toast.error('Erro ao salvar preferência');
      else if (enabled) toast.success('Notificações ativadas. Aviso diário às 8h.');
      else toast.success('Notificações desativadas');
    } finally { setPushSaving(false); }
  };

  const enviarTeste = async () => {
    const { data, error } = await supabase.functions.invoke('notify-test');
    if (error) return toast.error(error.message);
    const res = data as { sent?: number; failed?: number; failures?: Array<{ status?: number; body?: string; host?: string }> };
    const sent = res?.sent ?? 0;
    if (sent > 0) toast.success(`Enviada — verifique seu iPhone (${sent})`);
    else if (res?.failed && res.failures?.length) {
      const f = res.failures[0];
      toast.error(`Falha ${f.status ?? '?'} em ${f.host ?? 'push'}: ${f.body ?? 'sem detalhes'}.`);
    } else toast.error('Nenhuma inscrição ativa. Toque em "Reinstalar push".');
  };

  const reinstalarPush = async () => {
    if (!user) return;
    setPushSaving(true);
    try {
      const { unsubscribeFromPush, subscribeForPush } = await import('@/utils/pushSubscription');
      await unsubscribeFromPush();
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
      const { error: subErr } = await subscribeForPush(user.id);
      if (subErr) toast.error(subErr.message);
      else toast.success('Push reinstalado. Envie o teste novamente.');
    } finally { setPushSaving(false); }
  };

  const initials = (profile?.nome || user?.email || '?').slice(0, 2).toUpperCase();
  const plano = planoLabel(activeTenant);
  const fechar = () => setSheet(null);

  if (loading) return <BalanxLoader fullscreen={false} />;

  return (
    <div className="mx-auto w-full max-w-[1180px] py-4 md:py-6">
      <PageHeader eyebrow="Ajustes" title="Meu perfil" className="mb-5" />

      {/* Você + plano */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[26px] border border-border bg-surface p-5">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label="Trocar foto">
          <Avatar className="h-16 w-16">
            {avatarSignedUrl && <AvatarImage src={avatarSignedUrl} alt={profile?.nome ?? ''} />}
            <AvatarFallback className="bg-foreground text-[20px] font-semibold text-background">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-white ring-2 ring-surface">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </span>
        </button>
        <button type="button" onClick={() => setSheet('nome')} className="min-w-0 flex-1 text-left">
          <p className="truncate font-heading text-[24px] font-light tracking-[-0.02em] text-foreground">{profile?.nome || 'Seu nome'}</p>
          <p className="truncate text-[13px] text-foreground-muted">{user?.email}{activeTenant?.nome ? ` · ${activeTenant.nome}` : ''}</p>
        </button>
        {plano && (
          <div className="flex basis-full items-center gap-3 rounded-2xl bg-surface-2/70 px-4 py-2.5 sm:basis-auto">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              <span className="block text-[13.5px] font-semibold text-foreground">Plano {plano}</span>
              <span className="block text-[12px] text-foreground-muted">{activeTenant?.cortesia || activeTenant?.status_assinatura === 'ativa' ? 'tudo liberado' : 'veja em Assinatura'}</span>
            </span>
          </div>
        )}
        <button type="button" onClick={() => setSheet('nome')} className={cn(btn.outline, 'max-sm:hidden')}>Editar perfil</button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        {/* Navegação das seções (desktop) */}
        <nav className="hidden md:block" aria-label="Seções do perfil">
          <div className="sticky top-6 space-y-0.5">
            {SECOES.map(([id, r]) => (
              <button key={id} type="button" onClick={() => irPara(id)}
                className={cn('block w-full rounded-xl px-3 py-2 text-left text-[14px] transition-colors',
                  secaoAtiva === id ? 'bg-foreground text-background' : id === 'perigo' ? 'text-danger-fg hover:bg-danger-bg' : 'text-foreground-muted hover:bg-surface-2 hover:text-foreground')}>
                {r}
              </button>
            ))}
          </div>
        </nav>

        <div className="max-w-[760px] space-y-6">
          <Grupo id="conta" titulo="Conta">
            <Linha icon={<User className="h-4 w-4" />} titulo="Nome e foto" sub={`${profile?.nome || 'Sem nome'}${activeTenant?.nome ? ` · ${activeTenant.nome}` : ''}`} onClick={() => setSheet('nome')} />
            <Linha icon={<Moon className="h-4 w-4" />} titulo="Aparência" direita={
              <Segmented<'light' | 'dark'> size="sm" value={theme} onChange={setTheme} opts={[['light', 'Claro'], ['dark', 'Escuro']]} />
            } />
          </Grupo>

          <Grupo id="seguranca" titulo="Segurança">
            <Linha icon={<Mail className="h-4 w-4" />} titulo="E-mail de login" sub={user?.email || ''} onClick={() => setSheet('email')} />
            <Linha icon={<Lock className="h-4 w-4" />} titulo="Senha" sub="Atualize sua senha de acesso" onClick={() => setSheet('senha')} />
            <Linha icon={<ShieldCheck className="h-4 w-4" />} titulo="Verificação em duas etapas" sub="Código do app autenticador além da senha" onClick={() => setSheet('mfa')} />
          </Grupo>

          <Grupo id="notificacoes" titulo="Notificações no celular">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground-muted"><BellRing className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] text-foreground">Avisos de vencimento e da IARA</span>
                <span className="block text-[12.5px] text-foreground-muted">Todo dia às 8h, o que vence hoje</span>
              </span>
              <Switch checked={!!profile?.push_enabled} disabled={pushSaving} onCheckedChange={handleTogglePush} aria-label="Notificações no celular" />
            </div>
            {profile?.push_enabled && (
              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                <button type="button" onClick={enviarTeste} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] text-foreground hover:bg-surface-2"><Bell className="h-3.5 w-3.5" />Enviar teste</button>
                <button type="button" onClick={reinstalarPush} disabled={pushSaving} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] text-foreground-muted hover:bg-surface-2 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Reinstalar</button>
              </div>
            )}
          </Grupo>

          <Grupo id="cobranca" titulo="Cobrança">
            <Linha
              icon={<span className="text-[#0038E5]">{LOGO.asaas}</span>}
              titulo="Asaas"
              sub={asaasStatus?.connected
                ? `${asaasStatus.accountName || 'Conta Asaas'} · ${asaasStatus.env === 'sandbox' ? 'Sandbox (teste)' : 'Pix, boleto e cartão'}`
                : 'Conecte sua conta Asaas para cobrar seus clientes'}
              direita={asaasStatus?.connected ? <Ok /> : <Pend txt="Conectar" />}
              onClick={() => setSheet('asaas')}
            />
            <Linha
              icon={<span className="text-[#25D366]">{LOGO.wpp}</span>}
              titulo="WhatsApp da empresa"
              sub={whatsNumero || 'Cobranças e lembretes saem do seu número'}
              direita={whatsNumero ? <Ok /> : <Pend txt="Conectar" />}
              onClick={() => setSheet('whatsapp')}
            />
            {asaasStatus?.connected && (
              <Linha
                icon={<MessageSquareText className="h-4 w-4" />}
                titulo="Lembretes e mensagens"
                sub={autoCfg.enabled
                  ? [autoCfg.antesDias > 0 && `${autoCfg.antesDias} dia${autoCfg.antesDias > 1 ? 's' : ''} antes`, autoCfg.noDia && 'no dia', autoCfg.atrasoDiario && 'todo dia em atraso'].filter(Boolean).join(' · ') || 'Envio automático ligado'
                  : 'Envio automático desligado · mensagens, e-mail e Pix'}
                onClick={() => setSheet('regras')}
              />
            )}
          </Grupo>

          <section id="integracoes" className="scroll-mt-6">
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Integrações</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setSheet('google')} className="flex items-start gap-3 rounded-[22px] border border-border bg-surface p-4 text-left hover:border-border-strong">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[#4285F4]">{LOGO.gcal}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] text-foreground">Google Agenda e Tarefas</span>
                  <span className="block truncate text-[12.5px] text-foreground-muted">{googleEmail || 'Vencimentos, compromissos e tarefas no seu Google'}</span>
                </span>
                {googleEmail ? <Ok /> : googleEmail === null ? <Pend txt="Conectar" /> : null}
              </button>
              <button type="button" onClick={() => setSheet('atalho')} className="flex items-start gap-3 rounded-[22px] border border-border bg-surface p-4 text-left hover:border-border-strong">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground">{LOGO.apple}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] text-foreground">Atalho do iPhone</span>
                  <span className="block truncate text-[12.5px] text-foreground-muted">Toque 2x atrás do celular e fale com a IARA</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground-subtle" />
              </button>
              <div className="flex items-start gap-3 rounded-[22px] border border-dashed border-border p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground-muted"><Smartphone className="h-4 w-4" /></span>
                <span>
                  <span className="block text-[14.5px] text-foreground">Instalar o app</span>
                  <span className="block text-[12.5px] text-foreground-muted">No celular: compartilhar → "Adicionar à Tela de Início"</span>
                </span>
              </div>
            </div>
          </section>

          <Grupo id="perigo" titulo="Zona de perigo">
            <Linha icon={<LogOut className="h-4 w-4" />} titulo="Sair da conta" sub="Neste aparelho" onClick={() => signOut()} />
            <Linha icon={<Trash2 className="h-4 w-4" />} titulo="Excluir minha conta" sub="Apaga seus dados para sempre" onClick={() => { setConfirmText(''); setSheet('excluir'); }} perigo />
          </Grupo>
        </div>
      </div>

      {/* ===== Modais ===== */}
      <Modal open={sheet === 'nome'} onClose={fechar} eyebrow="Conta" title="Seu perfil">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label="Trocar foto">
            <Avatar className="h-20 w-20">
              {avatarSignedUrl && <AvatarImage src={avatarSignedUrl} alt={profile?.nome ?? ''} />}
              <AvatarFallback className="bg-foreground text-[24px] font-semibold text-background">{initials}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-white ring-4 ring-background">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </span>
          </button>
          <span className="text-[12.5px] text-foreground-muted">Toque na foto para trocar. Ajustamos o tamanho para você.</span>
        </div>
        <Campo label="Seu nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" /></Campo>
        <Rodape onCancel={fechar}>
          <button type="button" className={btn.primary} onClick={handleSaveNome} disabled={savingNome || !nome.trim()}>
            {savingNome && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
          </button>
        </Rodape>
      </Modal>

      <Modal open={sheet === 'email'} onClose={fechar} eyebrow="Segurança" title="E-mail de login">
        <Campo label="E-mail" hint="Mandamos um link de confirmação para o novo endereço. Até confirmar, vale o atual.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Rodape onCancel={fechar}>
          <button type="button" className={btn.primary} onClick={handleSaveEmail} disabled={savingEmail || email === user?.email}>
            {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}Enviar confirmação
          </button>
        </Rodape>
      </Modal>

      <Modal open={sheet === 'senha'} onClose={fechar} eyebrow="Segurança" title="Alterar senha">
        <Campo label="Senha atual"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></Campo>
        <Campo label="Nova senha"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></Campo>
        <ForcaSenha senha={newPassword} />
        <Campo label="Repita a nova senha"><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></Campo>
        <Rodape onCancel={fechar}>
          <button type="button" className={btn.primary} onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}Trocar senha
          </button>
        </Rodape>
      </Modal>

      <Modal open={sheet === 'mfa'} onClose={fechar} eyebrow="Segurança" title="Verificação em duas etapas">
        <MfaManager />
      </Modal>

      {/* Asaas: conexão e webhook */}
      <Modal open={sheet === 'asaas'} onClose={fechar} eyebrow="Cobrança" title="Conta Asaas">
        {asaasStatus?.connected ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-success-bg p-3 text-success-fg">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0038E5] text-white">{LOGO.asaas}</span>
              <span>
                <span className="block text-[14px] font-semibold">Conectado{asaasStatus.accountName ? ` · ${asaasStatus.accountName}` : ''}</span>
                <span className="block text-[12px] opacity-90">{asaasStatus.env === 'sandbox' ? 'Sandbox (teste)' : 'Produção'} · o dinheiro cai direto na sua conta</span>
              </span>
            </div>
            <div className="space-y-2.5 rounded-2xl border border-border p-3.5">
              <p className="text-[13.5px] font-medium text-foreground">Baixa automática (webhook)</p>
              <p className="text-[12px] text-foreground-muted">No Asaas → <b className="font-medium">Configurações → Integrações → Webhooks</b>, cadastre esta URL e cole o token no campo de autenticação. Quando o cliente pagar, a receita baixa sozinha.</p>
              <Copiavel label="URL do webhook" valor={webhookUrl} aviso="URL copiada" />
              <Copiavel label="Token (autenticação)" valor={asaasStatus.webhookToken || ''} aviso="Token copiado" />
            </div>
            <button type="button" onClick={() => setSheet('regras')} className="flex w-full items-center gap-3 rounded-2xl border border-border p-3.5 text-left hover:bg-surface-2/50">
              <MessageSquareText className="h-4 w-4 text-foreground-muted" />
              <span className="flex-1 text-[13.5px] text-foreground">Lembretes, mensagens, e-mail e Pix</span>
              <ChevronRight className="h-4 w-4 text-foreground-subtle" />
            </button>
            <button type="button" className={cn(btn.danger, 'px-0')} onClick={handleDesconectarAsaas} disabled={asaasConnecting}>
              {asaasConnecting && <Loader2 className="h-4 w-4 animate-spin" />}Desconectar o Asaas
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-foreground-muted">Cole a chave de API da sua conta Asaas. Ela fica guardada com segurança e é usada só para criar as cobranças dos seus clientes — o dinheiro cai direto na sua conta.</p>
            <Campo label="Ambiente">
              <Segmented<'production' | 'sandbox'> value={asaasEnv} onChange={setAsaasEnv} opts={[['production', 'Produção'], ['sandbox', 'Sandbox (teste)']]} />
            </Campo>
            <Campo label="Chave de API (access token)" hint="Asaas → Configurações → Integrações → API. Comece no Sandbox para testar sem cobrar de verdade.">
              <Input type="password" value={asaasKey} onChange={(e) => setAsaasKey(e.target.value)} placeholder="$aact_..." autoComplete="off" />
            </Campo>
            <Rodape onCancel={fechar}>
              <button type="button" className={btn.primary} onClick={handleConectarAsaas} disabled={asaasConnecting || !asaasKey.trim()}>
                {asaasConnecting && <Loader2 className="h-4 w-4 animate-spin" />}Conectar e testar
              </button>
            </Rodape>
          </>
        )}
      </Modal>

      {/* Lembretes automáticos e mensagens (regra padrão) */}
      <Modal open={sheet === 'regras'} onClose={fechar} eyebrow="Cobrança" title="Lembretes e mensagens" largo>
        <Bloco titulo="Envio automático por WhatsApp" extra={<Switch checked={autoCfg.enabled} onCheckedChange={(v) => setAutoCfg((p) => ({ ...p, enabled: v }))} aria-label="Envio automático" />}>
          <p className="text-[12px] text-foreground-muted">Regra padrão para toda cobrança sem regra própria (cada contrato pode ter exceção).</p>
          {autoCfg.enabled && (
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span><span className="block text-[14px] text-foreground">Dias antes do vencimento</span><span className="block text-[12px] text-foreground-muted">0 = não envia lembrete antecipado</span></span>
                <Input type="number" min="0" value={autoCfg.antesDias} onChange={(e) => setAutoCfg((p) => ({ ...p, antesDias: parseInt(e.target.value) || 0 }))} className="h-9 w-16 text-center" />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[14px] text-foreground">No dia do vencimento</span>
                <Switch checked={autoCfg.noDia} onCheckedChange={(v) => setAutoCfg((p) => ({ ...p, noDia: v }))} />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[14px] text-foreground">Todo dia em atraso</span>
                <Switch checked={autoCfg.atrasoDiario} onCheckedChange={(v) => setAutoCfg((p) => ({ ...p, atrasoDiario: v }))} />
              </div>
              {autoCfg.atrasoDiario && (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span><span className="block text-[14px] text-foreground">Parar depois de N dias de atraso</span><span className="block text-[12px] text-foreground-muted">0 = não para</span></span>
                  <Input type="number" min="0" value={autoCfg.atrasoMax} onChange={(e) => setAutoCfg((p) => ({ ...p, atrasoMax: parseInt(e.target.value) || 0 }))} className="h-9 w-16 text-center" />
                </div>
              )}
            </div>
          )}
          <p className="mt-2 text-[11.5px] text-foreground-subtle">O disparo roda 1x por dia, de manhã. Cobranças que exigem nota fiscal só saem com o PDF anexado.</p>
          <SalvarBtn onClick={salvarAutoCfg} saving={savingAuto}>Salvar regras</SalvarBtn>
        </Bloco>

        <Bloco titulo="Mensagem padrão do WhatsApp">
          <Placeholders extra={['{prazo}', '{dias}']} itens={['{cliente}', '{descricao}', '{valor}', '{vencimento}', '{link}']} />
          <Textarea value={whatsappTpl} onChange={(e) => setWhatsappTpl(e.target.value)} rows={8} className="mt-2 font-mono text-[12px] leading-relaxed" />
          <p className="mt-1 text-[11.5px] text-foreground-subtle">Aceita *negrito*, _itálico_ e quebra de linha. {'{prazo}'} vira "vence em 7 dias", "vence hoje" ou "está vencida há 5 dias".</p>
          <SalvarBtn onClick={salvarWhatsappTpl} saving={savingTpl}>Salvar mensagem</SalvarBtn>
        </Bloco>

        <Bloco titulo="E-mail de cobrança">
          <p className="text-[12px] text-foreground-muted">O layout (botão de pagamento, valor, vencimento, Pix e NF em anexo) já vem pronto. Aqui você define o assunto e a abertura.</p>
          <Placeholders itens={['{cliente}', '{descricao}', '{valor}', '{vencimento}', '{link}', '{pix}', '{titular}']} extra={['{prazo}', '{dias}']} />
          <div className="mt-2 space-y-3">
            <Campo label="Assunto"><Input value={emailAssunto} onChange={(e) => setEmailAssunto(e.target.value)} placeholder={EMAIL_ASSUNTO_PADRAO} /></Campo>
            <Campo label="Mensagem de abertura"><Textarea value={emailCorpo} onChange={(e) => setEmailCorpo(e.target.value)} rows={4} className="text-[13px] leading-relaxed" /></Campo>
          </div>
          <SalvarBtn onClick={salvarEmailTpl} saving={savingEmailTpl}>Salvar e-mail</SalvarBtn>
        </Bloco>

        <Bloco titulo="Recebimento por Pix (chave própria)">
          <p className="text-[12px] text-foreground-muted">Usada nas cobranças marcadas como "enviar chave Pix". O cliente paga na sua chave (fora do Asaas) e você dá baixa com "Identificar pagamento manual".</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Chave Pix"><Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="e-mail, telefone, CNPJ ou aleatória" /></Campo>
            <Campo label="Em nome de (titular)"><Input value={pixTitular} onChange={(e) => setPixTitular(e.target.value)} placeholder="Nome / empresa" /></Campo>
          </div>
          <p className="mb-1 mt-3 text-[12.5px] text-foreground-muted">Mensagem Pix no WhatsApp</p>
          <Placeholders itens={['{cliente}', '{descricao}', '{valor}', '{vencimento}', '{pix}', '{titular}']} extra={['{prazo}', '{dias}']} />
          <Textarea value={whatsappTplPix} onChange={(e) => setWhatsappTplPix(e.target.value)} rows={8} className="mt-2 font-mono text-[12px] leading-relaxed" />
          <SalvarBtn onClick={salvarPix} saving={savingPix}>Salvar Pix</SalvarBtn>
        </Bloco>
      </Modal>

      <Modal open={sheet === 'whatsapp'} onClose={fechar} eyebrow="Cobrança" title="WhatsApp da empresa">
        <WhatsAppPainel onChange={carregarWhats} />
      </Modal>

      <Modal open={sheet === 'google'} onClose={fechar} eyebrow="Integrações" title="Google Agenda e Tarefas">
        <GoogleAgendaPainel onChange={carregarGoogle} />
      </Modal>

      <Modal open={sheet === 'atalho'} onClose={fechar} eyebrow="Integrações" title="Atalho do iPhone">
        <AtalhoIphonePainel />
      </Modal>

      {/* Excluir conta (LGPD) */}
      <Modal open={sheet === 'excluir'} onClose={() => { if (!deleting) fechar(); }} eyebrow="Zona de perigo" title="Excluir minha conta">
        <div className="rounded-2xl bg-danger-bg p-4 text-danger-fg">
          <p className="flex items-center gap-2 text-[14px] font-semibold"><AlertTriangle className="h-4 w-4" />Isso não tem volta</p>
          <p className="mt-1 text-[12.5px] leading-relaxed">Apaga <b>permanentemente</b> a sua conta e <b>todos os dados</b>: lançamentos, contas, contratos, clientes, categorias, cartões, metas e o seu login. Se houver assinatura ativa, ela é cancelada.</p>
        </div>
        <Campo label={<>Para confirmar, digite <b className="font-semibold text-foreground">EXCLUIR</b></>}>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" autoCapitalize="characters" autoComplete="off" />
        </Campo>
        <Rodape onCancel={fechar} cancelDisabled={deleting}>
          <button type="button" onClick={handleExcluirConta} disabled={deleting || confirmText.trim().toUpperCase() !== 'EXCLUIR'}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-danger-fg px-5 text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-40">
            {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Excluindo tudo…</> : 'Excluir para sempre'}
          </button>
        </Rodape>
      </Modal>
    </div>
  );
}

type TenantInfo = ReturnType<typeof useTenant>['activeTenant'];

/** Rótulo curto do plano do workspace (mesma regra do menu lateral). */
function planoLabel(t: TenantInfo): string {
  if (!t) return '';
  if (t.cortesia) return 'Cortesia';
  if (t.status_assinatura === 'ativa') return 'ativo';
  if (t.status_assinatura === 'trial') return 'em teste';
  if (t.status_assinatura === 'inadimplente') return 'com pagamento pendente';
  return t.status_assinatura || '';
}

/* ===== Peças do perfil ===== */
function Grupo({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">{titulo}</p>
      <div className="overflow-hidden rounded-[22px] border border-border bg-surface">{children}</div>
    </section>
  );
}

function Linha({ icon, titulo, sub, direita, onClick, perigo }: { icon: ReactNode; titulo: string; sub?: ReactNode; direita?: ReactNode; onClick?: () => void; perigo?: boolean }) {
  const conteudo = (
    <>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', perigo ? 'bg-danger-bg text-danger-fg' : 'bg-surface-2 text-foreground-muted')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[14.5px]', perigo ? 'text-danger-fg' : 'text-foreground')}>{titulo}</span>
        {sub && <span className="block truncate text-[12.5px] text-foreground-muted">{sub}</span>}
      </span>
      {direita}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-foreground-subtle" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left first:border-t-0';
  return onClick
    ? <button type="button" onClick={onClick} className={cn(cls, 'hover:bg-surface-2/50')}>{conteudo}</button>
    : <div className={cls}>{conteudo}</div>;
}

const Ok = ({ txt = 'Conectado' }: { txt?: string }) => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11.5px] text-success-fg"><Check className="h-3 w-3" />{txt}</span>
);
const Pend = ({ txt }: { txt: string }) => <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[11.5px] text-warning-fg">{txt}</span>;

/** Modal do perfil: centralizado no desktop, de baixo no celular. */
function Modal({ open, onClose, eyebrow, title, children, largo }: { open: boolean; onClose: () => void; eyebrow: string; title: string; children: ReactNode; largo?: boolean }) {
  return (
    <SheetUI open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls(largo ? 'sm:max-w-[680px]' : 'sm:max-w-[560px]')}>
        <ModalShell>
          <ModalHeader eyebrow={eyebrow} title={title} onClose={onClose} />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pb-safe">{children}</div>
        </ModalShell>
      </SheetContent>
    </SheetUI>
  );
}

function Rodape({ onCancel, children, cancelDisabled }: { onCancel: () => void; children: ReactNode; cancelDisabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} disabled={cancelDisabled} className={btn.outline}>Cancelar</button>
      {children}
    </div>
  );
}

function Bloco({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3"><p className="text-[14px] font-medium text-foreground">{titulo}</p>{extra}</div>
      {children}
    </section>
  );
}

function SalvarBtn({ onClick, saving, children }: { onClick: () => void; saving: boolean; children: ReactNode }) {
  return (
    <div className="mt-3 flex justify-end">
      <button type="button" onClick={onClick} disabled={saving} className={cn(btn.primary, 'h-9 px-4')}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}{children}
      </button>
    </div>
  );
}

function Placeholders({ itens, extra = [] }: { itens: string[]; extra?: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {[...itens, ...extra].map((p) => <code key={p} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-foreground-muted">{p}</code>)}
    </div>
  );
}

function Copiavel({ label, valor, aviso }: { label: string; valor: string; aviso: string }) {
  return (
    <Campo label={label}>
      <div className="flex gap-2">
        <Input readOnly value={valor || '—'} className="text-[12px]" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={cn(btn.outline, 'h-10 shrink-0 px-3')} onClick={() => { navigator.clipboard?.writeText(valor); toast.success(aviso); }}>
          <Copy className="h-3.5 w-3.5" />Copiar
        </button>
      </div>
    </Campo>
  );
}

function ForcaSenha({ senha }: { senha: string }) {
  const forca = Math.min(4, [/.{8,}/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length);
  return (
    <div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < forca ? (forca < 2 ? 'bg-danger-fg' : forca < 4 ? 'bg-warning-fg' : 'bg-success-fg') : 'bg-surface-2')} />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-foreground-muted">{['Use 8+ caracteres, maiúscula, número e símbolo', 'Fraca', 'Razoável', 'Boa', 'Forte'][forca]}</p>
    </div>
  );
}
