-- O bucket das fotos de perfil nunca foi criado neste projeto (as policies já existem
-- desde 20260603023343, mas sem o bucket todo upload falhava). Privado: o app usa URL assinada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
