create table app.insights (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.current_user_id(),
  book_id uuid not null,
  session_id uuid,
  kind text not null default 'insight' check (kind in ('insight', 'quote')),
  text text not null check (length(text) > 0),
  original_text text,
  source text not null default 'user' check (source in ('ai', 'user')),
  page integer check (page > 0),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (book_id, user_id) references app.books (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references app.sessions (id, user_id)
    on delete set null (session_id),
  foreign key (user_id) references app.users (id) on delete cascade
);

create index insights_user_book_idx on app.insights (user_id, book_id);

alter table app.insights enable row level security;

create policy insights_select on app.insights
  for select to authenticated
  using (user_id = app.current_user_id());

create policy insights_insert on app.insights
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy insights_update on app.insights
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy insights_delete on app.insights
  for delete to authenticated
  using (user_id = app.current_user_id());

revoke all on app.insights from public, anon, authenticated;
grant select, insert, delete on app.insights to authenticated;
grant update (session_id, kind, text, original_text, page, pinned) on app.insights to authenticated;
grant all on app.insights to service_role;
