create extension if not exists vector with schema extensions;

alter table app.sessions
  add column note_search tsvector
  generated always as (to_tsvector('english', coalesce(note_text, ''))) stored;

create index sessions_note_search_idx on app.sessions using gin (note_search);

alter table app.insights
  add column text_search tsvector
  generated always as (to_tsvector('english', coalesce(text, ''))) stored;

create index insights_text_search_idx on app.insights using gin (text_search);

alter table app.reviews
  add column text_search tsvector
  generated always as (to_tsvector('english', coalesce(text, ''))) stored;

create index reviews_text_search_idx on app.reviews using gin (text_search);
