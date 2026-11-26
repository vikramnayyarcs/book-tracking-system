begin;
select plan(11);

insert into app.users (id) values ('alice'), ('bob');
insert into app.deletion_attempts (user_id) values ('bob'), ('bob'), ('bob');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select throws_ok(
  'select * from app.deletion_attempts',
  '42501',
  null,
  'alice cannot read attempts'
);
select throws_ok(
  $$insert into app.deletion_attempts (user_id) values ('bob')$$,
  '42501',
  null,
  'alice cannot write attempts'
);
select throws_ok(
  $$delete from app.deletion_attempts$$,
  '42501',
  null,
  'alice cannot erase attempts'
);

select is(app.record_deletion_attempt(), true, 'alice attempt 1 is allowed');
select is(app.record_deletion_attempt(), true, 'alice attempt 2 is allowed');
select is(app.record_deletion_attempt(), true, 'alice attempt 3 is allowed');
select is(app.record_deletion_attempt(), false, 'alice attempt 4 is refused');

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select is(app.record_deletion_attempt(), false, 'bob has used his 3 attempts, alice''s do not matter');

reset role;
update app.deletion_attempts set attempted_at = now() - interval '25 hours' where user_id = 'bob';
set local role authenticated;
select is(app.record_deletion_attempt(), true, 'bob can try again after 24 hours');

reset role;
select is(
  (select relrowsecurity from pg_class where oid = 'app.deletion_attempts'::regclass),
  true,
  'row level security is on'
);
delete from app.users where id = 'alice';
select is(
  (select count(*) from app.deletion_attempts where user_id = 'alice'),
  0::bigint,
  'deleting the user removes the attempts'
);

select * from finish();
rollback;
