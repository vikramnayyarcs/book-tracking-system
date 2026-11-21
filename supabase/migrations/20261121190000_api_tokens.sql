create table app.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.current_user_id()
    references app.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null
    check (cardinality(scopes) > 0 and scopes <@ array['sessions:write', 'books:read']),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_tokens_user_idx on app.api_tokens (user_id);

alter table app.api_tokens enable row level security;

create policy api_tokens_select on app.api_tokens
  for select to authenticated
  using (user_id = app.current_user_id());

create policy api_tokens_insert on app.api_tokens
  for insert to authenticated
  with check (user_id = app.current_user_id());

create policy api_tokens_update on app.api_tokens
  for update to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

revoke all on app.api_tokens from public, anon, authenticated;
grant select (id, user_id, name, scopes, created_at, last_used_at, revoked_at)
  on app.api_tokens to authenticated;
grant insert (name, token_hash, scopes) on app.api_tokens to authenticated;
grant update (revoked_at) on app.api_tokens to authenticated;
grant all on app.api_tokens to service_role;

create function app.token_lookup(p_hash text)
returns table (user_id text, scopes text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.api_tokens t
  set last_used_at = now()
  where t.token_hash = p_hash
    and t.revoked_at is null
    and (t.last_used_at is null or t.last_used_at < now() - interval '1 minute');
  return query
    select t.user_id, t.scopes
    from app.api_tokens t
    where t.token_hash = p_hash and t.revoked_at is null;
end
$$;

revoke all on function app.token_lookup(text) from public, anon, authenticated;
grant execute on function app.token_lookup(text) to service_role;
