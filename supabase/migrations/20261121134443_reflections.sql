create table app.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.current_user_id(),
  book_id uuid not null,
  stage text not null check (stage in ('mid', 'end', 'recall')),
  position integer not null check (position > 0),
  question text not null check (length(question) > 0),
  answer text,
  created_at timestamptz not null default now(),
  foreign key (book_id, user_id) references app.books (id, user_id) on delete cascade,
  foreign key (user_id) references app.users (id) on delete cascade
);

create index reflections_user_book_idx on app.reflections (user_id, book_id, stage, position);

alter table app.reflections enable row level security;

create policy reflections_select on app.reflections
  for select to authenticated
  using (user_id = app.current_user_id());

create policy reflections_insert on app.reflections
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy reflections_update on app.reflections
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy reflections_delete on app.reflections
  for delete to authenticated
  using (user_id = app.current_user_id());

revoke all on app.reflections from public, anon, authenticated;
grant select, insert, delete on app.reflections to authenticated;
grant update (stage, position, question, answer) on app.reflections to authenticated;
grant all on app.reflections to service_role;
