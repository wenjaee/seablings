# SEAblings

SEAblings is a ZYMIX-style hackathon MVP that turns social inspiration into real plans. Friends save places from TikTok, Instagram, screenshots, or text into personal bucket lists, then use `@planner` in the SEAblings group chat to collect constraints, shortlist places, vote, and confirm a plan.

The judged experience is the mobile web app. The repo also includes a source-first iOS share-extension spike for posting native captures into the same Next.js API.

## Current Product

- ZYMIX-style mobile shell with demo persona login, chat inbox, group/DM chat, profile, bottom nav, and bucket list.
- Personal bucket list with six live categories: Cafe, Restaurant, Nightlife, Activity, Culture, and Shopping.
- Category drill-in with visited toggles, price/status/open filters, Google Maps links, and item detail sheets.
- API-backed ZYMIX chat with Supabase realtime when configured and polling fallback otherwise.
- Live `@planner` flow in `/chat/seablings` for Jeff, Praya, and Tana.
- Planner criteria collection for availability, budget, and vetoes, with aggregate criteria generation, shortlist scoring, voting, final plan card, vote counts, celebration overlay, cancel/remove actions, and `.ics` calendar export.
- Capture ingestion endpoint that can run EnsembleData, Gemini, Perplexity, and Gemini embeddings when keys are configured, with demo fallbacks for reliability.
- Static judge fallback dashboards under `/demo/*`.
- Source-only iOS host app and share extension that posts URL/text/image captures to `/api/captures`.

## Tech Stack

- Next.js 16 App Router with React 19 and TypeScript.
- Tailwind CSS v4 and `lucide-react`.
- Optional Supabase persistence through `@supabase/supabase-js`.
- Optional provider integrations:
  - EnsembleData for TikTok/Instagram metadata.
  - Gemini 2.5 Flash for extraction and planner criteria aggregation.
  - Gemini Embeddings for 768-dimensional bucket item embeddings.
  - Perplexity Sonar Pro for place enrichment and photo lookup.
- Node.js `>=22 <23`.

## Quick Start

The app runs without external services. If Supabase and provider env vars are blank, it uses in-memory demo fixtures.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

There is no test script yet.

## Demo Login

Demo PIN auth is defined in `lib/server/auth.ts`. Login sets an HTTP-only `sea_demo_session` cookie.

| Persona | Handle | PIN | Postcode | Default budget |
| --- | --- | --- | --- | --- |
| Jeff | `@jeff` | `1111` | `E1 6AN` | `35` |
| Praya | `@praya` | `2222` | `SW9 8JH` | `28` |
| Tana | `@tana` | `3333` | `N1C 4QP` | `32` |
| Tester | `@tester` | `4444` | `SE10 9NF` | `20` |

Recommended happy path: log in as Jeff with `1111`.

## Demo Routes

Auth-gated mobile app:

| Route | Purpose |
| --- | --- |
| `/login` | Persona PIN login. |
| `/` | ZYMIX-style chat inbox. |
| `/chat/seablings` | SEAblings group chat with live `@planner`. |
| `/chat/[id]` | DM/group chat thread. |
| `/me` | Profile, stats, wallet/friends rows, logout, bucket-list entry. |
| `/bucket-list` | Redirects to `/me/bucket-list`. |
| `/me/bucket-list` | Sticker-style bucket category overview. |
| `/me/bucket-list/[category]` | Per-category saved place list and detail sheet. |

Unauthenticated judge/demo views:

| Route | Purpose |
| --- | --- |
| `/demo/control` | Control-room view with capture queue, pooled spots, criteria, and recommendations. |
| `/demo/jeff` | Jeff persona dashboard. |
| `/demo/praya` | Praya persona dashboard. |
| `/demo/tana` | Tana persona dashboard. |
| `/demo/tester` | Tester persona dashboard. |

## Happy Path

1. Open `/login`.
2. Select Jeff and enter `1111`.
3. Open the SEAblings group chat.
4. Send `@planner`.
5. Submit Jeff's availability, budget, and vetoes.
6. Repeat as Praya and Tana in separate sessions or browsers.
7. Vote on the shortlist cards.
8. Confirm the final plan and open the calendar export.
9. Visit `/me/bucket-list` to inspect saved places by category.

If anything goes wrong during a live demo, use `/demo/control` and the `/demo/[persona]` routes. They render from fixtures and do not require login.

## Environment

