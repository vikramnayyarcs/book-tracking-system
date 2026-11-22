create function app.insights_clear_embedding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.text is distinct from old.text then
    new.embedding := null;
  end if;
  return new;
end
$$;

create trigger insights_clear_embedding
  before update of text on app.insights
  for each row execute function app.insights_clear_embedding();

create index insights_embedding_pending_idx
  on app.insights (created_at, id)
  where embedding is null;

select app.schedule_job('embed-backfill', '*/15 * * * *');
