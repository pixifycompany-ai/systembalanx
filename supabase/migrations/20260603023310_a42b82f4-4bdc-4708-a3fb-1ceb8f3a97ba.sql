
-- PROFILES
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  nome text,
  avatar_url text,
  push_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.profiles (user_id, nome)
SELECT id, COALESCE(raw_user_meta_data->>'nome', raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- PUSH SUBSCRIPTIONS
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  platform text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subs" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own subs" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own subs" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own subs" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