Copy `.env.example` to `.env.local` only when you want live services.

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Enables Supabase mode only when paired with `SUPABASE_SECRET_KEY`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Browser Supabase client key for realtime. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported by the client helper. |
| `SUPABASE_SECRET_KEY` | Optional | Server-side Supabase service key. Do not expose publicly. |
| `SEA_DEMO_AUTH_SECRET` | Optional | HMAC secret for demo persona cookies. Falls back to a dev string if absent. |
| `SEA_CAPTURE_BEARER_TOKEN` | Optional | Protects `/api/captures` and `/api/bucket-items/photos` when set. Leave blank for local demos. |
| `ENSEMBLEDATA_TOKEN` | Optional | Fetches TikTok/Instagram metadata for URL captures. Bare social URLs require this unless extra text context is supplied. |
| `GEMINI_API_KEY` | Optional | Gemini extraction, embeddings, and planner aggregate criteria. Missing key triggers fixture/heuristic fallback. |
| `PERPLEXITY_API_KEY` | Optional | Place enrichment and photo lookup. Missing key preserves extraction-only/fallback fields. |
| `NEXT_PUBLIC_DEMO_API_BASE_URL` | Optional | Demo API base URL for local/device flows. |

## Persistence Modes

### In-Memory Demo Mode

Default mode when Supabase env vars are missing.

- Seeds personas, chat messages, bucket items, planner criteria, recommendations, and planner sessions from local fixtures.
- Resets when the Node process restarts.
- Best for local judging rehearsals and UI work.

### Supabase Mode

Enabled only when both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set.

- Uses tables from `supabase/schema.sql` and `supabase/migrations/*`.
- Stores personas, ingestion tasks, bucket items, bucket item photos, embeddings, ZYMIX messages, planner sessions, planner criteria, and recommendations.
- Adds realtime support for `zymix_messages` when the migration is applied.
- Demo RLS policy for `zymix_messages` grants anon/authenticated SELECT for realtime. This is not production-grade access control.

To initialize a Supabase project, run `supabase/schema.sql` and the SQL files in `supabase/migrations/` through the Supabase SQL editor or your migration workflow. The migrations are written to be rerunnable for the demo project.

## Capture Pipeline

Main endpoint:

```text
POST /api/captures
```

Payload shape:

```json
{
  "userId": "jeff",
  "sourceType": "tiktok",
  "sourceUrl": "https://...",
  "text": "optional text",
  "screenshotName": "optional image name",
  "screenshotBase64": "optional base64 image data"
}
```

Current flow:

1. Validate payload and optional bearer token.
2. Create an ingestion task.
3. Demo seed shortcut: any TikTok capture currently inserts the hand-curated DakaDaka saved item for a reliable live demo.
4. Otherwise resolve TikTok/Instagram metadata through EnsembleData when configured.
5. Extract visitable places with Gemini, including inline video extraction when possible.
6. Enrich places with Perplexity.
7. Generate Gemini embeddings when configured.
8. Save enriched places directly as `saved` bucket items.

Capture processing is synchronous inside the request for the MVP. There is no durable queue or worker yet.

## Planner Flow

The live planner is scoped to the SEAblings group thread and the three planner participants: Jeff, Praya, and Tana.

API-backed state lives behind:

```text
GET    /api/planner-session
DELETE /api/planner-session
POST   /api/planner-session/criteria
POST   /api/planner-session/vote
POST   /api/planner-session/cancel
GET    /api/planner-session/calendar
```

State machine:

1. `@planner` in `group:seablings` creates or resumes a planner session.
2. Session starts in `collecting`.
3. Jeff, Praya, and Tana submit availability, budget, and vetoes.
4. The backend aggregates criteria using Gemini when available, otherwise a heuristic fallback.
5. Saved bucket items are scored and shortlisted.
6. Session moves to `voting`.
7. Each participant votes for 1 to 3 shortlist items.
8. Session moves to `completed` with winning item(s), vote counts, proposed time, final plan card, and calendar export.

Tester can log in but cannot view or mutate planner sessions.

## API Surface

| API | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Demo PIN login. |
| `/api/auth/logout` | `POST` | Clear demo session cookie. |
| `/api/auth/me` | `GET` | Current persona. |
| `/api/captures` | `GET`, `POST` | Capture tasks and ingestion pipeline. |
| `/api/bucket-items` | `GET`, `POST` | List/create bucket items. |
| `/api/bucket-items/[id]/status` | `PATCH` | Mark own bucket item saved/completed/etc. |
| `/api/bucket-items/photos` | `POST` | Perplexity photo backfill for saved items. |
| `/api/zymix-messages` | `GET`, `POST` | Chat messages and `@planner` trigger. |
| `/api/zymix-messages/summary` | `GET` | Latest message preview for inbox. |
| `/api/planner-session` | `GET`, `DELETE` | Load/remove latest planner session. |
| `/api/planner-session/criteria` | `POST` | Submit planner criteria. |
| `/api/planner-session/vote` | `POST` | Submit planner votes. |
| `/api/planner-session/cancel` | `POST` | Cancel active planner session. |
| `/api/planner-session/calendar` | `GET` | Generate `.ics` calendar file for completed plan. |

