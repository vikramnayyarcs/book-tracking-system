# iOS Shortcut: log a voice note

This guide shows how to build an iOS Shortcut that records a voice note and adds it to the vault as a reading session. The owner builds the Shortcut. It uses a personal access token, so no sign-in screen is needed.

Replace `WORKER_URL` with the dev gateway URL (the `workers.dev` address from the Terraform output). Do not put the token in a note, a screenshot or the repo.

## 1. Create a personal access token

You need a Clerk session token once, to create the personal token. Use the Bruno collection in `bruno/` (the `auth-clerk` folder gets a session token for a dev user).

```
POST WORKER_URL/v1/tokens
Authorization: Bearer <Clerk session token>
Content-Type: application/json

{ "name": "iPhone Shortcut", "scopes": ["sessions:write", "books:read"] }
```

The answer holds a `token` that starts with `btp_`. It is shown once. Copy it into the Shortcut's first action (a Text action named `Token`). To stop the Shortcut, revoke it with `DELETE /v1/tokens/{id}`.

The token can only: list and read books, create and read sessions, ask for an audio upload URL and start processing. It cannot change or delete anything else.

## 2. Build the Shortcut

All requests use the `Get Contents of URL` action with the header `Authorization: Bearer <Token>`.

1. **Text** `Token`: the `btp_...` token.
2. **Get Contents of URL** `GET WORKER_URL/v1/books?status=reading`. Use `Choose from List` on the `title` of each item, so you pick the book. Keep the chosen book's `id`.
3. **Record Audio**. Start and stop recording by hand. Keep the file as `m4a`.
4. **Get Details of Media** for the duration in seconds. Round it up to a whole number.
5. **Text** `Session ID`: use `Generate UUID`. The ID comes from the Shortcut, so a retry never makes a second session.
6. **Get Contents of URL** `POST WORKER_URL/v1/sessions`, JSON body:
   ```json
   { "id": "<Session ID>", "bookId": "<book id>", "date": "<today, YYYY-MM-DD>" }
   ```
   `201` means a new session. `200` means the session already existed: carry on.
7. **Get Contents of URL** `POST WORKER_URL/v1/sessions/<Session ID>/audio-upload`, JSON body:
   ```json
   { "durationSeconds": <duration>, "extension": "m4a" }
   ```
   The answer has `uploadUrl`. A `403` with code `tier_limit_reached` means the note is longer than the plan allows (3 minutes on `free`, 10 minutes on `plus`).
8. **Get Contents of URL** `PUT <uploadUrl>`, request body `File`, the recording. Set the header `Content-Type: audio/mp4`. Do not add the `Authorization` header: the URL already holds its own short-lived token.
9. **Get Contents of URL** `POST WORKER_URL/v1/sessions/<Session ID>/process`. The answer is `202`: the vault turns the note into insights in the background.
10. Optional: wait, then `GET WORKER_URL/v1/sessions/<Session ID>` until `status` is `ready` or `failed`. Show `Show Notification` with the result. On `failed`, run step 9 again.

## 3. Check it

- Run the Shortcut with a short invented note ("Test note about a sample book").
- Open the PWA, or call `GET WORKER_URL/v1/books/<book id>/insights`, to see the insights.
- Delete the test session with `DELETE /v1/sessions/<Session ID>` using a Clerk session token (a personal token cannot delete).

## Notes

- `POST /v1/sessions/{id}/process` ships with the processing task. Until it is merged and deployed, step 9 returns `404`.
- Never log, share or screenshot real notes while testing. Use invented text.
