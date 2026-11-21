create function app.ensure_user(p_tier text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller text := app.current_user_id();
  current_tier text;
begin
  if caller is null then
    raise exception 'no caller' using errcode = '28000';
  end if;
  if p_tier not in ('free', 'plus') then
    raise exception 'unknown tier' using errcode = '22023';
  end if;
  insert into app.users (id, tier) values (caller, p_tier)
  on conflict (id) do nothing;
  select tier into current_tier from app.users where id = caller;
  return current_tier;
end
$$;

revoke all on function app.ensure_user(text) from public;
grant execute on function app.ensure_user(text) to authenticated, service_role;
