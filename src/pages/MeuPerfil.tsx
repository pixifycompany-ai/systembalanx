import { useState, useRef, ChangeEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DetailSheet } from '@/components/shared/DetailSheet';
import { BalanxLoader } from '@/components/shared/BalanxLoader';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  EnvelopeIcon, LockClosedIcon, BellAlertIcon, PaperAirplaneIcon,
  ChevronRightIcon, ArrowRightOnRectangleIcon, CameraIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

type Sheet = null | 'nome' | 'email' | 'senha' | 'excluir';

export default function MeuPerfil() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, avatarSignedUrl, loading, updateNome, updatePushEnabled, uploadAvatar } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

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

  if (loading) return <BalanxLoader fullscreen={false} />;

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-5">
        <p className="text-xs text-foreground-muted mb-0.5 font-medium">Conta</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Meu Perfil</h1>
      </div>

      {/* Avatar + nome */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
      <div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl p-4 mb-4">
        <button onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label="Trocar avatar">
          <Avatar className="h-14 w-14">
            {avatarSignedUrl && <AvatarImage src={avatarSignedUrl} alt={profile?.nome ?? ''} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CameraIcon className="h-3 w-3" />}
          </span>
        </button>
        <button onClick={() => setSheet('nome')} className="flex-1 min-w-0 text-left">
          <div className="text-[15px] font-semibold text-foreground truncate">{profile?.nome || 'Seu nome'}</div>
          <div className="text-[11.5px] text-foreground-muted mt-0.5">Trocar avatar · ajustamos o tamanho pra você</div>
        </button>
        <ChevronRightIcon className="h-4 w-4 text-foreground-muted/60 shrink-0" onClick={() => setSheet('nome')} />
      </div>

      {/* Grupo: acesso */}
      <SetGroup>
        <SetRow icon={<EnvelopeIcon className="h-[18px] w-[18px]" />} title="E-mail de login" sub={user?.email || ''} onClick={() => setSheet('email')} chevron />
        <SetRow icon={<LockClosedIcon className="h-[18px] w-[18px]" />} title="Alterar senha" sub="Atualize sua senha de acesso" onClick={() => setSheet('senha')} chevron />
      </SetGroup>

      {/* Grupo: notificações */}
      <SetGroup>
        <SetRow
          icon={<BellAlertIcon className="h-[18px] w-[18px]" />}
          title="Avisos de vencimento"
          sub="Push diário às 8h no iPhone"
          right={<Switch checked={!!profile?.push_enabled} disabled={pushSaving} onCheckedChange={handleTogglePush} />}
        />
        {profile?.push_enabled && (
          <>
            <SetRow icon={<PaperAirplaneIcon className="h-[18px] w-[18px]" />} title="Enviar notificação de teste" onClick={enviarTeste} chevron />
            <SetRow icon={<ArrowPathIcon className="h-[18px] w-[18px]" />} title="Reinstalar push" onClick={reinstalarPush} chevron />
          </>
        )}
      </SetGroup>

      {/* Sair */}
      <button
        onClick={() => signOut()}
        className="mt-2 w-full h-[46px] rounded-2xl border border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))] font-semibold text-sm inline-flex items-center justify-center gap-2"
      >
        <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sair da conta
      </button>

      {/* Zona de perigo — excluir conta */}
      <button
        onClick={() => { setConfirmText(''); setSheet('excluir'); }}
        className="mt-4 mb-2 w-full text-center text-[12.5px] font-medium text-foreground-muted underline underline-offset-2 hover:text-[hsl(var(--danger))] transition-colors"
      >
        Excluir minha conta
      </button>

      {/* Sheet: nome */}
      <DetailSheet open={sheet === 'nome'} onOpenChange={(o) => !o && setSheet(null)} eyebrow="Identidade" title="Seu nome">
        <div className="space-y-3 pb-2">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
          <Button className="w-full" onClick={handleSaveNome} disabled={savingNome || !nome.trim()}>
            {savingNome && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
          </Button>
        </div>
      </DetailSheet>

      {/* Sheet: email */}
      <DetailSheet open={sheet === 'email'} onOpenChange={(o) => !o && setSheet(null)} eyebrow="Acesso" title="E-mail de login">
        <div className="space-y-3 pb-2">
          <p className="text-xs text-foreground-muted">Trocar o e-mail dispara uma verificação para o novo endereço.</p>
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="w-full" onClick={handleSaveEmail} disabled={savingEmail || email === user?.email}>
            {savingEmail && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Atualizar e-mail
          </Button>
        </div>
      </DetailSheet>

      {/* Sheet: senha */}
      <DetailSheet open={sheet === 'senha'} onOpenChange={(o) => !o && setSheet(null)} eyebrow="Acesso" title="Alterar senha">
        <div className="space-y-3 pb-2">
          <div className="space-y-1.5">
            <Label>Senha atual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <Button className="w-full" onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Alterar senha
          </Button>
        </div>
      </DetailSheet>

      {/* Sheet: excluir conta (LGPD) */}
      <DetailSheet open={sheet === 'excluir'} onOpenChange={(o) => { if (!o && !deleting) setSheet(null); }} eyebrow="Zona de perigo" title="Excluir minha conta">
        <div className="space-y-4 pb-2">
          <div className="rounded-xl border border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/10 p-3.5 text-[13px] leading-relaxed text-foreground">
            Isso apaga <b>permanentemente</b> a sua conta e <b>todos os dados</b>: lançamentos, contas, contratos, clientes, categorias, cartões, metas e o seu login. Se houver assinatura ativa, ela é cancelada. <b>Não dá pra desfazer.</b>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Para confirmar, digite <b>EXCLUIR</b></Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" autoCapitalize="characters" autoComplete="off" />
          </div>
          <Button
            onClick={handleExcluirConta}
            disabled={deleting || confirmText.trim().toUpperCase() !== 'EXCLUIR'}
            className="w-full h-12 rounded-2xl font-semibold bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger))]/90 disabled:opacity-50"
          >
            {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Excluindo tudo…</> : 'Excluir minha conta para sempre'}
          </Button>
        </div>
      </DetailSheet>
    </div>
  );
}

function SetGroup({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3.5 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl">
      {children}
    </div>
  );
}

function SetRow({ icon, title, sub, right, chevron, onClick }: {
  icon: ReactNode; title: string; sub?: string; right?: ReactNode; chevron?: boolean; onClick?: () => void;
}) {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn('flex items-center gap-3 w-full px-4 py-3.5 text-left border-b border-border/50 last:border-b-0', onClick && 'hover:bg-white/5 transition-colors')}
    >
      <span className="text-foreground-muted shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{title}</div>
        {sub && <div className="text-[11.5px] text-foreground-muted truncate">{sub}</div>}
      </div>
      {right}
      {chevron && <ChevronRightIcon className="h-4 w-4 text-foreground-muted/60 shrink-0" />}
    </Comp>
  );
}
