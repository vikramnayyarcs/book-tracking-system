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

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select title from app.books order by title',
  array['Alice''s invented book'],
  'alice sees only her own books'
);

select is(
  pg_temp.affected($$update app.books set title = 'Hijacked' where user_id = 'bob'$$),
  0::bigint,
  'alice cannot update bob''s book'
);

select is(
  pg_temp.affected($$delete from app.books where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s book'
);

select throws_ok(
  $$insert into app.books (user_id, title) values ('bob', 'Planted')$$,
  '42501',
  null,
  'alice cannot insert a book for bob'
);

select throws_ok(
  $$update app.books set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her book to bob'
);

select lives_ok(
  $$insert into app.books (title, finished_on, finished_precision, status)
    values ('Another invented book', '2020-05-01', 'month', 'finished')$$,
  'alice can add her own past book, and it defaults to her'
);

select throws_ok(
  $$insert into app.books (title, finished_on) values ('No precision', '2020-05-01')$$,
  '23514',
  null,
  'a finish date needs a precision'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select title from app.books order by title',
  array['Bob''s invented book'],
  'bob sees only his own books'
);

reset role;
select is(
  (select count(*) from app.books where user_id = 'alice' and title = 'Alice''s invented book'),
  1::bigint,
  'alice''s book is unchanged'
);

select * from finish();
rollback;
