begin;
select plan(6);

insert into app.users (id) values ('alice'), ('bob');
insert into app.books (id, user_id, title) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice''s invented book'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'Bob''s invented book');
insert into app.insights (id, user_id, book_id, text, embedding) values
  ('00000000-0000-0000-0000-0000000000a9', 'alice', '00000000-0000-0000-0000-00000000000a', 'Alice invented insight', array_fill(0.1::real, array[384])::extensions.vector),
  ('00000000-0000-0000-0000-0000000000b9', 'bob', '00000000-0000-0000-0000-00000000000b', 'Bob invented insight', array_fill(0.2::real, array[384])::extensions.vector);

select has_index('app', 'insights', 'insights_embedding_pending_idx', 'insights without an embedding have a backlog index');

select is(
  (select count(*)::int from cron.job where jobname = 'api-job-embed-backfill' and schedule = '*/15 * * * *'),
  1,
  'the embed-backfill job runs every 15 minutes'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

update app.insights set pinned = true where id = '00000000-0000-0000-0000-0000000000a9';
select isnt(
  (select embedding from app.insights where id = '00000000-0000-0000-0000-0000000000a9'),
  null,
  'pinning keeps the embedding'
);

update app.insights set text = 'Alice edited invented insight' where id = '00000000-0000-0000-0000-0000000000a9';
select is(
  (select embedding from app.insights where id = '00000000-0000-0000-0000-0000000000a9'),
  null,
  'editing the text clears the embedding so it is embedded again'
);

select is(
  (select count(*)::int from app.insights where embedding is null),
  1,
  'alice sees only her own insight in the backlog'
);

reset role;
select isnt(
  (select embedding from app.insights where id = '00000000-0000-0000-0000-0000000000b9'),
  null,
  'bob''s embedding is untouched by alice''s edit'
);

select * from finish();
rollback;
