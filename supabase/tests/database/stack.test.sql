begin;
select plan(3);

select has_role('authenticated', 'the authenticated role exists');
select has_role('anon', 'the anon role exists');
select has_schema('storage', 'the storage schema exists');

select * from finish();
rollback;
