create table app.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.current_user_id()
    references app.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and length(endpoint) <= 2048),
  p256dh text not null check (length(p256dh) between 1 and 256),
  auth text not null check (length(auth) between 1 and 256),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table app.push_subscriptions enable row level security;

create policy push_subscriptions_select on app.push_subscriptions
  for select to authenticated
  using (user_id = app.current_user_id());

create policy push_subscriptions_insert on app.push_subscriptions
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy push_subscriptions_update on app.push_subscriptions
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy push_subscriptions_delete on app.push_subscriptions
  for delete to authenticated
  using (user_id = app.current_user_id());

revoke all on app.push_subscriptions from public, anon, authenticated;
grant select (id, user_id, endpoint, created_at) on app.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth) on app.push_subscriptions to authenticated;
grant update (p256dh, auth) on app.push_subscriptions to authenticated;
grant delete on app.push_subscriptions to authenticated;
grant all on app.push_subscriptions to service_role;
