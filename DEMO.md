# SEAblings — Demo Run Guide

ZYMIX-style group trip planner. Hackathon demo, runs fully on in-memory fixtures (no DB/keys needed).

## Run it

```bash
npm install
npm run dev
```

- Opens on **http://localhost:3000** (Next.js default).
- **No env vars required.** Supabase / LLM keys (`GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `SUPABASE_*`) are optional — leave blank to use the in-memory store. Copy `.env.example` to `.env.local` only if you want live providers.

## Login PINs

Pick a persona tile on `/login`, then enter its PIN. (Defined in `lib/server/auth.ts`.)

| Persona | Handle  | PIN  |
|---------|---------|------|
| Jeff    | @jeff   | 1111 |
| Praya   | @praya  | 2222 |
| Tana    | @tana   | 3333 |
| Tester  | @tester | 4444 |

**Recommended demo login: Jeff / 1111.**

## Judge click-path (the happy path)

1. Go to **/** → middleware redirects to **/login** (auth-gated).
2. Tap **Jeff**, enter **1111**, Continue → lands on the **chat list** (`/`).
3. Open the **SEAblings** group chat → **/chat/[id]** (group planning view).
4. Tap profile → **/me** (persona profile + owned spots).
5. Tap into the **bucket list** → **/bucket-list** (categorized place overview: Bakery, Cafe, Restaurant, Bar, Nightlife, Activity, Culture, Shopping, Other).

Auth-gated routes (redirect to `/login` if no session): `/`, `/me`, `/bucket-list`, `/chat/*`.

## Fixture pages (`/demo/*`) — open WITHOUT logging in

These are static, fixture-seeded views for judges (not behind auth):

| URL              | What it shows |
|------------------|---------------|
| `/demo/control` | SEAblings "control room" — judge overview across all personas |
| `/demo/jeff`    | Jeff's persona view (budget, postcode, planner context) |
| `/demo/praya`   | Praya's persona view |
| `/demo/tana`    | Tana's persona view |
| `/demo/tester`  | Tester's persona view |

Tip: if the logged-in flow misbehaves, fall back to `/demo/control` and the per-persona pages — they always render from fixtures.
