# SEAblings Status Handoff - 2026-06-07

## Summary

SEAblings is a working local Next app with a partial Zymix-style product shell and a wired backend capture pipeline. It is not yet a fully integrated live demo loop.

The strongest working demo path right now is:

```text
Login -> Zymix chat/profile -> Bucket list category overview -> fixture demo pages showing pooled spots/planner story
```

The intended real product loop is only partially connected:

```text
TikTok/Instagram share -> provider enrichment -> saved bucket item -> bucket list -> planner
```

Backend capture is mostly wired, but live Supabase migration, real social metadata fetch, bucket detail UI, and planner FSM are still the main missing pieces.

## Verified Locally

Last verified in `/Users/jeffcheng/Projects/seablings`:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Build warning only: Next middleware convention is deprecated and should eventually move to `proxy`.

GitNexus is installed but this repo is not indexed.

## Built

- Demo auth/login with PIN sessions and protected `/`, `/me`, `/bucket-list`, `/chat/*`.
- Zymix-style mobile shell: chat list, group chat, profile, bucket-list entry.
- Chat messages API: `/api/zymix-messages`, optimistic send, seeded fallback, Supabase realtime path if table exists.
- Bucket item APIs: list/create/status update.
- Capture API: `/api/captures` creates a task, runs extraction/enrichment/embedding flow, and writes saved bucket items.
- Gemini extraction and Perplexity enrichment are wired server-side.
- Price is normalized to `$ / $$ / $$$`.
- Enrichment metadata exists: provider, status, source links, confidence note.
- Embedding generation/storage code exists using `gemini-embedding-001`.
- Supabase schema and enrichment migration exist.
- Backfill dry-run script exists.
- Demo pages `/demo/[persona]` and `/demo/control` show the pitchable fixture flow.

## Partially Built

- Bucket list: category overview and empty state exist, but per-category drilldown, checklist rows, detail bottom sheet, visited checkbox, filters, and Open Now are not built.
- Capture pipeline: wired, but synchronous inside the request. It is not a durable background queue.
- Provider ingestion: Gemini/Perplexity path exists, but EnsembleData TikTok/Instagram metadata fetching is not actually implemented yet.
- Screenshot support: payload is accepted, but screenshot image content is not actually analyzed.
- Embeddings: can be generated/stored, but are not used for retrieval, ranking, or planner logic.
- Supabase: code supports it, but live Supabase is behind the local schema.

## Not Built

- Full `@planner` finite-state machine.
- Criteria collection dialog.
- Voting dialog.
- Waiting boxes/counters.
- Vote tallying.
- Confirmed plan card.
- Google Calendar deep link.
- Real planner scoring from live saved bucket items.
- iOS/Xcode share extension device validation.
- Deployment-ready instructions / demo PIN docs.
- Clean committed/reproducible repo state.

## Critical Blocker

Live Supabase is currently out of sync with the code. The configured Supabase instance is missing:

- `bucket_item_embeddings`
- enrichment metadata columns
- normalized category/price data

Live Supabase capture or embedding writes may fail until this migration is applied:

```text
supabase/migrations/20260606_place_enrichment_contract.sql
```

Then run the backfill script in dry-run first:

```bash
node scripts/backfill-place-enrichment.mjs --dry-run --limit 20
```

Only run apply after explicit approval:

```bash
node scripts/backfill-place-enrichment.mjs --apply --limit 100
```

## Other Risks

- Current local `.env.local` points at Supabase, so the app chooses Supabase mode when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set.
- Most data APIs are not session-authorized. `bucket-items` and capture reads trust request IDs/query params. This is acceptable for hackathon demo but not production.
- Demo PINs are hardcoded in source and not documented in `README.md`.
- The repo is dirty with many untracked runtime-critical files. Redeploy/recovery from repo HEAD is risky until changes are committed.
- Bottom nav has inert controls for Discover/Play/Apps; judges can tap dead controls.

## Current Dirty/Untracked Implementation Areas

Relevant current work includes:

- `.env.example`
- `app/api/captures/route.ts`
- `app/api/auth/`
- `app/api/zymix-messages/`
- `app/bucket-list/`
- `app/login/`
- `components/demo/bucket-panel.tsx`
- `components/demo/control-panels.tsx`
- `components/demo/planner-panels.tsx`
- `components/zymix/bucket-list-screen.tsx`
- `components/zymix/chat-list-screen.tsx`
- `components/zymix/group-chat.tsx`
- `components/zymix/login-screen.tsx`
- `components/zymix/persona-session.tsx`
- `components/zymix/profile-screen.tsx`
- `lib/domain.ts`
- `lib/fixtures.ts`
- `lib/server/auth.ts`
- `lib/server/ingestion-pipeline.ts`
- `lib/server/place-categories.ts`
- `lib/server/providers.ts`
- `lib/server/store.ts`
- `lib/server/validation.ts`
- `lib/zymix/data.ts`
- `middleware.ts`
- `scripts/backfill-place-enrichment.mjs`
- `supabase/schema.sql`
- `supabase/migrations/20260606_place_enrichment_contract.sql`

## Notion Sources Consulted

- SEAblings Source of Truth: Build Status + Task Plan
- SEAblings Build Overview and Team Split
- AI Ingestion Plan: Location-Only SEAblings Pipeline
- PRD: Bucket List Feature
- PRD: Agent Planner Bot
- AI Agent Architecture & LLM Setup

## Recommended Next Steps

1. Apply the Supabase enrichment migration and verify live schema.
2. Run `scripts/backfill-place-enrichment.mjs` in dry-run, then apply only after approval.
3. Add demo/operator instructions with login PINs and a clear judge path.
4. Either hide inert navigation controls or make them harmlessly route back to built screens.
5. Build the bucket list drilldown/detail path, because this is the most visible missing UI after category overview.
6. Decide whether the final demo uses static `/demo/*` planner panels or invests in the actual `@planner` FSM.
7. Commit or otherwise preserve the current runtime-critical untracked files before switching terminals.
