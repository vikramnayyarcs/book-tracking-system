create table app.deletion_attempts (
  id bigint generated always as identity primary key,
  user_id text not null references app.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index deletion_attempts_user_time_idx
  on app.deletion_attempts (user_id, attempted_at desc);

alter table app.deletion_attempts enable row level security;

revoke all on app.deletion_attempts from public, anon, authenticated;
grant all on app.deletion_attempts to service_role;

create function app.record_deletion_attempt()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller text := app.current_user_id();
  recent integer;
begin
  if caller is null then
    raise exception 'no caller' using errcode = '42501';
  end if;
  perform 1 from app.users where id = caller for update;
  select count(*) into recent
  from app.deletion_attempts
  where user_id = caller and attempted_at > now() - interval '24 hours';
  if recent >= 3 then
    return false;
  end if;
  insert into app.deletion_attempts (user_id) values (caller);
  return true;
end
$$;

revoke all on function app.record_deletion_attempt() from public, anon;
grant execute on function app.record_deletion_attempt() to authenticated, service_role;
