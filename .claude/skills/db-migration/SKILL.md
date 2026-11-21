---
name: db-migration
description: Add or change database schema in supabase/migrations/. Use for any new table, column, policy, function, index or storage rule, so RLS, its cross-user test and the seed are never skipped.
---

# Database migration

Rules: `CLAUDE.md` non-negotiables and ADR 0003. Every table has RLS and a pgTAP test proving user A cannot read or change user B's rows.

## Steps

1. **New file only.** `supabase migration new <snake_case_name>` creates `supabase/migrations/<timestamp>_<name>.sql`. Never edit an applied migration (the `protect-files` hook blocks it). To fix one, write a new migration.
2. **Write the change.** Follow the existing tables in `supabase/migrations/`, for example `20261121133819_books.sql`:
   - Tables go in the `app` schema. A user-owned table has `user_id text not null default app.current_user_id() references app.users (id) on delete cascade` and `unique (id, user_id)` when other tables reference it with their own `user_id`.
   - `alter table ... enable row level security`, then one policy per command (`select`, `insert`, `update`, `delete`), each `to authenticated` and checking `user_id = app.current_user_id()`. Update policies have both `using` and `with check`.
   - `revoke all ... from public, anon, authenticated`, then grant only what the API needs. Grant `update` by column list so ownership columns cannot change. `grant all ... to service_role`.
   - Add indexes for the queries the API will run, starting with `user_id`.
   - A `security definer` function sets `search_path` explicitly and returns only what the caller needs.
3. **RLS test.** One file per table in `supabase/tests/database/<table>.test.sql`, in the style of `books.test.sql`: insert users alice and bob with invented data, `set local role authenticated`, set `request.jwt.claims` to alice, and prove she cannot select, insert for, update or delete bob's rows (use the `pg_temp.affected` helper). Cover every policy and every column grant you added. Storage rules get the same test.
4. **Seed.** Update `supabase/seed.sql` with invented rows for the new table or column, for both seed users. Update `seed.test.sql` counts. Seed data is never real notes.
5. **Run locally.** `npx supabase start`, then `npx supabase db reset` (applies every migration and the seed from scratch), then `npx supabase test db`. All must pass. `npx supabase stop --no-backup` when done.
6. **Contract.** If an API response changes shape, change `packages/api-contract/openapi.yaml` first (see the `api-endpoint` skill).
7. **PR.** One migration per PR. Say what the migration does and that the pgTAP test covers every policy. Migrations deploy to dev when the PR merges (`deploy-dev.yml`). Never run `supabase db push` yourself. Risky changes (dropping or rewriting a column, a table rewrite, a policy loosened) are yellow or red: add a risk note with the `risk-note` skill.
8. **Gotchas.** If a detour was caused by surprising behaviour, add it to `docs/GOTCHAS.md`.
