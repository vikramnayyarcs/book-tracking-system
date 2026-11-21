begin;
select plan(14);

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
  ('00000000-0000-0000-0000-0000000000a2', 'alice', 'Alice''s second invented book'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'Bob''s invented book');
insert into app.usage (user_id, month, voice_seconds) values
  ('alice', date_trunc('month', now() at time zone 'UTC')::date, 60),
  ('bob', date_trunc('month', now() at time zone 'UTC')::date, 120);
insert into app.insights (id, user_id, book_id, text, source) values
  ('00000000-0000-0000-0000-000000000a01', 'alice', '00000000-0000-0000-0000-00000000000a', 'Alice AI insight one', 'ai'),
  ('00000000-0000-0000-0000-000000000a02', 'alice', '00000000-0000-0000-0000-00000000000a', 'Alice AI insight two', 'ai'),
  ('00000000-0000-0000-0000-000000000a03', 'alice', '00000000-0000-0000-0000-00000000000a', 'Alice own insight', 'user'),
  ('00000000-0000-0000-0000-000000000a04', 'alice', '00000000-0000-0000-0000-0000000000a2', 'Alice AI insight on the second book', 'ai'),
  ('00000000-0000-0000-0000-000000000b01', 'bob', '00000000-0000-0000-0000-00000000000b', 'Bob AI insight', 'ai');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select voice_seconds from app.usage',
  array[60],
  'alice sees only her own usage'
);

select is(
  pg_temp.affected($$update app.usage set voice_seconds = 0 where user_id = 'bob'$$),
  0::bigint,
  'alice cannot update bob''s usage'
);

select is(
  pg_temp.affected($$delete from app.usage where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s usage'
);

select throws_ok(
  $$insert into app.usage (user_id, month) values ('bob', '2020-01-01')$$,
  '42501',
  null,
  'alice cannot insert usage for bob'
);

select throws_ok(
  $$update app.usage set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her usage to bob'
);

select throws_ok(
  $$insert into app.usage (month) values ('2020-01-15')$$,
  '23514',
  null,
  'a usage month is the first day of the month'
);

select is(
  pg_temp.affected($$delete from app.insights where id = '00000000-0000-0000-0000-000000000a01'$$),
  1::bigint,
  'alice deletes an AI insight'
);

select is(
  (select ai_insights_deleted from app.usage),
  1,
  'deleting an AI insight counts once in her usage'
);

select pg_temp.affected($$delete from app.insights where id = '00000000-0000-0000-0000-000000000a03'$$);
select is(
  (select ai_insights_deleted from app.usage),
  1,
  'deleting her own insight does not count'
);

select pg_temp.affected($$delete from app.insights where id = '00000000-0000-0000-0000-000000000a02'$$);
select is(
  (select ai_insights_deleted from app.usage),
  2,
  'a second AI insight deletion adds one'
);

select pg_temp.affected($$delete from app.books where id = '00000000-0000-0000-0000-0000000000a2'$$);
select is(
  (select ai_insights_deleted from app.usage),
  2,
  'deleting a book does not count its AI insights as rejected'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select results_eq(
  'select voice_seconds from app.usage',
  array[120],
  'bob sees only his own usage'
);

reset role;
select is(
  (select ai_insights_deleted from app.usage where user_id = 'bob'),
  0,
  'alice''s deletions did not touch bob''s usage'
);

select lives_ok(
  $$delete from app.users where id = 'alice'$$,
  'deleting a user cascades without the trigger failing'
);

select * from finish();
rollback;
