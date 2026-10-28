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
  - `og.js`: `GET /api/og?p=…` renders a square share image (1080x1080)
    (`@vercel/og`) from a payload in the URL (`backend/og/payload.js`;
    built by `frontend/src/lib/share.ts`): a map of a stack (or one
    search) and the liked albums around it, laid out by the client
    (`frontend/src/lib/shareMap.ts`), or a list of top results. Never calls Discogs; only Cover
    Art Archive images, with initials when they don't load. Fonts are
    vendored in `backend/og/fonts` (SIL OFL).
  - `share.js`: `/s?p=…&to=…` (rewritten to `/api/share`) serves Open Graph
    tags for a shared link, then redirects to the app.
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
    discography lists the album (`EnrichedRelease.contributions`; older
    searches have `appearances`, the first entry only). A master row reads
    the versions its people are listed on (`versionTargets`).
  - Album art: `src/api/musicbrainz.ts` maps Discogs URLs to MusicBrainz
    ids in batches (about 1 request a second), `src/api/coverArt.ts` queues
    them with rows on screen first, `src/services/coverCache.ts` keeps the
    mappings (misses too) in their own IndexedDB database, and
    `useCoverArt` gives rows Cover Art Archive URLs as they resolve. No
    Discogs image calls.
  - `src/contexts/cache/`: search results, filter state, persistence. Every
    search goes into the library (IndexedDB, `src/services/db.ts`) as it
    finishes and stays until deleted; filter changes are written as they
    settle. There's no session store or Save button. (`savedSearchIds`
    lists every search; the name is older than this.)
  - `src/lib/lineage.ts`: how each search was reached (`SearchCache.lineage`).
    Searches from a result row continue their parent's trail; everything
    else is a root, so searching from a result row adds to that row's stack.
    Stored as snapshots, never derived. Its `stackId` says which stack a
    search is in; its steps are only a fallback for
    placing it (see `stackLayout`).
  - `src/lib/transformers/`: role and name cleanup, with Jest tests.
    `roleCategories.ts` puts roles into the buckets the Roles filter groups
    by (Musicians, Writing, Audio, Physical media, Management, Other).
  - `src/lib/releases.ts`: discography items to results. Each result has a
    `type` and a `key` (`"master:N"` / `"release:N"`); `SearchCache.releases`
    is keyed by `key`. Searches stored before keys existed are migrated as
    they load (`migrateSearch`).
  - Likes: a heart on each result row. A like belongs to the album (its
    result key), so it shows in every search; kept in localStorage by
    `src/services/likes.ts` (`useLikes`). Liked albums fill in the share
    map.
  - `src/lib/filters.ts`: chip state, "must include" (`filterState.required`,
    optional because older saved searches lack it), active filter count.
  - `src/components/ui/`: shadcn primitives. Edit sparingly.
  - `src/lib/stacks.ts`: searches grouped by `lineage.stackId` (two or more
    make a stack), the stack's root, and the stacks a search fits
    (`stacksThisFits`: a member has it in its results; the Stack drawer
    offers them, each with what links it by role category:
    `src/lib/linkSummary.ts`). A stack is a graph (`stackLayout`): albums link
    when one is in the other's results, and each member's step is its
    fewest links from the root; members nothing links fall back to their
    trail, with its deleted steps ghosted. No stack entity is stored.
  - Routes (React Router): `/` home, `/library`,
    `/library/stack/:stackId`, and
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

- Contributor discographies are read 500 items a page, up to
  `MAX_DISCOGRAPHY_PAGES` (4, so 2,000 items) per person. Discogs sorts them
  by role group (Main, production credits, Appearance), then year, so the
  few people past the cap lose their latest Appearance credits first
  (`discographies_capped` on `search_completed` counts them).
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
  keep every entry per person (`EnrichedRelease.contributions`, each with
  its version), and an opened master row reads credits from those versions,
  up to `MAX_CREDIT_VERSIONS` (3). The result's own `mainRelease` is still
  the first contributor's.
- "Exclude main artist" matches the first word of the typed artist name.
- Most Discogs calls go from the browser unauthenticated.
