create function app.insights_keep_original()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.text is distinct from old.text
    and old.source = 'ai'
    and old.original_text is null then
    new.original_text := old.text;
  end if;
  return new;
end
$$;

create trigger insights_keep_original
  before update of text on app.insights
  for each row execute function app.insights_keep_original();