## Repository Layout

```text
app/                         Next.js routes and API handlers
components/zymix/            Mobile ZYMIX-style app screens
components/planner/          Planner dialogs, cards, and overlays
components/demo/             Unauthenticated judge dashboards
lib/domain.ts                Shared product/domain types
lib/fixtures.ts              Seed personas, bucket items, criteria, recommendations
lib/demo/                    Derived fixture data for /demo routes
lib/server/                  Auth, validation, store abstraction, providers, ingestion
lib/planner/                 Calendar helpers and planner types
lib/zymix/                   ZYMIX persona/thread helpers and browser Supabase client
public/stickers/             Bucket category sticker PNGs
supabase/                    Schema and idempotent demo migrations
ios/                         Source-first iOS app/share-extension spike
scripts/                     Supabase maintenance/backfill scripts
```

## iOS Share Extension Spike

The `ios/` folder is source material for a native capture proof point. It is not a checked-in Xcode project.

It contains:

- `ios/SEAblingsApp/`: minimal SwiftUI host app.
- `ios/SEAblingsShareExtension/`: share extension that reads URL, text, web page, and image input.
- `ios/Shared/CaptureConfig.swift`: API URL, bearer token placeholder, and default user.

Before device testing:

1. Create an Xcode app project and add the files as described in `ios/README.md`.
2. Start the Next app on the LAN:

   ```bash
   npm run dev -- -H 0.0.0.0
   ```

3. Update `ios/Shared/CaptureConfig.swift` with the Mac LAN IP.
4. If the IP changes, update `allowedDevOrigins` in `next.config.mjs` so Next dev assets hydrate on the phone.
5. Set `bearerToken` only if `SEA_CAPTURE_BEARER_TOKEN` is configured on the server.

The share extension intentionally keeps provider secrets off-device.

## Maintenance Scripts

Supabase enrichment audit/backfill:

```bash
node scripts/backfill-place-enrichment.mjs --dry-run
node scripts/backfill-place-enrichment.mjs --apply --limit 100
```

The script requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It defaults to dry-run and only mutates with `--apply`.

## Known MVP Gaps

- Demo-grade auth only. Persona PINs are hard-coded, and several APIs are not production-authorized beyond demo needs.
- Capture processing is synchronous; no durable queue, retry worker, or background processor.
- Screenshot base64 and carousel/image URLs are not yet sent to Gemini as image parts.
- Large videos fall back to caption/text extraction; no Gemini Files API upload path.
- Embeddings are stored but not yet used for retrieval or planner ranking.
- Bucket list has category overview, drill-in, filters, visited toggle, and detail sheet, but no full add/edit/delete/import UI.
- Several ZYMIX controls are visual demo affordances: new chat, Activity, Search, Discover/Play/Apps tabs, wallet/settings/action buttons, camera/sticker/voice controls.
- Planner waits indefinitely for all participants; no reminders, timeout, or non-response path.
- Planner distance and postcode handling are demo-level, not full routing/travel calculation.
- iOS is a source-first spike and still needs a generated Xcode project and device verification.

## Product Docs Used

Current implementation source of truth is in Notion. Older docs are background if they conflict with the source-of-truth page.

- [SEAblings Hub](https://app.notion.com/p/37796e34cb0a804b8242ef435a6a3237)
- [SEAblings Source of Truth: Build Status + Task Plan](https://app.notion.com/p/37796e34cb0a811eb85bcdfa852c7a77)
- [SEAblings Build Overview and Team Split](https://app.notion.com/p/37796e34cb0a81a3b974c8131845d958)
- [PRD: Bucket List Feature](https://app.notion.com/p/37796e34cb0a81aeae59e478f0818ee8)
- [PRD: Agent Planner Bot](https://app.notion.com/p/37796e34cb0a811c8d92f32c1b892090)
- [AI Ingestion Plan: Location-Only SEAblings Pipeline](https://app.notion.com/p/37796e34cb0a81fdb8e6f849d9271985)
- [Demo Flow: Native Capture + Web Zymix Emulator](https://app.notion.com/p/37796e34cb0a819dabbdfc8047384353)
