# Supabase restore drill

**DRAFT, owner review.**

Purpose: prove that a production backup restores into a working database with the right data and working RLS, before the first beta invite (ADR 0012, "Production review" item 4). Run it before launch, then once a quarter and after any change to backup settings.

The drill never touches production data. It restores a backup into a **scratch project** (same region, eu-west-2), checks it, and deletes it. Never use the in-place restore (`supabase backups restore`, `restore-pitr`): it overwrites production.

## Before you start

- [ ] Production has backups: daily backups are included in paid plans; point-in-time recovery (PITR) is a paid add-on. Decide whether beta needs PITR and record the decision in an ADR. If production is on the Free plan, there are no restorable backups: the drill fails at step 2, and that is the finding.
- [ ] Supabase CLI logged in as the owner: `supabase login` (the token lives in your Windows user environment, prefixed `BT_`, never in the repo).
- [ ] Set `PROD_REF` (production project ref: `terraform output` in `infra/envs/prod`) and `ORG_ID` (`supabase orgs list`).
- [ ] Note the time. A scratch project costs money while it exists: finish the same day.

## Steps

### 1. Record the source numbers (read-only)

Link to production read-only (`supabase link --project-ref $PROD_REF`) and run this query with `supabase db query --linked`, or in the SQL editor. Save the output in the log below.

```sql
select 'users' t, count(*) from app.users
union all select 'books', count(*) from app.books
union all select 'sessions', count(*) from app.sessions
union all select 'insights', count(*) from app.insights
union all select 'reflections', count(*) from app.reflections
union all select 'reviews', count(*) from app.reviews
union all select 'usage', count(*) from app.usage
union all select 'api_tokens', count(*) from app.api_tokens
union all select 'push_subscriptions', count(*) from app.push_subscriptions
union all select 'job_runs', count(*) from app.job_runs
union all select 'storage_objects', count(*) from storage.objects;
```

Add any table created after this draft: `select tablename from pg_tables where schemaname = 'app';`. Counts only, never select note text.

### 2. Pick a backup

```sh
supabase backups list --project-ref $PROD_REF
```

Pick the newest backup (with PITR, a timestamp at least a few minutes old). Write down its time. The expected data loss is everything written after it.

### 3. Restore into a new project

Supabase restores into a new project from the dashboard: Database, Backups, "Restore to a New Project" (with PITR, choose the date and time). This is the one dashboard step in the drill. It makes a temporary scratch project, not managed infrastructure, so do not import it into Terraform. Name it `restore-drill-YYYYMMDD`. It stays in the source region (eu-west-2). Wait until the project is healthy.

The Supabase docs describe the in-place restore through the CLI and Management API only. Check the current docs for a CLI or API route to restore to a new project; if one exists, prefer it and update this step.

### 4. Verify row counts

Connect to the scratch project (`supabase link --project-ref <scratch ref>`) and run the step 1 query.

- [ ] Every table count equals the source count, or is lower only by rows written after the backup time (explain in the log).
- [ ] `select count(*) from supabase_migrations.schema_migrations;` equals the number of files in `supabase/migrations/`.
- [ ] `select extname from pg_extension where extname = 'vector';` returns a row.
- [ ] `select count(*) from app.insights where embedding is not null;` is plausible against the source.
- [ ] `storage.objects` count matches. A database backup holds the object rows, not the files (see "Known gap").

### 5. Verify RLS

Prove user A cannot read user B's rows in the restored copy. Pick two user IDs from `app.users` (IDs only). Run in the scratch project:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<USER_A_CLERK_ID>', 'role', 'authenticated')::text, true);
select count(*) as own_rows from app.sessions;
select count(*) as other_rows from app.sessions where user_id = (select id from app.users where clerk_id = '<USER_B_CLERK_ID>');
rollback;
```

Expect `own_rows` to equal user A's count and `other_rows` to be 0. The column names are examples: check them against `supabase/migrations/` first.

- [ ] `other_rows` is 0.
- [ ] `select count(*) from pg_tables where schemaname = 'app' and not rowsecurity;` returns 0.
- [ ] `select count(*) from pg_policies where schemaname = 'app';` equals production's count.
- [ ] As `anon` (`set local role anon;`), `select count(*) from app.sessions;` returns 0 or a permission error.

### 6. Delete the scratch project

```sh
supabase projects delete <scratch ref>
```

- [ ] `supabase projects list` no longer shows the scratch project.
- [ ] No scratch ref, password or key was written to the repo, an issue or a PR.

## Pass or fail

The drill **passes** only when every box above is ticked. It **fails** if: no backup is available; counts differ without an explanation; the migration count differs; an RLS check returns another user's rows; a table has RLS off; or the scratch project is not deleted. A failure becomes a `bug` issue, and the first invite waits.

Also record the restore duration (start of step 3 to healthy) and the backup age used. They set the recovery time and recovery point you can promise users.

## Known gap

Backups cover the database. Storage files (audio, photos) are separate objects. If losing them is not acceptable, decide on a copy job (for example to Cloudflare R2) in an ADR. Until then, the privacy policy should say uploaded files are not part of backups.

## Drill log

One row per drill. Never write note content here.

| Date | Run by | Backup used (time) | Restore duration | Row counts match | RLS checks | Scratch deleted | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  | pass / fail |  |
