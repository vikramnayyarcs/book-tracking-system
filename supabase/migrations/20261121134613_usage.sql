create table app.usage (
  user_id text not null default app.current_user_id()
    references app.users (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  voice_seconds integer not null default 0 check (voice_seconds >= 0),
  vault_questions integer not null default 0 check (vault_questions >= 0),
  ai_input_tokens bigint not null default 0 check (ai_input_tokens >= 0),
  ai_output_tokens bigint not null default 0 check (ai_output_tokens >= 0),
  ai_insights_deleted integer not null default 0 check (ai_insights_deleted >= 0),
  primary key (user_id, month)
);

alter table app.usage enable row level security;

create policy usage_select on app.usage
  for select to authenticated
  using (user_id = app.current_user_id());

revoke all on app.usage from public, anon, authenticated;
grant select on app.usage to authenticated;
grant all on app.usage to service_role;

create function app.count_deleted_ai_insight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source = 'ai'
    and exists (select 1 from app.users where id = old.user_id)
    and exists (select 1 from app.books where id = old.book_id and user_id = old.user_id)
  then
    insert into app.usage (user_id, month, ai_insights_deleted)
    values (old.user_id, date_trunc('month', now() at time zone 'UTC')::date, 1)
    on conflict (user_id, month)
    do update set ai_insights_deleted = app.usage.ai_insights_deleted + 1;
  end if;
  return old;
end
$$;

revoke all on function app.count_deleted_ai_insight() from public;

create trigger insights_count_deleted_ai
  after delete on app.insights
  for each row execute function app.count_deleted_ai_insight();
