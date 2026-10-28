# Vinyl Periphery

A web app that finds albums connected to one you like through shared credits:
session musicians, producers, engineers, designers. It searches Discogs for the
album, reads everyone credited on it, fetches each person's discography, and
ranks albums by how many of those people worked on them.

## Layout

- `api/`: Vercel Functions, one file per endpoint. Each re-exports a handler
  from `backend/handlers/`.
- `backend/handlers/`: the request handlers, written against the subset of
  `req`/`res` that both Express and Vercel's Node runtime provide
  (`req.query`, `req.body`, `res.status().json()`, `res.setHeader()`). Tests
  use `node:test` next to each handler.
  - `search.js`: `GET /api/search` proxies the first Discogs search with the
    app's key and secret.
  - `health.js`: `GET /api/health`.
  - `event.js`: `POST /api/event` validates analytics events and forwards
    them to the Google Sheet. See `docs/analytics.md`.
- `backend/server.js`: Express server that mounts the same handlers, for
  local development (and Heroku until the move to Vercel is finished). In
  production mode it also serves `frontend/dist`.
- `vercel.json`: build settings, the SPA fallback to `index.html`, and asset
  caching.
- `frontend/`: React 18, TypeScript, Vite, Tailwind 3, shadcn/ui (Radix),
  TanStack Query.
  - `src/api/`: Discogs calls and the search pipeline (as mutations).
    `releaseCredits.ts` reads what each person did on a result album, fetched
    when its row is first opened (`useReleaseCredits`), queued 2.5s apart,
    and kept in localStorage by `src/services/creditsCache.ts`. When the
    credits don't name someone, the row falls back to how their own
    discography lists the album (`EnrichedRelease.appearances`).
  - Album art: `src/api/musicbrainz.ts` maps Discogs URLs to MusicBrainz
    ids in batches (about 1 request a second), `src/api/coverArt.ts` queues
    them with rows on screen first, `src/services/coverCache.ts` keeps the
    mappings (misses too) in their own IndexedDB database, and
    `useCoverArt` gives rows Cover Art Archive URLs as they resolve. No
    Discogs image calls.
  - `src/contexts/cache/`: search results, filter state, persistence
    (sessionStorage and IndexedDB). sessionStorage holds unsaved searches
    only, within `SESSION_BUDGET_CHARS` (`src/lib/sessionBudget.ts`): a
    search that wouldn't fit is blocked with a prompt to make room.
  - `src/lib/lineage.ts`: how each search was reached (`SearchCache.lineage`).
    Searches from a result row continue their parent's trail; everything
    else is a root. Stored as snapshots, never derived.
  - `src/lib/transformers/`: role and name cleanup, with Jest tests.
    `roleCategories.ts` puts roles into the buckets the Roles filter groups
    by (Musicians, Writing, Audio, Physical media, Management, Other).
  - `src/lib/releases.ts`: discography items to results. Each result has a
    `type` and a `key` (`"master:N"` / `"release:N"`); `SearchCache.releases`
    is keyed by `key`. Searches stored before keys existed are migrated as
    they load (`migrateSearch`).
  - `src/lib/filters.ts`: chip state, "must include" (`filterState.required`,
    optional because older saved searches lack it), active filter count.
  - `src/components/ui/`: shadcn primitives. Edit sparingly.
  - Routes (React Router): `/` home, `/library` (`?tab=saved`), and
    `/results?artist=…&album=…`, plus `&master=N` or `&release=N` when the
    Discogs album is known. A results URL names the album, not a cached
    search, so it works on any device: without the search cached, the page
    offers to run it. Each search has a `target` (`src/lib/searchTarget.ts`):
    the first search result's master, or the clicked row's master or
    release. Searches started from a row skip `/api/search`
    (`src/api/searchTarget.ts`). Old `/results/:searchId` links redirect. Route helpers
    live in `src/lib/routes.ts`.
- `docs/redesign/`: the current UI redesign. Read `DESIGN.md` before any UI
  work.
- `features/`: proposals for features not built yet, one Markdown file each.

## Commands

From `frontend/`:

- `npm run dev`: Vite on 5173, proxies `/api` to localhost:5000
- `npm run lint`, `npx tsc -b`, `npm test`, `npm run build`

From the repo root:

- `npm run server`: backend with nodemon (needs `CONSUMER_KEY` and
  `CONSUMER_SECRET` in `.env`)
- `npm test`: backend handler tests (`node --test`)

Hosting: moving from Heroku to Vercel. See `docs/deploy.md`. Until the DNS
switch both run from `main`, so keep `backend/server.js` and
`heroku-postbuild` working.

## Rules

- Branch from `develop`, PR into `develop`. `main` is release.
- UI work follows `docs/redesign/DESIGN.md` and `docs/redesign/tokens.md`.
  Use the token names (`bg-surface`, `text-muted-foreground`, `border-strong`,
  `font-display`). No hex values or arbitrary colours in components.
- The legacy theme names (`text-text-primary`, `bg-bg-primary`,
  `primary-main`, `font-primary`, `font-secondary`) are gone; don't bring
  them back.
- Nothing smaller than 12px. Touch targets at least 44px.
- Check every UI change at 390px and 1440px wide.
- Keep domain logic (filtering, scoring, Discogs parsing) out of components so
  it can be tested on its own.
- The redesign does not change data fetching, scoring or the cache shape.
  Note any data gap in the PR instead.
- New user-facing actions worth measuring get a `track()` call
  (`src/lib/analytics.ts`). Add the event name to both allowlists and to the
  table in `docs/analytics.md`.
- Discogs allows 25 requests a minute unauthenticated, 60 authenticated. Do not
  add Discogs calls from components.

## Known issues (not fixed yet)

- Contributor discographies only read the first page of results (100 items).
  Discogs sorts them by role group (Main, production credits, Appearance),
  then year, so prolific people lose most of their later work: Jim Keltner
  has 1,445 items, Steve Albini 1,775.
- In `/artists/{id}/releases`, release-type items carry no `master_id`
  (none of 32 sampled from Keltner and Albini): they are releases with no
  master (compilations, promos, singles; confirmed for 2429544, whose own
  release record has no `master_id`, unlike releases that belong to one).
  Albums with versions come as one master item, so duplicate versions are
  rare. A release folds into a master only when the master's
  `main_release` is that release.
- An item's `main_release` is the release where that person has that role,
  not the master's main release: the same master can appear several times
  with different ones (In Utero: Producer 465796, Remix 4943830). Results
  keep the first contributor's, and a second role on the same master is
  dropped.
- "Exclude main artist" matches the first word of the typed artist name.
- Most Discogs calls go from the browser unauthenticated.
