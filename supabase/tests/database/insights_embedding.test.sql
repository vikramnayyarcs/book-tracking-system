begin;
select plan(7);

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
insert into app.insights (id, user_id, book_id, text, embedding) values
  ('00000000-0000-0000-0000-0000000000a9', 'alice', '00000000-0000-0000-0000-00000000000a', 'Alice invented insight', array_fill(0.1::real, array[384])::extensions.vector),
  ('00000000-0000-0000-0000-0000000000b9', 'bob', '00000000-0000-0000-0000-00000000000b', 'Bob invented insight', array_fill(0.2::real, array[384])::extensions.vector);

select has_column('app', 'insights', 'embedding', 'insights have an embedding column');
select col_type_is('app', 'insights', 'embedding', 'extensions.vector(384)', 'the embedding has 384 dimensions');
select has_index('app', 'insights', 'insights_embedding_idx', 'the embedding has a similarity index');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  'select text from app.insights where embedding is not null order by text',
  array['Alice invented insight'],
  'alice sees only her own embedded insights'
);

select is(
  pg_temp.affected($$update app.insights set pinned = true where id = '00000000-0000-0000-0000-0000000000b9'$$),
  0::bigint,
  'alice cannot change bob''s insight'
);

select throws_ok(
  $$update app.insights set embedding = array_fill(0.3::real, array[384])::extensions.vector where id = '00000000-0000-0000-0000-0000000000a9'$$,
  '42501',
  null,
  'alice cannot write her own embedding through the API role'
);

select results_eq(
  $$select id from app.insights order by embedding operator(extensions.<=>) array_fill(0.2::real, array[384])::extensions.vector limit 1$$,
  array['00000000-0000-0000-0000-0000000000a9'::uuid],
  'a similarity search for bob''s vector returns only alice''s row for alice'
);

select * from finish();
rollback;
