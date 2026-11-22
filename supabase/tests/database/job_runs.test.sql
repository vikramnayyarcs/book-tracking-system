begin;
select plan(9);

insert into app.job_runs (job, run_key) values ('heartbeat', 'seed-key');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"alice","role":"authenticated"}', true);

select throws_ok(
  'select * from app.job_runs',
  '42501',
  null,
  'an authenticated user cannot read job runs'
);
select throws_ok(
  $$insert into app.job_runs (job, run_key) values ('heartbeat', 'x')$$,
  '42501',
  null,
  'an authenticated user cannot write job runs'
);
select throws_ok(
  $$select app.schedule_job('heartbeat', '* * * * *')$$,
  '42501',
  null,
  'an authenticated user cannot schedule a job'
);

reset role;
set local role anon;
select throws_ok(
  'select * from app.job_runs',
  '42501',
  null,
  'anon cannot read job runs'
);

reset role;
select is(
  (select relrowsecurity from pg_class where oid = 'app.job_runs'::regclass),
  true,
  'job_runs has row level security on'
);

select throws_ok(
  $$insert into app.job_runs (job, run_key) values ('heartbeat', 'seed-key')$$,
  '23505',
  null,
  'the same job and run key cannot be recorded twice'
);

select vault.create_secret('https://example.invalid/functions/v1/api', 'jobs_url');
select vault.create_secret('test-secret-value', 'jobs_secret');
select app.schedule_job('heartbeat', '*/15 * * * *');
select app.schedule_job('heartbeat', '*/30 * * * *');

select results_eq(
  $$select schedule from cron.job where jobname = 'api-job-heartbeat'$$,
  array['*/30 * * * *'],
  'scheduling a job by name twice leaves one job with the new schedule'
);
select ok(
  (select command like '%/internal/jobs/%heartbeat%' and command like '%x-jobs-secret%'
     from cron.job where jobname = 'api-job-heartbeat'),
  'the job calls the internal route with the secret header'
);
select throws_ok(
  $$select app.schedule_job('bad name; drop', '* * * * *')$$,
  'P0001',
  'invalid job name',
  'a job name that is not a plain slug is refused'
);

select * from finish();
rollback;
