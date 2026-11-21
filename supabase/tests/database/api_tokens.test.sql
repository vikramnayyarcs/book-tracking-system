begin;
select plan(13);

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
insert into app.api_tokens (id, user_id, name, token_hash, scopes) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice shortcut', repeat('a', 64), array['sessions:write']),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'Bob shortcut', repeat('b', 64), array['books:read']),
  ('00000000-0000-0000-0000-00000000000c', 'bob', 'Bob revoked', repeat('c', 64), array['books:read']);
update app.api_tokens set revoked_at = now() where id = '00000000-0000-0000-0000-00000000000c';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select name from app.api_tokens order by name',
  array['Alice shortcut'],
  'alice sees only her own tokens'
);

select throws_ok(
  'select token_hash from app.api_tokens',
  '42501',
  null,
  'alice cannot read the token hash column'
);

select is(
  pg_temp.affected($$update app.api_tokens set revoked_at = now() where user_id = 'bob'$$),
  0::bigint,
  'alice cannot revoke bob''s token'
);

select throws_ok(
  $$insert into app.api_tokens (user_id, name, token_hash, scopes)
    values ('bob', 'Planted', repeat('d', 64), array['books:read'])$$,
  '42501',
  null,
  'alice cannot create a token for bob'
);

select throws_ok(
  $$update app.api_tokens set user_id = 'bob' where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot hand her token to bob'
);

select throws_ok(
  $$delete from app.api_tokens where user_id = 'alice'$$,
  '42501',
  null,
  'alice cannot delete token rows, only revoke them'
);

select throws_ok(
  $$insert into app.api_tokens (name, token_hash, scopes)
    values ('Bad scope', repeat('e', 64), array['admin'])$$,
  '23514',
  null,
  'an unknown scope is rejected'
);

select lives_ok(
  $$insert into app.api_tokens (name, token_hash, scopes)
    values ('Alice second', repeat('f', 64), array['sessions:write', 'books:read'])$$,
  'alice can create her own token, and it defaults to her'
);

select throws_ok(
  $$select * from app.token_lookup(repeat('a', 64))$$,
  '42501',
  null,
  'a signed-in user cannot call the lookup function'
);

reset role;

select results_eq(
  $$select user_id, scopes from app.token_lookup(repeat('b', 64))$$,
  $$values ('bob'::text, array['books:read']::text[])$$,
  'the lookup returns only the user and scopes of a live token'
);

select is(
  (select count(*) from app.token_lookup(repeat('c', 64))),
  0::bigint,
  'the lookup finds nothing for a revoked token'
);

select is(
  (select count(*) from app.token_lookup(repeat('9', 64))),
  0::bigint,
  'the lookup finds nothing for an unknown hash'
);

select isnt(
  (select last_used_at from app.api_tokens where id = '00000000-0000-0000-0000-00000000000b'),
  null,
  'the lookup records last use'
);

select * from finish();
rollback;
