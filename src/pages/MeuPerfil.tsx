import { useState, useRef, ChangeEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Upload, LogOut, Bell, User as UserIcon, Mail, Lock } from 'lucide-react';

export default function MeuPerfil() {
  const { user, signOut } = useAuth();
  const { profile, avatarSignedUrl, loading, updateNome, updatePushEnabled, uploadAvatar } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Initialize editable fields once profile/user are loaded
  if (!loading && profile && nome === '' && profile.nome) setNome(profile.nome);
  if (user && email === '' && user.email) setEmail(user.email);

  const handleSaveNome = async () => {
    setSavingNome(true);
    const { error } = await updateNome(nome.trim());
    setSavingNome(false);
    if (error) toast.error('Erro ao salvar nome');
    else toast.success('Nome atualizado');
  };

  const handleAvatarPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5 MB');
      return;
    }
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
    else toast.success('Verifique seu novo e-mail para confirmar a alteração');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return toast.error('A nova senha precisa de ao menos 6 caracteres');
    if (newPassword !== confirmPassword) return toast.error('As senhas não conferem');
    if (!user?.email) return;

    setSavingPassword(true);
    // Reauthenticate to verify the current password
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthErr) {
      setSavingPassword(false);
      return toast.error('Senha atual incorreta');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Senha alterada');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
  };

  const handleTogglePush = async (enabled: boolean) => {
    if (!user) return;
    setPushSaving(true);
    try {
      if (enabled) {
        const { subscribeForPush } = await import('@/utils/pushSubscription');
        const { error: subErr } = await subscribeForPush(user.id);
        if (subErr) {
          toast.error(subErr.message);
          setPushSaving(false);
          return;
        }
      } else {
        const { unsubscribeFromPush } = await import('@/utils/pushSubscription');
        await unsubscribeFromPush();
      }
      const { error } = await updatePushEnabled(enabled);
      if (error) toast.error('Erro ao salvar preferência');
      else if (enabled) toast.success('Notificações ativadas. Você receberá um aviso diário às 8h sobre despesas que vencem hoje.');
      else toast.success('Notificações desativadas');
    } finally {
      setPushSaving(false);
    }
  };

  const initials = (profile?.nome || user?.email || '?').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais e preferências.</p>
      </div>

      {/* Identidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserIcon className="h-4 w-4" /> Identidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatarSignedUrl && <AvatarImage src={avatarSignedUrl} alt={profile?.nome ?? ''} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Trocar avatar
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PNG ou JPG, até 5 MB.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <div className="flex gap-2">
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              <Button onClick={handleSaveNome} disabled={savingNome || !nome.trim()}>
                {savingNome && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* E-mail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" /> E-mail de login</CardTitle>
          <CardDescription>Trocar o e-mail dispara uma verificação para o novo endereço.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="flex gap-2">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={handleSaveEmail} disabled={savingEmail || email === user?.email}>
              {savingEmail && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Alterar senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cur">Senha atual</Label>
            <Input id="cur" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new">Nova senha</Label>
              <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf">Confirmar nova senha</Label>
              <Input id="conf" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Alterar senha
          </Button>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Notificações</CardTitle>
          <CardDescription>
            Receba um aviso diário no iPhone com as despesas pendentes que vencem hoje.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Avisos de vencimento</p>
              <p className="text-xs text-muted-foreground">
                Para receber no iPhone, primeiro adicione o balanx à tela inicial pelo Safari (ícone Compartilhar → Adicionar à Tela de Início).
              </p>
            </div>
            <Switch
              checked={!!profile?.push_enabled}
              disabled={pushSaving}
              onCheckedChange={handleTogglePush}
            />
          </div>
          {profile?.push_enabled && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { data, error } = await supabase.functions.invoke('notify-test');
                  if (error) return toast.error(error.message);
                  const res = data as { sent?: number; failed?: number; failures?: Array<{ status?: number; body?: string; host?: string }> };
                  const sent = res?.sent ?? 0;
                  if (sent > 0) {
                    toast.success(`Enviada — verifique seu iPhone (${sent})`);
                  } else if (res?.failed && res.failures?.length) {
                    const f = res.failures[0];
                    toast.error(`Falha ${f.status ?? '?'} em ${f.host ?? 'push'}: ${f.body ?? 'sem detalhes'}. Toque em "Reinstalar push".`);
                  } else {
                    toast.error('Nenhuma inscrição ativa. Toque em "Reinstalar push".');
                  }
                }}
              >
                Enviar notificação de teste
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!user) return;
                  setPushSaving(true);
                  try {
                    const { unsubscribeFromPush, subscribeForPush } = await import('@/utils/pushSubscription');
                    await unsubscribeFromPush();
                    // Remove any leftover server-side rows (from old VAPID keypair)
                    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
                    const { error: subErr } = await subscribeForPush(user.id);
                    if (subErr) toast.error(subErr.message);
                    else toast.success('Push reinstalado. Envie o teste novamente.');
                  } finally {
                    setPushSaving(false);
                  }
                }}
                disabled={pushSaving}
              >
                Reinstalar push
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" /> Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
