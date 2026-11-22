begin;
select plan(12);

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

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select is(app.current_user_id(), 'alice', 'the helper returns the caller''s sub');

select results_eq(
  'select id from app.users order by id',
  array['alice'],
  'alice sees only her own row'
);

select is(
  pg_temp.affected($$update app.users set time_zone = 'Europe/London' where id = 'bob'$$),
  0::bigint,
  'alice cannot update bob''s row'
);

select is(
  pg_temp.affected($$delete from app.users where id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s row'
);

select throws_ok(
  $$insert into app.users (id) values ('bob')$$,
  '42501',
  null,
  'alice cannot insert a row for bob'
);

select throws_ok(
  $$update app.users set tier = 'plus' where id = 'alice'$$,
  '42501',
  null,
  'alice cannot change her own tier'
);

select throws_ok(
  $$update app.users set founding_member = true where id = 'alice'$$,
  '42501',
  null,
  'alice cannot make herself a founding member'
);

select throws_ok(
  $$update app.users set last_nudged_on = current_date where id = 'alice'$$,
  '42501',
  null,
  'alice cannot change her own last nudged date'
);

select is(
  pg_temp.affected($$update app.users set time_zone = 'Europe/London' where id = 'alice'$$),
  1::bigint,
  'alice can update her own time zone'
);

select set_config('request.jwt.claims', '', true);
select is(
  (select count(*) from app.users),
  0::bigint,
  'a caller without a sub sees nothing'
);

reset role;
set local role anon;
select throws_ok(
  'select * from app.users',
  '42501',
  null,
  'anon cannot read users'
);

reset role;
select is(
  (select count(*) from app.users where id = 'bob' and time_zone = 'UTC'),
  1::bigint,
  'bob''s row is unchanged'
);

select * from finish();
rollback;
