begin;
select plan(9);

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
insert into app.reflections (user_id, book_id, stage, position, question) values
  ('alice', '00000000-0000-0000-0000-00000000000a', 'end', 1, 'Alice invented question'),
  ('bob', '00000000-0000-0000-0000-00000000000b', 'end', 1, 'Bob invented question');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select question from app.reflections order by question',
  array['Alice invented question'],
  'alice sees only her own reflections'
);

select is(
  pg_temp.affected($$update app.reflections set answer = 'Hijacked' where user_id = 'bob'$$),
  0::bigint,
  'alice cannot answer bob''s question'
);

select is(
  pg_temp.affected($$delete from app.reflections where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s reflection'
);

select throws_ok(
  $$insert into app.reflections (user_id, book_id, stage, position, question) values ('bob', '00000000-0000-0000-0000-00000000000b', 'mid', 1, 'Planted')$$,
  '42501',
  null,
  'alice cannot insert a reflection for bob'
);

select throws_ok(
  $$insert into app.reflections (book_id, stage, position, question) values ('00000000-0000-0000-0000-00000000000b', 'mid', 1, 'Planted on bob''s book')$$,
  '23503',
  null,
  'alice cannot attach a reflection to bob''s book'
);

select lives_ok(
  $$insert into app.reflections (book_id, stage, position, question, answer)
    values ('00000000-0000-0000-0000-00000000000a', 'recall', 1, 'What do you remember?', 'Invented answer')$$,
  'alice can add her own reflection'
);

select throws_ok(
  $$update app.reflections set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her reflection to bob'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select question from app.reflections order by question',
  array['Bob invented question'],
  'bob sees only his own reflections'
);

reset role;
select is(
  (select count(*) from app.reflections where user_id = 'alice' and answer is null),
  1::bigint,
  'alice''s question is unchanged'
);

select * from finish();
rollback;
