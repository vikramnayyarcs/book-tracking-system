begin;
select plan(13);

create function pg_temp.affected(statement text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end
$$;

select is(
  (select file_size_limit from storage.buckets where id = 'audio'),
  26214400::bigint,
  'the audio bucket is limited to 25 MB'
);

select is(
  (select file_size_limit from storage.buckets where id = 'photos'),
  10485760::bigint,
  'the photos bucket is limited to 10 MB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'audio'),
  array['audio/*'],
  'the audio bucket takes audio only'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'photos'),
  array['image/jpeg', 'image/png', 'image/webp'],
  'the photos bucket takes JPEG, PNG and WebP only'
);

select is(
  (select count(*) from storage.buckets where id in ('audio', 'photos') and public),
  0::bigint,
  'both buckets are private'
);

insert into storage.objects (bucket_id, name, owner_id)
values
  ('audio', 'alice/voice-note.m4a', 'alice'),
  ('audio', 'bob/voice-note.m4a', 'bob'),
  ('photos', 'bob/finish-photo.jpg', 'bob');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select name from storage.objects order by name',
  array['alice/voice-note.m4a'],
  'alice sees only objects under her own folder'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'alice/page.png', 'alice')$$,
  'alice can add an object under her own folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'bob/planted.png', 'alice')$$,
  '42501',
  null,
  'alice cannot add an object under bob''s folder'
);

select is(
  pg_temp.affected($$update storage.objects set name = 'alice/hijack.m4a' where name = 'bob/voice-note.m4a'$$),
  0::bigint,
  'alice cannot rename bob''s object'
);

set local storage.allow_delete_query = 'true';

select is(
  pg_temp.affected($$delete from storage.objects where name like 'bob/%'$$),
  0::bigint,
  'alice cannot delete bob''s objects'
);

select throws_ok(
  $$update storage.objects set name = 'bob/stolen.m4a' where name = 'alice/voice-note.m4a'$$,
  '42501',
  null,
  'alice cannot move her object into bob''s folder'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select name from storage.objects order by name',
  array['bob/finish-photo.jpg', 'bob/voice-note.m4a'],
  'bob sees only his own objects'
);

reset role;
set local role anon;
select is(
  (select count(*) from storage.objects),
  0::bigint,
  'anon sees no objects'
);

select * from finish();
rollback;
