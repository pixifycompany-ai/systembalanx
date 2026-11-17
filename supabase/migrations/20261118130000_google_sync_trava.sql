-- Uma sincronização com o Google por vez para cada usuário (a do retorno do login,
-- a do botão e a do cron rodando juntas duplicavam eventos).
alter table public.google_integracoes add column if not exists sincronizando_ate timestamptz;
