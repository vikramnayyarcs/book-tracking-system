begin;
select plan(15);

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

insert into app.users (id) values ('alice'), ('bob');
insert into app.books (id, user_id, title) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice''s invented book'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'Bob''s invented book');
insert into app.sessions (id, user_id, book_id, date) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice', '00000000-0000-0000-0000-00000000000a', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob', '00000000-0000-0000-0000-00000000000b', '2026-01-02');
insert into app.insights (id, user_id, book_id, session_id, text, source) values
  ('00000000-0000-0000-0000-000000000a01', 'alice', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'Alice invented insight', 'ai'),
  ('00000000-0000-0000-0000-000000000b01', 'bob', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'Bob invented insight', 'ai');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select text from app.insights order by text',
  array['Alice invented insight'],
  'alice sees only her own insights'
);

select is(
  pg_temp.affected($$update app.insights set text = 'Hijacked' where user_id = 'bob'$$),
  0::bigint,
  'alice cannot update bob''s insight'
);

select is(
  pg_temp.affected($$delete from app.insights where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s insight'
);

select throws_ok(
  $$insert into app.insights (user_id, book_id, text) values ('bob', '00000000-0000-0000-0000-00000000000b', 'Planted')$$,
  '42501',
  null,
  'alice cannot insert an insight for bob'
);

select throws_ok(
  $$insert into app.insights (book_id, text) values ('00000000-0000-0000-0000-00000000000b', 'Planted on bob''s book')$$,
  '23503',
  null,
  'alice cannot attach an insight to bob''s book'
);

select throws_ok(
  $$insert into app.insights (book_id, session_id, text) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b1', 'Wrong session')$$,
  '23503',
  null,
  'alice cannot attach an insight to bob''s session'
);

select lives_ok(
  $$insert into app.insights (id, book_id, session_id, text, kind, page)
    values ('00000000-0000-0000-0000-000000000a92', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A quote', 'quote', 42)$$,
  'alice can add her own quote with her own id'
);

select throws_ok(
  $$update app.insights set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her insight to bob'
);

select throws_ok(
  $$update app.insights set original_text = 'Rewritten history' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot rewrite the original AI text'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select text from app.insights order by text',
  array['Bob invented insight'],
  'bob sees only his own insights'
);

select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);
select is(
  pg_temp.affected($$delete from app.sessions where id = '00000000-0000-0000-0000-0000000000a1'$$),
  1::bigint,
  'alice can delete her session'
);

reset role;
select is(
  (select count(*) from app.insights where user_id = 'alice' and session_id is null),
  2::bigint,
  'her insights outlive the session but lose the link'
);

insert into app.insights (id, user_id, book_id, text, source) values
  ('00000000-0000-0000-0000-0000000000f2', 'alice', '00000000-0000-0000-0000-00000000000a', 'Invented AI wording', 'ai'),
  ('00000000-0000-0000-0000-0000000000f3', 'alice', '00000000-0000-0000-0000-00000000000a', 'Invented own wording', 'user');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);
update app.insights set text = 'Edited once' where id = '00000000-0000-0000-0000-0000000000f2';
update app.insights set text = 'Edited twice' where id = '00000000-0000-0000-0000-0000000000f2';
update app.insights set text = 'Edited own' where id = '00000000-0000-0000-0000-0000000000f3';
update app.insights set pinned = true where id = '00000000-0000-0000-0000-0000000000f2';
select is(
  (select original_text from app.insights where id = '00000000-0000-0000-0000-0000000000f2'),
  'Invented AI wording',
  'editing an AI insight keeps the first wording, even after two edits'
);
select is(
  (select original_text from app.insights where id = '00000000-0000-0000-0000-0000000000f3'),
  null,
  'editing a user insight sets no original text'
);
select is(
  (select pinned from app.insights where id = '00000000-0000-0000-0000-0000000000f2'),
  true,
  'pinning does not touch the original text'
);
reset role;

select * from finish();
rollback;
