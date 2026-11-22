begin;
select plan(11);

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
insert into app.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'https://push.example.test/alice', 'pa', 'aa'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'https://push.example.test/bob', 'pb', 'ab');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select endpoint from app.push_subscriptions order by endpoint',
  array['https://push.example.test/alice'],
  'alice sees only her own subscriptions'
);

select throws_ok(
  'select p256dh from app.push_subscriptions',
  '42501',
  null,
  'alice cannot read the key columns back'
);

select throws_ok(
  $$insert into app.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('bob', 'https://push.example.test/planted', 'x', 'y')$$,
  '42501',
  null,
  'alice cannot create a subscription for bob'
);

select throws_ok(
  $$update app.push_subscriptions set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her subscription to bob'
);

select is(
  pg_temp.affected($$update app.push_subscriptions set p256dh = 'changed' where user_id = 'bob'$$),
  0::bigint,
  'alice cannot change bob''s keys'
);

select is(
  pg_temp.affected($$delete from app.push_subscriptions where user_id = 'bob'$$),
  0::bigint,
  'alice cannot delete bob''s subscription'
);

select throws_ok(
  $$insert into app.push_subscriptions (endpoint, p256dh, auth)
    values ('http://push.example.test/plain', 'x', 'y')$$,
  '23514',
  null,
  'an endpoint that is not https is rejected'
);

select throws_ok(
  $$insert into app.push_subscriptions (endpoint, p256dh, auth)
    values ('https://push.example.test/alice', 'x', 'y')$$,
  '23505',
  null,
  'the same endpoint cannot be stored twice for one user'
);

select lives_ok(
  $$insert into app.push_subscriptions (endpoint, p256dh, auth)
    values ('https://push.example.test/alice-2', 'x', 'y')$$,
  'alice can add her own subscription, and it defaults to her'
);

select is(
  pg_temp.affected($$delete from app.push_subscriptions where endpoint = 'https://push.example.test/alice-2'$$),
  1::bigint,
  'alice can delete her own subscription'
);

reset role;

select is(
  (select count(*) from app.push_subscriptions where user_id = 'bob'),
  1::bigint,
  'bob''s subscription is untouched'
);

select * from finish();
rollback;
