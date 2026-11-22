create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table app.job_runs (
  job text not null check (job ~ '^[a-z][a-z0-9_-]{0,62}$'),
  run_key text not null check (length(run_key) between 1 and 100),
  ran_at timestamptz not null default now(),
  primary key (job, run_key)
);

alter table app.job_runs enable row level security;

revoke all on app.job_runs from public, anon, authenticated;
grant all on app.job_runs to service_role;

create function app.schedule_job(job_name text, cron_schedule text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id bigint;
begin
  if job_name !~ '^[a-z][a-z0-9_-]{0,62}$' then
    raise exception 'invalid job name';
  end if;
  select cron.schedule(
    'api-job-' || job_name,
    cron_schedule,
    format(
      $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'jobs_url')
          || '/internal/jobs/' || %L,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-jobs-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'jobs_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      )
      $cmd$,
      job_name
    )
  ) into job_id;
  return job_id;
end
$$;

revoke all on function app.schedule_job(text, text) from public, anon, authenticated;
grant execute on function app.schedule_job(text, text) to service_role;
