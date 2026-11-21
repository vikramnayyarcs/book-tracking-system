create table app.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.current_user_id(),
  book_id uuid not null,
  date date not null,
  page_from integer check (page_from > 0),
  page_to integer check (page_to > 0),
  chapter text,
  note_text text,
  note_source text not null default 'typed' check (note_source in ('typed', 'voice')),
  audio_path text,
  audio_seconds integer check (audio_seconds >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'uploaded', 'transcribing', 'extracting', 'ready', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (book_id, user_id) references app.books (id, user_id) on delete cascade,
  foreign key (user_id) references app.users (id) on delete cascade,
  check (page_from is null or page_to is null or page_to >= page_from)
);

create index sessions_user_book_date_idx on app.sessions (user_id, book_id, date);

alter table app.sessions enable row level security;

create policy sessions_select on app.sessions
  for select to authenticated
  using (user_id = app.current_user_id());

create policy sessions_insert on app.sessions
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy sessions_update on app.sessions
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy sessions_delete on app.sessions
  for delete to authenticated
  using (user_id = app.current_user_id());

revoke all on app.sessions from public, anon, authenticated;
grant select, insert, delete on app.sessions to authenticated;
grant update (
  date, page_from, page_to, chapter, note_text, note_source,
  audio_path, audio_seconds, status, error_code
) on app.sessions to authenticated;
grant all on app.sessions to service_role;
