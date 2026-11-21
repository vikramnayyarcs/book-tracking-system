begin;
select plan(10);

insert into app.users (id) values ('alice'), ('bob');
insert into app.books (id, user_id, title) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice''s invented book'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 'Bob''s invented book');
insert into app.sessions (id, user_id, book_id, date, note_text) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice', '00000000-0000-0000-0000-00000000000a', '2026-01-01', 'Alice notes that small habits compound'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob', '00000000-0000-0000-0000-00000000000b', '2026-01-02', 'Bob notes that habits need cues');
insert into app.insights (user_id, book_id, text) values
  ('alice', '00000000-0000-0000-0000-00000000000a', 'Alice insight about leadership habits'),
  ('bob', '00000000-0000-0000-0000-00000000000b', 'Bob insight about leadership habits');
insert into app.reviews (book_id, user_id, rating, text) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 4, 'Alice review praising the habits chapters'),
  ('00000000-0000-0000-0000-00000000000b', 'bob', 3, 'Bob review praising the habits chapters');

select has_extension('vector', 'pgvector is enabled');
select has_index('app', 'sessions', 'sessions_note_search_idx', 'sessions have a search index');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select results_eq(
  $$select note_text from app.sessions where note_search @@ websearch_to_tsquery('english', 'habits')$$,
  array['Alice notes that small habits compound'],
  'alice''s session search finds only her notes'
);

select results_eq(
  $$select text from app.insights where text_search @@ websearch_to_tsquery('english', 'leadership')$$,
  array['Alice insight about leadership habits'],
  'alice''s insight search finds only her insights'
);

select results_eq(
  $$select text from app.reviews where text_search @@ websearch_to_tsquery('english', 'praising')$$,
  array['Alice review praising the habits chapters'],
  'alice''s review search finds only her reviews'
);

select is(
  (select count(*) from app.sessions where note_search @@ websearch_to_tsquery('english', 'cues')),
  0::bigint,
  'alice cannot find bob''s note by a word only he used'
);

select results_eq(
  $$select note_text from app.sessions where note_search @@ websearch_to_tsquery('english', 'compounding')$$,
  array['Alice notes that small habits compound'],
  'English stemming matches compounding to compound'
);

select set_config('request.jwt.claims', '{"sub":"bob","role":"authenticated"}', true);

select results_eq(
  $$select note_text from app.sessions where note_search @@ websearch_to_tsquery('english', 'habits')$$,
  array['Bob notes that habits need cues'],
  'bob''s session search finds only his notes'
);

select results_eq(
  $$select text from app.insights where text_search @@ websearch_to_tsquery('english', 'leadership')$$,
  array['Bob insight about leadership habits'],
  'bob''s insight search finds only his insights'
);

select set_config('request.jwt.claims', '', true);
select is(
  (select count(*) from app.sessions where note_search @@ websearch_to_tsquery('english', 'habits')),
  0::bigint,
  'a caller without a sub finds nothing'
);

select * from finish();
rollback;
