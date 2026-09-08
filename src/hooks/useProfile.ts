import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
  push_enabled: boolean;
}

/**
 * Manages the current user's profile row.
 * Profile rows are auto-created on signup by a DB trigger; this hook reads
 * and updates the row, and resolves a usable avatar URL (signed for private bucket).
 */
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, nome, avatar_url, push_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
      if (data.avatar_url) {
        const { data: signed } = await supabase.storage
          .from('avatars')
          .createSignedUrl(data.avatar_url, 60 * 60);
        setAvatarSignedUrl(signed?.signedUrl ?? null);
      } else {
        setAvatarSignedUrl(null);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const updateNome = async (nome: string) => {
    if (!user) return { error: new Error('not authenticated') };
    const { error } = await supabase
      .from('profiles')
      .update({ nome })
      .eq('user_id', user.id);
    if (!error) setProfile((p) => p ? { ...p, nome } : p);
    return { error };
  };

  const updatePushEnabled = async (push_enabled: boolean) => {
    if (!user) return { error: new Error('not authenticated') };
    const { error } = await supabase
      .from('profiles')
      .update({ push_enabled })
      .eq('user_id', user.id);
    if (!error) setProfile((p) => p ? { ...p, push_enabled } : p);
    return { error };
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return { error: new Error('not authenticated') };
    const ext = file.name.split('.').pop() || 'png';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) return { error: upErr };
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ avatar_url: path })
      .eq('user_id', user.id);
    if (updErr) return { error: updErr };
    await load();
    return { error: null };
  };

  return { profile, avatarSignedUrl, loading, reload: load, updateNome, updatePushEnabled, uploadAvatar };
}
