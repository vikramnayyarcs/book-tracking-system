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
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'Bob''s invented book'),
  ('00000000-0000-0000-0000-0000000000a2', 'alice', 'Alice''s second invented book'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob', 'Bob''s unreviewed invented book');
insert into app.reviews (book_id, user_id, rating, text) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 4, 'Alice invented review'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 2, 'Bob invented review');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select text from app.reviews order by text',
  array['Alice invented review'],
  'alice sees only her own reviews'
);

select is(
  pg_temp.affected($$update app.reviews set rating = 1 where user_id = 'bob'$$),
  0::bigint,
  'alice cannot update bob''s review'
);

select is(
  pg_temp.affected($$delete from app.reviews where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s review'
);

select throws_ok(
  $$insert into app.reviews (book_id, user_id, rating) values ('00000000-0000-0000-0000-00000000000b', 'bob', 5)$$,
  '42501',
  null,
  'alice cannot insert a review for bob'
);

select throws_ok(
  $$insert into app.reviews (book_id, rating) values ('00000000-0000-0000-0000-0000000000b2', 5)$$,
  '23503',
  null,
  'alice cannot review bob''s book'
);

select throws_ok(
  $$insert into app.reviews (book_id, rating) values ('00000000-0000-0000-0000-00000000000a', 5)$$,
  '23505',
  null,
  'a book has at most one review'
);

select throws_ok(
  $$insert into app.reviews (book_id, rating) values ('00000000-0000-0000-0000-0000000000a2', 6)$$,
  '23514',
  null,
  'a rating is from 1 to 5'
);

select lives_ok(
  $$insert into app.reviews (book_id, rating, text) values ('00000000-0000-0000-0000-0000000000a2', 5, 'Another invented review')$$,
  'alice can review her other book'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select text from app.reviews order by text',
  array['Bob invented review'],
  'bob sees only his own reviews'
);

reset role;
select is(
  (select count(*) from app.reviews where user_id = 'alice' and rating = 4),
  1::bigint,
  'alice''s review is unchanged'
);

select * from finish();
rollback;
