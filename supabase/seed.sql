insert into app.users (id, time_zone, nudge_time) values
  ('user_seed_alice', 'Europe/London', '20:30'),
  ('user_seed_bob', 'America/New_York', null);

insert into app.books (id, user_id, isbn, title, author, page_count, status, started_on, finished_on, finished_precision, added_retrospectively) values
  ('10000000-0000-0000-0000-00000000a001', 'user_seed_alice', '9780000000011', 'The Lighthouse Ledger', 'Imogen Vale', 320, 'reading', '2026-10-01', null, null, false),
  ('10000000-0000-0000-0000-00000000a002', 'user_seed_alice', '9780000000028', 'Small Engines of Change', 'Tomas Brandt', 256, 'finished', '2026-08-02', '2026-09-14', 'day', false),
  ('10000000-0000-0000-0000-00000000a003', 'user_seed_alice', '9780000000035', 'A Garden of Rules', 'Priya Nandakumar', 288, 'finished', null, '2024-01-01', 'year', true),
  ('10000000-0000-0000-0000-00000000b001', 'user_seed_bob', '9780000000042', 'The Quiet Compass', 'Declan Ross', 304, 'reading', '2026-11-03', null, null, false),
  ('10000000-0000-0000-0000-00000000b002', 'user_seed_bob', '9780000000059', 'Ledgers and Lanterns', 'Mei-Lin Zhou', 272, 'finished', '2026-07-10', '2026-08-20', 'month', false);

insert into app.sessions (id, user_id, book_id, date, page_from, page_to, chapter, note_text, note_source, audio_seconds, status) values
  ('20000000-0000-0000-0000-0000000a0001', 'user_seed_alice', '10000000-0000-0000-0000-00000000a001', '2026-10-02', 1, 34, null, 'The keeper counts ships, not days. Invented note about patience and routine habits.', 'typed', null, 'ready'),
  ('20000000-0000-0000-0000-0000000a0002', 'user_seed_alice', '10000000-0000-0000-0000-00000000a001', '2026-10-05', 35, 70, 'Chapter 3', 'Invented voice note: the ledger shows how small daily records add up.', 'voice', 48, 'ready'),
  ('20000000-0000-0000-0000-0000000a0003', 'user_seed_alice', '10000000-0000-0000-0000-00000000a002', '2026-08-10', 1, 40, null, 'Invented note: tiny changes beat big plans, a theme about habits.', 'typed', null, 'ready'),
  ('20000000-0000-0000-0000-0000000b0001', 'user_seed_bob', '10000000-0000-0000-0000-00000000b001', '2026-11-04', 1, 25, null, 'Invented note: a compass is only useful if you stop to look at it.', 'typed', null, 'ready'),
  ('20000000-0000-0000-0000-0000000b0002', 'user_seed_bob', '10000000-0000-0000-0000-00000000b002', '2026-07-12', 1, 60, 'Part one', 'Invented voice note on leadership lessons from a lantern maker.', 'voice', 62, 'ready');

insert into app.insights (id, user_id, book_id, session_id, kind, text, original_text, source, page, pinned) values
  ('30000000-0000-0000-0000-000000a00001', 'user_seed_alice', '10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-0000000a0001', 'insight', 'Routine turns patience into a habit.', 'Routine turns patience into a habit.', 'ai', 22, true),
  ('30000000-0000-0000-0000-000000a00002', 'user_seed_alice', '10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-0000000a0002', 'insight', 'Small daily records add up to a clear picture.', 'Small daily records compound into a picture.', 'ai', 52, false),
  ('30000000-0000-0000-0000-000000a00003', 'user_seed_alice', '10000000-0000-0000-0000-00000000a002', '20000000-0000-0000-0000-0000000a0003', 'quote', 'Change is a thousand small turns of the wheel.', null, 'user', 18, false),
  ('30000000-0000-0000-0000-000000b00001', 'user_seed_bob', '10000000-0000-0000-0000-00000000b001', '20000000-0000-0000-0000-0000000b0001', 'insight', 'A compass only helps when you stop and look.', 'A compass only helps when you stop and look.', 'ai', 14, false),
  ('30000000-0000-0000-0000-000000b00002', 'user_seed_bob', '10000000-0000-0000-0000-00000000b002', '20000000-0000-0000-0000-0000000b0002', 'insight', 'Good leaders keep the lantern lit for others.', 'Good leaders keep the lantern lit for others.', 'ai', 41, true);

insert into app.reflections (id, user_id, book_id, stage, position, question, answer) values
  ('40000000-0000-0000-0000-000000a00001', 'user_seed_alice', '10000000-0000-0000-0000-00000000a002', 'end', 1, 'Which small change from the book will you try first?', 'Invented answer: a five minute evening review.'),
  ('40000000-0000-0000-0000-000000a00002', 'user_seed_alice', '10000000-0000-0000-0000-00000000a002', 'end', 2, 'What did the author get wrong, in your view?', null),
  ('40000000-0000-0000-0000-000000a00003', 'user_seed_alice', '10000000-0000-0000-0000-00000000a003', 'recall', 1, 'What is the first scene you remember?', 'Invented answer: the walled garden at dawn.'),
  ('40000000-0000-0000-0000-000000b00001', 'user_seed_bob', '10000000-0000-0000-0000-00000000b002', 'end', 1, 'Who would you give this book to, and why?', 'Invented answer: a friend starting a team.'),
  ('40000000-0000-0000-0000-000000b00002', 'user_seed_bob', '10000000-0000-0000-0000-00000000b001', 'mid', 1, 'What has surprised you so far?', null);

insert into app.reviews (book_id, user_id, rating, text, summary) values
  ('10000000-0000-0000-0000-00000000a002', 'user_seed_alice', 5, 'Invented review: practical and warm, with a chapter on habits worth rereading.', 'Invented summary: small steady changes matter more than grand plans.'),
  ('10000000-0000-0000-0000-00000000a003', 'user_seed_alice', 4, 'Invented review of a book read long ago.', null),
  ('10000000-0000-0000-0000-00000000b002', 'user_seed_bob', 3, 'Invented review: uneven, but the lantern chapters are strong.', null);

insert into app.usage (user_id, month, voice_seconds, vault_questions, ai_input_tokens, ai_output_tokens, ai_insights_deleted) values
  ('user_seed_alice', '2026-10-01', 48, 1, 1800, 420, 0),
  ('user_seed_bob', '2026-07-01', 62, 0, 1200, 300, 0);
