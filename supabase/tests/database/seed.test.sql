begin;
select plan(12);

select is((select count(*) from app.users), 2::bigint, 'the seed creates two users');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_seed_alice","role":"authenticated"}', true);

select is((select count(*) from app.books), 3::bigint, 'seeded alice sees her 3 books');
select is((select count(*) from app.sessions), 3::bigint, 'seeded alice sees her 3 sessions');
select is((select count(*) from app.insights), 3::bigint, 'seeded alice sees her 3 insights');
select is((select count(*) from app.reflections), 3::bigint, 'seeded alice sees her 3 reflections');
select is((select count(*) from app.reviews), 2::bigint, 'seeded alice sees her 2 reviews');
select is(
  (select count(*) from app.sessions where note_search @@ websearch_to_tsquery('english', 'habits')),
  2::bigint,
  'seeded alice finds her two notes about habits'
);

select set_config('request.jwt.claims', '{"sub":"user_seed_bob","role":"authenticated"}', true);

select is((select count(*) from app.books), 2::bigint, 'seeded bob sees his 2 books');
select is((select count(*) from app.sessions), 2::bigint, 'seeded bob sees his 2 sessions');
select is((select count(*) from app.insights), 2::bigint, 'seeded bob sees his 2 insights');
select is((select count(*) from app.reviews), 1::bigint, 'seeded bob sees his review');
select is(
  (select count(*) from app.sessions where note_search @@ websearch_to_tsquery('english', 'habits')),
  0::bigint,
  'seeded bob finds nothing about habits, because those notes are alice''s'
);

select * from finish();
rollback;
