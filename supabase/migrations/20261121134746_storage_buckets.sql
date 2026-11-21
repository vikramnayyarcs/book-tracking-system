insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio', 'audio', false, 26214400, array['audio/*']),
  ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy app_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('audio', 'photos')
    and (storage.foldername(name))[1] = app.current_user_id()
  );

create policy app_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('audio', 'photos')
    and (storage.foldername(name))[1] = app.current_user_id()
  );

create policy app_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('audio', 'photos')
    and (storage.foldername(name))[1] = app.current_user_id()
  )
  with check (
    bucket_id in ('audio', 'photos')
    and (storage.foldername(name))[1] = app.current_user_id()
  );

create policy app_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('audio', 'photos')
    and (storage.foldername(name))[1] = app.current_user_id()
  );
