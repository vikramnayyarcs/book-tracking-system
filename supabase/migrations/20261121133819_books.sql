create table app.books (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.current_user_id()
    references app.users (id) on delete cascade,
  isbn text,
  title text not null check (length(title) > 0),
  author text,
  cover_url text,
  page_count integer check (page_count > 0),
  status text not null default 'reading'
    check (status in ('reading', 'finished', 'abandoned')),
  started_on date,
  finished_on date,
  finished_precision text check (finished_precision in ('day', 'month', 'year')),
  added_retrospectively boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check ((finished_on is null) = (finished_precision is null))
);

create index books_user_status_idx on app.books (user_id, status);

alter table app.books enable row level security;

create policy books_select on app.books
  for select to authenticated
  using (user_id = app.current_user_id());

create policy books_insert on app.books
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy books_update on app.books
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy books_delete on app.books
  for delete to authenticated
  using (user_id = app.current_user_id());

revoke all on app.books from public, anon, authenticated;
grant select, insert, delete on app.books to authenticated;
grant update (
  isbn, title, author, cover_url, page_count, status,
  started_on, finished_on, finished_precision, added_retrospectively
) on app.books to authenticated;
grant all on app.books to service_role;
