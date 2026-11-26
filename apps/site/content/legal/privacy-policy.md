# Privacy policy

> **DRAFT, owner review.** Not published. Placeholders in `{{double braces}}` are filled in during phase 5b, when the product name, domain and contact address exist. Items marked **Owner to confirm** are facts that could not be verified from the code or infrastructure.

Last updated: {{date}}

{{product_name}} is a private place to keep notes on the physical books you read. This page says what we collect, who handles it, how long we keep it, and how you can export or delete it. It is written in plain English on purpose.

## The short version

- Your notes are private. There are no public profiles and no sharing features.
- We do not sell your data, show ads, or share your reading with anyone for marketing.
- AI features send your notes to AI providers to do the work you asked for. We call them with no-training settings, so your data is not used to train models. **Owner to confirm** each provider's setting before launch.
- You can export everything, and you can delete your account. Deleting removes all your data, audio included.

## What we collect and why

| What                                                                                                                                         | Why                                                         | Where it is kept                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| Sign-in details: your email address, and the Google or Apple account you sign in with                                                        | To sign you in and know which data is yours                 | Clerk                           |
| Your user ID, plan, time zone, daily reminder time and "not reading until" date                                                              | To run your account and send reminders                      | Supabase database               |
| Books you add: title, author, ISBN, cover link, page count, status, dates                                                                    | The core of the product                                     | Supabase database               |
| Reading sessions: date, pages, chapter, your typed note or the transcript of your voice note                                                 | The core of the product                                     | Supabase database               |
| Insights and quotes, including the original AI wording if you edited it                                                                      | To show, search and ask about your notes                    | Supabase database               |
| Search data for your insights: a list of numbers (an "embedding") made from each insight's text                                              | So search and "ask your vault" find the right notes         | Supabase database               |
| Reflection questions and your answers, ratings, reviews and AI book summaries                                                                | The finish-a-book flow                                      | Supabase database               |
| Voice recordings                                                                                                                             | To turn your voice into text                                | Supabase Storage (private)      |
| Photos: a photo of a page for quote reading, or a photo you attach when you finish a book                                                    | To read quotes from a page, or to keep with your review     | Supabase Storage (private)      |
| Monthly usage counts: voice seconds, vault questions, AI tokens used                                                                         | To apply plan limits and control our costs                  | Supabase database               |
| Push reminder details from your browser (an address your browser gives us, and two keys)                                                     | To send the reminders you switch on                         | Supabase database               |
| Personal access tokens you create for tools such as an iOS Shortcut: a name, scopes, and a one-way hash of the token (the token is not kept) | To let your own tools reach your account                    | Supabase database               |
| Request logs: time, method, path, status code and duration                                                                                   | To keep the service running and fix faults                  | Supabase and Grafana Cloud      |
| Page-load and error measurements from the app, with personal details and page content removed                                                | To see whether the app is fast and working                  | Grafana Cloud                   |
| A queue of sessions you logged while offline                                                                                                 | So nothing is lost without a connection                     | Your own device, until it syncs |

## What we never log

We never write your note text, transcripts, audio or photos to our logs, in any environment. Request logs hold only the fields in the table above. In the app's error and speed reports, error messages are replaced with "[redacted]", page addresses are reduced to a pattern such as `/books/:id`, and anything that is not a plain number or a page-speed measurement is dropped.

## Who handles your data

We use these companies to run the service. Each one sees only what its job needs.

- **Clerk** handles sign-in. It holds your email address, your sign-in method and session information. We do not store passwords; password sign-in is switched off.
- **Supabase** hosts our database, file storage and the server code behind the app. The project runs in the **UK (London, `eu-west-2`)**. Storage is private, and each file is reachable only by its owner through short-lived signed links.
- **Groq** does speech-to-text on your voice notes and runs the AI that finds insights, writes questions and summaries, answers "ask your vault" questions, and reads quote photos. It receives the audio, note text or photo needed for that one request. We do not keep your questions or the answers to them; we keep only a monthly count. **Owner to confirm** Groq's data retention and no-training terms for our account, and where Groq processes data.
- **Embeddings.** We turn each insight into search numbers with the `gte-small` model that runs inside Supabase. No other company receives your text for this.
- **Grafana Cloud** receives request logs, traces and the scrubbed app measurements described above. It never receives note text, transcripts, audio or photos. **Owner to confirm** Grafana Cloud's data region and retention period for our stack.
- **Cloudflare** serves the app and the website and sits in front of our API. It sees the network details of each request (such as your IP address and the address you ask for) while passing it on, and it filters abusive traffic.
- **Open Library** is asked when you search for a book by title or ISBN. We send the search words or ISBN, not your account details.
- **Your browser's push service** (for example Apple's or Google's) carries reminder notifications if you turn them on. The reminder says only "Time to log your reading" and contains no note content.

We do not sell your data or share it with advertisers.

## How long we keep it

- **Your notes, books, insights, reflections and reviews:** until you delete them or delete your account.
- **Voice recordings:** on the free plan, deleted right after the note is turned into text. On the paid plan, kept until you delete the session or book, or your account.
- **Quote photos:** deleted right after the page is read.
- **Review photos:** kept until you replace them, delete the book, or delete your account.
- **Usage counts:** until you delete your account.
- **Request logs and app measurements:** kept by Grafana Cloud for its retention period. **Owner to confirm** the period, and state it here.
- **Backups:** Supabase keeps database backups for a limited time, so deleted data can remain in backups until they expire. **Owner to confirm** the backup period for our plan, and state it here.
- **Sign-in records at Clerk:** until your account is deleted.

## Export and deletion

- **Export.** In Settings you can download all your books, sessions, insights, reflections and reviews as Markdown and as JSON.
- **Delete things.** You can delete a single insight, session or book. Deleting a book also deletes its sessions, insights, reflections, review and any audio or photos for it.
- **Delete your account.** Settings has a delete option. It asks you to sign in again and to type a confirmation word, then deletes your data from our database, your files from storage, and your sign-in account at Clerk. It cannot be undone, so export first. **Owner to confirm** this feature has shipped before this policy is published.
- **Other requests.** To ask for a copy of your data, to correct it, or to ask any question about it, write to {{contact_email}}. If you are in the UK or EU you also have the right to object to or limit how we use your data, and to complain to your data protection authority (in the UK, the Information Commissioner's Office).

## Who is responsible

{{legal_entity_name}} is responsible for your data. Contact: {{contact_email}}. Our legal basis for handling your data is that it is needed to give you the service you asked for. **Owner to confirm** the legal entity and whether a data protection registration is needed.

## Children

The service is not meant for people under 16. **Owner to confirm** the age limit.

## Cookies and storage on your device

The app stores your sign-in session and your offline queue on your device so it works. We do not use advertising or tracking cookies. **Owner to confirm** this stays true if the marketing site adds analytics.

## Changes

If we change this policy in a way that matters, we will tell you in the app or by email before it takes effect. The date at the top shows the latest version.
