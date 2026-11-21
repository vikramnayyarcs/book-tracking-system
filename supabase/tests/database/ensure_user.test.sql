begin;
select plan(7);

insert into app.users (id, tier) values ('bob', 'free');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select is(app.ensure_user('plus'), 'plus', 'the first call creates alice with the default tier');
select is(app.ensure_user('free'), 'plus', 'a later call keeps the tier alice already has');
select is((select count(*) from app.users), 1::bigint, 'alice sees only her own row');
select is((select id from app.users), 'alice', 'the row is alice''s');

select throws_ok($$select app.ensure_user('gold')$$, '22023', null, 'an unknown tier is rejected');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select app.ensure_user('free')$$, '28000', null, 'a call without a user id is rejected');

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);
select is(app.ensure_user('plus'), 'free', 'bob''s existing tier is not changed by another default');

select * from finish();
rollback;
