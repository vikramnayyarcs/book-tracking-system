begin;
select plan(10);

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
insert into app.sessions (id, user_id, book_id, date, note_text) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice', '00000000-0000-0000-0000-00000000000a', '2026-01-01', 'Alice invented note'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob', '00000000-0000-0000-0000-00000000000b', '2026-01-02', 'Bob invented note');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select note_text from app.sessions order by note_text',
  array['Alice invented note'],
  'alice sees only her own sessions'
);

select is(
  pg_temp.affected($$update app.sessions set note_text = 'Hijacked' where user_id = 'bob'$$),
  0::bigint,
  'alice cannot update bob''s session'
);

select is(
  pg_temp.affected($$delete from app.sessions where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s session'
);

select throws_ok(
  $$insert into app.sessions (user_id, book_id, date) values ('bob', '00000000-0000-0000-0000-00000000000b', '2026-01-03')$$,
  '42501',
  null,
  'alice cannot insert a session for bob'
);

select throws_ok(
  $$insert into app.sessions (book_id, date) values ('00000000-0000-0000-0000-00000000000b', '2026-01-03')$$,
  '23503',
  null,
  'alice cannot log a session against bob''s book'
);

select lives_ok(
  $$insert into app.sessions (id, book_id, date, page_from, page_to)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '2026-01-03', 10, 20)$$,
  'alice can log a session on her own book with her own id'
);

select throws_ok(
  $$insert into app.sessions (book_id, date, page_from, page_to)
    values ('00000000-0000-0000-0000-00000000000a', '2026-01-04', 20, 10)$$,
  '23514',
  null,
  'the page range must run forward'
);

select throws_ok(
  $$update app.sessions set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her session to bob'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select note_text from app.sessions order by note_text',
  array['Bob invented note'],
  'bob sees only his own sessions'
);

reset role;
select is(
  (select count(*) from app.sessions where user_id = 'alice' and note_text = 'Alice invented note'),
  1::bigint,
  'alice''s session is unchanged'
);

select * from finish();
rollback;
