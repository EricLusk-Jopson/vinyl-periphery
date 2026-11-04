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
  - `art.js`: `GET /api/art?key=master:N` (or `release:N`) reads a cover
    from the Discogs master or release with the app's key: `{ key, thumb,
    image }`, nulls for none. The key's 60 a minute are shared with
    `/api/search` and every user, so it answers 429 without calling
    Discogs when the last seen `X-Discogs-Ratelimit-Remaining` is under
    `ART_RESERVE` (20; per instance, best effort) and passes Discogs's 429
    on. The CDN caches answers (30 days for a cover, a day for none).
  - `event.js`: `POST /api/event` validates analytics events and forwards
    them to the Google Sheet. See `docs/analytics.md`.
  - `og.js`: `POST /api/og` renders a square share image (1080x1080)
    (`@vercel/og`) from a JSON payload body (`backend/og/payload.js`, 32 KB
    at most; built by `buildPayload` in `frontend/src/lib/share.ts`): a
    map, laid out by the client,
    a list of top results, or swimlanes (`lanes`). For one search, the
    map and the list draw its top results
    as filtered and sorted on the page, with a line saying how they were
    chosen; the map groups people around the circle by role category
    (`frontend/src/lib/albumMap.ts`). The share sheet can take albums out
    or add any result; adding a hidden one switches its people on in the
    filters (`frontend/src/lib/shareSelection.ts`). Two toggles: album
    covers (off: titles and artists only) and, on that map, lines from
    each person to their albums. Names and dots there come first: covers
    move off them (`MAP_DOT_CLEAR`), and the dots are drawn last, over
    everything. For a stack, the map is of album
    overlap, not people (`frontend/src/lib/stackMap.ts`): the stack's
    albums on a ring (a regular polygon with sides one step long, the
    start at the top), and results placed by what they link
    (`placeResults`): at the weighted mean angle of their stack albums
    (weights: people shared), outside the ring beyond the one album they
    link, or inside, nearer the middle the more they link. `relaxGraph`
    then pushes covers apart (stack albums fixed) and keeps every line at
    least `MIN_LINK` long. Covers scale with the ring (the smallest scale
    whose result covers clear `COVER_FLOOR`, 64px at 1080, once fitted:
    `fitToCanvas`), and the sheet offers no more results than fit above
    that floor (`stackMapCapacity`, "Up to N for this stack"). Lines run
    edge to edge from results to the stack albums they link, muted and
    thicker for more people shared (`w`); none between the stack's own
    albums. A stack shares only as a map; its sheet
    orders the results (sort, tiebreaker, likes first) and takes albums
    out or adds them, drawing from the Results tab's filtered results. Typing "no
    boilerplate" in the sheet's album search unlocks a switch that drops
    the header and site so the graph fills the image (`nb`).
    Never calls the Discogs API; only cover images (Cover Art Archive, and
    `i.discogs.com` for `d:<path>` art, rebuilt on that host only), with
    initials when they don't load. Fonts are
    vendored in `backend/og/fonts` (SIL OFL).
    The sheet's controls edit a draft (`ShareDraft`); the image is made
    once on open (after covers, up to `COVER_WAIT_MS`) and then only on
    Regenerate. The preview is that image's blob, which is also the file
    shared or downloaded, with no link. While the draft's payload differs
    from the image's (`draftChange`: covers found since, or anything
    else), the preview dims and the action is Regenerate. Drafts and the
    last image are kept per search or stack in memory while the page is
    open (`src/lib/shareDrafts.ts`). The sheet also has the page's filter
    switches (`src/lib/filterToggles.ts`: one list per mode, used by the
    filter panels too) and, for a stack, its albums (one switched off
    leaves the ring, `stackMembersOn`). They change the page's own filter
    state, not a copy, so the image is always of the page. "More filters"
    closes the sheet and opens the page's filters (`requestFilters`,
    `useFilterRequest`; a stack page moves to its Results tab). Old `/s?…&to=…` links (from when
    shares carried one) redirect client-side to `to` (`legacyShareTarget`).
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
    `useCoverArt` gives rows Cover Art Archive URLs as they resolve.
    Covers still missing (a MusicBrainz miss, or an archive image that
    failed to load: `AlbumCover` reports it) can be fetched from Discogs,
    only when the user presses "Find N missing covers" (`FindCovers`,
    `useFindCovers`: share sheet and both Results lists). `src/api/
    discogsArt.ts` asks `/api/art` one key every 1.5s and stops on a 429,
    with no retry. Answers are stored on the cover entry (`discogs`,
    misses rechecked after 30 days); rows prefer the archive, then the
    Discogs thumb, and share images use the full-size one (`large`).
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
    `roleCategories.ts` puts roles under the headings of Discogs's credits
    list, which the Roles filter groups by (Vocals, Instruments, Featuring &
    Presenting, Conducting & Leading, Writing & Arrangement, Production,
    Remix, DJ Mix, Technical, Visual, Acting, Literary & Spoken,
    Management, Other). Every Discogs role is listed by name in
    `discogsRoles.ts`; other spellings fall back to their endings, plurals
    and common words.
  - `src/lib/releases.ts`: discography items to results. Each result has a
    `type` and a `key` (`"master:N"` / `"release:N"`); `SearchCache.releases`
    is keyed by `key`. Searches stored before keys existed are migrated as
    they load (`migrateSearch`).
  - Likes and hides: each result row ends in one slot (`AlbumMark`): "⋯"
    opens Like and Hide; a liked album shows a filled heart there, a
    hidden one a crossed-out eye, and tapping either undoes it. A hidden
    album isn't liked. A like belongs to the album (its
    result key), so it shows in every search; kept in localStorage by
    `src/services/likes.ts` (`useLikes`). Liked albums fill in the share
    map. Hides are kept the same way (per album, in
    `src/services/hidden.ts`, `useHidden`): hidden albums leave the
    results unless "Show hidden albums" (`filterState.showHidden`) is on,
    and never go into a share image.
  - `src/lib/roleGroups.ts`: five coarse role groups (band, session and
    guests, production, engineering and mastering, art and design, plus
    other) on top of the Discogs headings, for the visuals. "Band" is the
    main artist and members (`Contributor.sources`), not a role string.
    `primaryGroup` picks band > production > engineering > session > art.
    `Contributor.discography` records how much of each person's
    discography was read (`capped`: the page cap cut their oldest items).
    The visuals' plan is `features/new-visuals.md`.
  - Swimlanes (`src/lib/swimlanes.ts`, `components/people/`): a People
    view on Results (`?view=people`) and a People tab on a stack page.
    A lane per person who counts under the filters, ticks by year (solid:
    current results they link; faint: their other items), a line at the
    searched album's year (one per stack album, the start's in the
    accent). Lanes sort by primary group, then first year; 12 shown, then
    "Show all". Undated items are counted, not drawn; lanes the page cap
    cut short are hatched before their first year. Tapping a lane picks
    the nearest results year; its results open in the list
    (`useFocusResult`). A name toggles "must include". Share: "People" in
    the search's sheet (`lanes` payload, top 8 lanes).
  - `src/lib/filters.ts`: chip state, "must include" (`filterState.required`,
    optional because older saved searches lack it), active filter count.
    "Only liked albums" is `filterState.likedOnly` (also optional). A new
    search (and Reset) has every contributor on but only the musicians'
    roles (Vocals, Instruments, Featuring, Conducting) and Other
    (`defaultRoleStates` in `lib/results.ts`); results start
    sorted Most shared, then Popular (`useResultsSort`).
  - `src/components/ui/`: shadcn primitives. Edit sparingly.
  - `src/lib/stacks.ts`: searches grouped by `lineage.stackId` (two or more
    make a stack), the stack's root, and the stacks a search fits
    (`stacksThisFits`: a member has it in its results; the Stack drawer
    offers them, each with what links it by role category:
    `src/lib/linkSummary.ts`). A stack is a graph (`stackLayout`): albums link
    when one is in the other's results, and each member's step is its
    fewest links from the root; members nothing links fall back to their
    trail, with its deleted steps ghosted. No stack entity is stored.
    `stackLayout` also gives each member its parents (linked albums one
    step closer to the start), which the stack page's Albums tab turns into
    a link line per card (`linkLineText`).
  - A stack's Results tab reads its searches as one album:
    `src/lib/metaAlbum.ts` (takes any set of searches: credits, people
    deduped with their albums, results merged less the members; the share
    map's `stackResults` is built on it). `src/lib/stackFilters.ts` filters
    it by credit, with member albums as a filter too (off, or required in "must include"),
    and scores links (member albums linking a result with someone who
    counts) and shared; default sort links, then shared, then Popular.
    Filters are stored per `stackId` in IndexedDB (`stack-filters`, DB v3,
    `useStackFilters`), start with every chip on, and are deleted by the
    cache once the stack is under two searches. Searching from a result
    hangs the new search on the member sharing the most people. Share
    draws the filtered results.
  - Routes (React Router): `/` home, `/library`,
    `/library/stack/:stackId` (Albums tab; `?view=results` for Results), and
    `/results?artist=…&album=…`, plus `&master=N` or `&release=N` when the
    Discogs album is known. A results page's back link goes where it was
    opened from (a stack or the library); otherwise to the stack its search
    is in, or the library (`useResultsBack`). A results URL names the album, not a cached
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

- Contributor discographies are read 500 items a page, newest first
  (`discographyUrl`: `sort=year&sort_order=desc`), up to
  `MAX_DISCOGRAPHY_PAGES` (4, so 2,000 items) per person. The few people
  past the cap lose their oldest credits (`discographies_capped` on
  `search_completed` counts them). Discogs's default order grouped items
  by role first, which cost the latest Appearance credits instead.
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
- Most Discogs calls go from the browser unauthenticated.
