create schema app;

revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

create function app.current_user_id()
returns text
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )
$$;

revoke all on function app.current_user_id() from public;
grant execute on function app.current_user_id() to authenticated, service_role;

create table app.users (
  id text primary key default app.current_user_id(),
  tier text not null default 'free' check (tier in ('free', 'plus')),
  founding_member boolean not null default false,
  time_zone text not null default 'UTC',
  nudge_time time,
  not_reading_until date,
  created_at timestamptz not null default now()
);

alter table app.users enable row level security;

create policy users_select on app.users
  for select to authenticated
  using (id = app.current_user_id());

create policy users_insert on app.users
  for insert to authenticated
  with check (id = app.current_user_id());

create policy users_update on app.users
  for update to authenticated
  using (id = app.current_user_id())
  with check (id = app.current_user_id());

create policy users_delete on app.users
  for delete to authenticated
  using (id = app.current_user_id());

revoke all on app.users from public, anon, authenticated;
grant select on app.users to authenticated;
grant insert (id, time_zone, nudge_time, not_reading_until) on app.users to authenticated;
grant update (time_zone, nudge_time, not_reading_until) on app.users to authenticated;
grant delete on app.users to authenticated;
grant all on app.users to service_role;
