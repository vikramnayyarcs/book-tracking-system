# ADR 0003: Phase 2 data layer

- Status: Accepted
- Date: 2026-11-21
- Decider: Vikram Nayyar
- Method: `/grill-me` session, two rounds

## Context

Phase 2 builds the data layer from `docs/requirements.md` (data model, security, testing) on the foundations in ADR 0002: schema, RLS, migrations, seed data, storage buckets, Clerk as Supabase third-party auth, the usage table, and RLS tests in CI. The dev Supabase project is created by Terraform (London, `eu-west-2`); the API that uses this schema is Phase 3.

## Decision

### Access and identity

- **Tables live in a private `app` schema** that Supabase's Data API does not expose, so the raw `*.supabase.co` address cannot reach data around the WAF. The API (Phase 3) connects to Postgres directly and, per request, sets the `authenticated` role and the caller's Clerk JWT claims inside a transaction, so RLS applies to every query. The service role is for system jobs only (usage roll-ups, the daily nudge).
- **Users are keyed by their Clerk user ID** (text, the JWT `sub`). The `users` row is created on the first API call; there is no Clerk webhook.
- **No email is stored.** It is read from Clerk when needed.
- **Every table has its own `user_id`**, child tables included, defaulting to the caller's `sub`. Every RLS policy is "rows where `user_id` is the caller", for select, insert, update and delete.
- **Hard deletes**, cascading from `users` and `books`. The API removes matching storage objects (Phase 3).

### Tables

| Table | Key fields |
| --- | --- |
| `users` | `id` (Clerk ID), `tier` (`free`, `plus`), `founding_member`, `time_zone`, `nudge_time`, `not_reading_until`, `created_at` |
| `books` | one row per reading (a re-read is a new row); `isbn`, `title`, `author`, `cover_url` (link only, no copy), `page_count`, `status` (`reading`, `finished`, `abandoned`), `started_on`, `finished_on` (optional), `finished_precision` (`day`, `month`, `year`; set only with a date), `added_retrospectively` |
| `sessions` | `book_id`, `date` (user's local date), `page_from`, `page_to`, `chapter`, `note_text`, `note_source` (`typed`, `voice`), `audio_path`, `audio_seconds`, `status` (`draft`, `uploaded`, `transcribing`, `extracting`, `ready`, `failed`), `error_code` (never note text) |
| `insights` | `book_id`, `session_id` (optional), `kind` (`insight`, `quote`), `text`, `original_text` (AI output before user edits), `source` (`ai`, `user`), `page`, `pinned` |
| `reflections` | one row per question: `book_id`, `stage` (`mid`, `end`, `recall`), `position`, `question`, `answer` |
| `reviews` | one per book: `book_id`, `rating` (1 to 5), `text`, `photo_path`, `summary` |
| `usage` | one row per user per month (`month` = first day): `voice_seconds`, `vault_questions`, `ai_input_tokens`, `ai_output_tokens`, `ai_insights_deleted` |

Deleting an AI insight increments `usage.ai_insights_deleted`, so "80% of insights kept" stays measurable with hard deletes.

### Conventions

- `uuid` primary keys (`gen_random_uuid()`); `sessions`, `insights` and `reflections` accept a client-supplied ID so offline sync can retry without duplicates.
- `timestamptz` for instants; `date` for the session's local day.
- Fixed value sets are `text` with `check` constraints, not enum types.
- Standard Postgres only, so the schema moves to RDS with `pg_dump`.

### Search

- Generated English `tsvector` columns with GIN indexes on `sessions.note_text`, `insights.text` and `reviews.text` (F10).
- The `vector` extension (pgvector) is enabled now; the embedding column on `insights` is added in Phase 3, once the embeddings provider fixes its dimension.

### Storage

| Bucket | Limit | Types |
| --- | --- | --- |
| `audio` (private) | 25 MB | audio only |
| `photos` (private) | 10 MB | JPEG, PNG, WebP |

Objects live at `<user_id>/<uuid>.<ext>`; storage policies allow a user only their own first path segment. Uploads and downloads use short-lived signed URLs from the API (Phase 3). Page photos for quotes are deleted once their text is read (F7); finish photos are kept.

### Tooling

- **Migrations:** Supabase CLI SQL migrations in `supabase/migrations/`, buckets and storage policies included. `deploy-dev.yml` applies them to dev with `supabase db push` after Terraform.
- **RLS tests:** pgTAP via `supabase test db`, one test file per table, proving user A cannot select, insert, update or delete user B's rows; storage policies tested the same way. CI starts the local stack (Docker) on PRs that touch `supabase/`.
- **Seed data:** local only. Two invented users, alice and bob, with a few books, sessions, insights, reflections and a review each; used by RLS tests and demo videos. Dev stays empty for real use.

### Clerk

- Development instance; sign-in by email link and Google (Clerk's shared Google credentials in development); everything else off.
- The Clerk Supabase integration is on, adding the `role: authenticated` claim.
- Supabase trusts Clerk through Terraform (`supabase_third_party_auth`, from `DEV_CLERK_FRONTEND_API_URL`).
- Settings are recorded in `infra/clerk-checklist.md`. A CI script compares the instance's settings (`clerk config pull`, authenticated with `DEV_CLERK_SECRET_KEY`) against it.
- `DEV_CLERK_PUBLISHABLE_KEY` is a repo variable now and first used by the PWA build in Phase 4.

## Consequences

- No direct client access to Postgres, so every feature needs an API endpoint first; that is the intended design.
- The API must set role and claims correctly on every request; Phase 3 tests that a request without them sees nothing.
- One row per reading keeps queries simple; a per-book view across re-reads would need grouping by ISBN.
- The embedding column and its index arrive with a Phase 3 migration.
- Dropping email means nothing in the database can contact a user; any future email feature reads Clerk.
