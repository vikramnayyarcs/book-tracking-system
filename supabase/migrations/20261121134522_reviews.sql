create table app.reviews (
  book_id uuid primary key,
  user_id text not null default app.current_user_id(),
  rating smallint check (rating between 1 and 5),
  text text,
  photo_path text,
  summary text,
  created_at timestamptz not null default now(),
  foreign key (book_id, user_id) references app.books (id, user_id) on delete cascade,
  foreign key (user_id) references app.users (id) on delete cascade
);

create index reviews_user_idx on app.reviews (user_id);

alter table app.reviews enable row level security;

create policy reviews_select on app.reviews
  for select to authenticated
  using (user_id = app.current_user_id());

create policy reviews_insert on app.reviews
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy reviews_update on app.reviews
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy reviews_delete on app.reviews
  for delete to authenticated
  using (user_id = app.current_user_id());

revoke all on app.reviews from public, anon, authenticated;
grant select, insert, delete on app.reviews to authenticated;
grant update (rating, text, photo_path, summary) on app.reviews to authenticated;
grant all on app.reviews to service_role;
