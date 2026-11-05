# Design: new visuals

Status: draft, 2026-11-04. Agreed in conversation with Eric; for discussion, then a Claude Code session.

Repo: `EricLusk-Jopson/vinyl-periphery`. Read `CLAUDE.md` and `docs/redesign/DESIGN.md` first. Branch from `develop`, one PR per section, PR into `develop`.

Seven visuals:

| Visual | Lives on | Share image | Main data |
|---|---|---|---|
| Dependence bar | Results, stack Results | No | Active credits, result contributor ids |
| Credit barcode | Album header, library cards, result rows | Later (station markers) | Credits by role group |
| Swimlanes | Results ("People" view) | Yes | Contributor discographies, years |
| Transit map | Stack page | Yes | Stack members, shared people |
| House band | Library | Yes | All saved searches' credits |
| Credit bingo | Library | Yes | Library people, discography size |
| Year in review | Library | Yes | Library history, likes, lineage |

Colours in this doc are placeholders. Eric is setting the palette.

---

## Hard constraints

Same as `CLAUDE.md`: no Discogs calls from components, domain logic in `src/lib/` with Jest tests, tokens only, nothing under 12px, 44px touch targets, check at 390px and 1440px, `track()` for new actions (both allowlists and `docs/analytics.md`).

None of these visuals adds Discogs calls. Each uses data the app already holds: searched-album credits, discography items, the library in IndexedDB.

Share images: 1080×1080 only, rendered by `POST /api/og` (see `claude/share-image-and-missing-art.md`), watermark and tagline as the existing layouts.

---

## Shared foundations (PR 0)

Do these first. Several visuals depend on them.

### Role groups and role slots
Two levels of role mapping, in one module (`src/lib/roles.ts`, or extend whatever the periphery card's role categories use; don't keep two).
- **Groups** (5, fixed order): band, session and guests, production, engineering and mastering, art and design. Plus `other`. Used by the barcode and swimlane sorting.
- **Slots** (finer, for the house band): drums, bass, guitar, keys, vocals, horns, strings, production, engineering, mastering. A credit can fill several slots ("Bass, Vocals").
- Map from Discogs role strings, after stripping brackets ("Drums [Uncredited]") and splitting lists ("Percussion, Drums").
- **Audit before building visuals on it:** run the mapping over a sample of real searches and record the share of credits landing in `other`. If it's regularly over ~20%, extend the mapping first. Add a test fixture of awkward real role strings.
- A person's **primary group** on an album: the highest-priority group among their credits there (band > production > engineering > session > art). Pure, tested.

"Band" means the album's main artist and its members, as the pipeline already records. It is not inferred from role strings.

### Contribution
`src/lib/contribution.ts`: who accounts for the most. Used by the dependence bar and the house band.
- `resultShares(results, activeContributors)`: each result's weight of 1 is split equally among its active contributors, so shares sum to 100%. Returns per-person share and raw count (results they're on).
- `topBySlot(searches, slot, { excludeMainArtists })`: for the house band.

### Identity
Everything keys on Discogs artist id and shows the canonical artist name, never the credit's name as written ("Albini" vs "Steve Albini"). Bingo and the house band depend on this.

### Coverage
Discographies are first page only. Record per contributor whether their fetched list hit the page size (`partial: true`). Swimlanes show it; other visuals can ignore it. If `per_page=100` isn't on yet, turn it on in this PR (it changes result counts; say so).

Discography items with no year (`0` or missing) are skipped in time-based views and counted, so the UI can say "12 undated".

---

## PR 1: Dependence bar

**Goal:** show users when one or two people dominate their results, and let them act on it.

### Where
Above the result list, below the toolbar, on single-search Results and the stack Results tab. Uses active credits, so it updates with filters.

### Content
- Headline, only when concentrated: "55% of these come through 2 people". Show the headline when the top two people hold ≥40% (tune by eye). Otherwise just the bar.
- One stacked bar: top 4 people by share in the accent ramp, the rest folded into "N others".
- Below it: each of the top 4 with name, role on the searched album (muted), count and share, and a **Hide** button.

### Behaviour
- Hide writes a contributor exclusion through the existing filter state (`updateFilterState` / `useStackFilters`). Undo via toast. No separate state.
- Mobile: collapsed to the headline (or "Top: Bob Ludwig, 31%") and a thin bar; tap to expand the list.
- Hidden when fewer than 10 results or 2 active people.

### Analytics
Reuse `filter_changed` with `source: "dependence"`. Add `dependence_expanded`.

### Acceptance
- Shares sum to 100% (tested, including results with 1, 2 and many contributors).
- Hide from the bar and hide from the filter panel agree.

---

## PR 2: Credit barcode

**Goal:** a compact signature showing who made an album, by role group.

### Data caveat
Full credits exist only for **searched albums** (and so stack members and library entries). Result rows are discography items with no credits. So there are two forms:
- **Album barcode** (searched album, stack members, library cards): every person credited.
- **Link barcode** (result rows): only the searched album's people who link to that result, coloured by their primary group on the searched album. It reads as "this connects through the rhythm section".
Full barcodes for results come with the Phase 3 data dump.

### Rules
- **One bar per person**, coloured by primary group. Not one per credit.
- Fixed group order, left to right, on every barcode.
- **Second cue besides colour:** bar height by group (band full height, production and engineering shorter, session shorter again, art shortest), so it works for colour-blind users and looks like a barcode.
- **Red stays out of the groups.** Red marks connection: on the album barcode, people who link to current results get a red tick under their bar.
- Fixed width per placement (about 120px on rows, wider in headers). Above ~40 people at row width, draw proportional blocks per group instead of bars.
- Accessible name lists the group counts ("3 band, 2 production, 3 engineering…"), not every name.

### Code
- `src/lib/barcode.ts`: `albumBarcode(search)` and `linkBarcode(search, release, active)` → ordered segments. Pure, tested.
- `components/common/CreditBarcode.tsx`: renders segments as SVG. No data logic.

### Acceptance
- Same input, same output. Order is stable.
- Checked at 390px with a 50+ person album.

---

## PR 3: Swimlanes

**Goal:** the searched album's people across their careers, with the album marked.

### Where
A "People" view on Results, beside the list (toggle in the results toolbar, in the URL as `?view=people`). Share image too.

### Layout
- One lane per active contributor. Ticks for each discography item by year.
- A vertical line at the searched album's year, labelled. In a stack: one line per member, the start's in accent, the others muted.
- Ticks that are **current results** (after filters) are solid. Other items are faint. So the lanes double as a view of where results come from in time.
- Lanes sorted by primary group, then by first year.
- **Partial lanes** (coverage flag): end the lane in a hatched fade with "first 100 releases". Don't hide it.
- Desktop: names left of lanes. Mobile (390px): name above each lane, lanes full width, years fitted to width. No horizontal scrolling.
- Over ~12 lanes: show 12 by result count with "Show all N".

### Interaction
- Tap a solid tick: scroll to and highlight that result in the list (or open it in a sheet on mobile).
- Tap a name: filter to that person (existing filter state).
- Year range brush under the axis is a follow-up, not this PR. It overlaps with the decade filter idea.

### Share
Square, top 8 lanes by result count, album line labelled, wordmark.

### Analytics
`results_view_changed` (`view`), `swimlane_tick_opened`.

### Acceptance
- Undated items counted and excluded, not drawn at year 0.
- Partial lanes visibly marked.
- Tests for lane building, sorting and the partial flag.

---

## PR 4: Transit map

**Goal:** a stack drawn as a transit map: people are lines, albums are stations.

Hardest layout problem in this doc. Build after the others.

### Where
Stack page, as a third view beside Results and Albums (`?view=map`), and as a stack share layout alongside the stack map. (Open: whether it replaces the ring stack map.)

### Content
- **Stations:** stack members, plus results that sit on 2+ drawn lines (optional, capped).
- **Lines:** people on 2+ stations. Cap at ~6 lines by station count; the rest listed under the map.
- Interchanges (stations on 2+ lines) drawn larger.
- Later: the album barcode as the station marker.

### Layout
Octilinear layout (lines at 0/45/90°) is a research problem. Don't hand-roll a general solver.
- MVP: station x from `stackLayout` step, y from order within the step. Route each line through its stations in step order with 0/45/90° segments. Where several lines share a segment, offset them in parallel (fixed order by line id so they don't cross each other).
- Before building, check existing libraries (for example d3-tube-map, which renders a given layout but doesn't compute one) and whether any JS port of a metro-map layout algorithm is usable. Record the finding in the PR.
- Accept small manual tuning constants; test determinism, not beauty.

### Acceptance
- Same stack, same map.
- No station labels overlapping (tested on 2, 4, 6 and 8-member fixtures).
- Checked by eye on real stacks.

---

## PR 5: House band (library)

**Goal:** the user's house band across their whole library, as a poster.

### Where
Library page, a card above the tabs or grid: "Your house band", opening a full view with Share. A stack-only version can come later; the same function takes any set of searches.

### Calculation
- Input: all saved searches (the library), optionally filtered by the library search box.
- Per slot: the person credited in that slot on the most library albums. Tie: more total results across the library, then name.
- **Exclude each album's main artists and members by default**, otherwise a library heavy in one band returns that band. Toggle "Include band members".
- A slot needs the winner on 2+ albums, otherwise it's left off. Show at most: drums, bass, guitar, keys, vocals, plus "at the desk" (production or engineering winner). Fill others (horns, strings) only if they qualify.
- Each entry: name, slot, "on N of your records", and the covers of up to 3 of those records.
- Fewer than 3 slots filled: empty state ("Search a few more records to form a band").

### Poster
- In-app: card styled as a show bill. Share: 1080×1080, same content.
- Headliner (largest type) is the slot winner on the most albums.

### Analytics
`house_band_opened`, `house_band_toggled` (`includeMembers`), `share_created` with `layout: "house-band"`.

### Acceptance
- Tests: main artist exclusion, ties, minimum albums, multi-slot credits.

---

## PR 6: Credit bingo (library)

**Goal:** a 5×5 card of people to find on sleeves in record shops. Ties the app to the shops carrying stickers.

### Card
- 24 people plus a free centre.
- Pool: people across the library, excluding main artists, deduped by id.
- Prefer findable people: rank by fetched discography size (a proxy for prolific), then by how many library albums they're on. Skip anyone with fewer than ~20 known releases. Mix in a few less prolific names for difficulty.
- Seeded shuffle so a card is reproducible: card id = seed. "New card" makes a new seed.
- Stored in IndexedDB (new store, or a new DB as `coverCache` did): `{ cardId, seed, people, marked, createdAt }`.

### Play
- Tap to mark. Lines (row, column, diagonal) detected and announced.
- **Shop mode** (follow-up PR): "Found one?" opens search. If the searched album's credits include an unmarked bingo person, offer to mark them. Uses the existing search, no new calls.
- Print view: a print stylesheet for one card per page, with the wordmark, so people can take it into a shop.

### Share
Square image of the card with marks, the line highlighted, wordmark and URL.

### Analytics
`bingo_card_created`, `bingo_marked`, `bingo_line`, `bingo_printed`.

### Acceptance
- Same seed, same card. No duplicate people.
- Checked at 390px: 5 columns at 44px+ each with names wrapping to two lines.

---

## PR 7: Year in review (library)

**Goal:** a once-a-year summary of the library, to share.

### Where
Library page banner from 1 December to 31 January; reachable any time at `/library/year/:year`.

### Stats
All from IndexedDB. No calls.
- Searches that year (by `savedAt`).
- Deepest stack: max `lineage.depth`, with its root title.
- You kept meeting: the person in the most of that year's searches' contributors, excluding main artists.
- Most liked role group: share of liked results by the primary group of the people linking them.
- Best find: a liked result, preferring the furthest step from its root. (Open: whether likes carry timestamps; if not, fall back to the search's date.)
- Each stat drops out if its data is too thin. Under 10 searches: empty state, no share.

### Caveat
The library is per browser. A cleared browser means an empty year. Say so quietly on the page ("From this device"). Accounts would fix it; out of scope.

### Share
Square: the hero number plus four stats.

### Analytics
`year_review_opened` (`year`), `share_created` with `layout: "year"`.

### Acceptance
- Tests for each stat on fixture libraries, including empty and thin ones.

---

## Order

1. PR 0 foundations, including the role mapping audit.
2. PR 1 dependence bar, PR 2 barcode, PR 3 swimlanes. Independent of each other after PR 0.
3. PR 5 house band, PR 7 year in review (aim to ship before 1 December), PR 6 bingo.
4. PR 4 transit map.

## Open items

- Palette (Eric). Red reserved for connection.
- Role mapping audit result: share of credits in `other`.
- Dependence headline threshold.
- Whether the transit map replaces the ring stack map for sharing.
- Transit map library check.
- Whether likes carry timestamps (year in review).
- Whether `per_page=100` is already on.
- House band: is "at the desk" one slot or two (production, engineering)?

---

## Implementation notes (2026-11-04)

Added while building PR 0, PR 3 and PR 4. The rest of this doc is as agreed.

- **Built first:** foundations (the parts the swimlanes and transit map
  need), swimlanes, transit map. The dependence bar, barcode, house band,
  bingo and year in review wait. Role slots and `contribution.ts` wait with
  the house band and dependence bar, their only users.
- **Role groups** live in `src/lib/roleGroups.ts`, built on the Discogs
  headings in `roleCategories.ts` (one mapping, not two).
- **`per_page`:** already 500, newest first, up to 4 pages (2,000 items)
  per person (`MAX_DISCOGRAPHY_PAGES`). So "partial" means the cap cut a
  person's *oldest* items, and a partial lane fades at its early end, not
  "first 100 releases". Coverage is kept per contributor
  (`Contributor.discography`: items, pages, capped). Searches from before
  it have no flag and aren't marked.
- **Role audit:** not run on real searches yet (the build environment
  couldn't reach Discogs). `otherShare()` does the sum; the awkward-strings
  fixture passes. Real numbers can come from `roles_uncategorized` on
  `search_completed`, or by running `otherShare` over a library.
- **Identity:** contributors are already keyed by Discogs artist id and
  named by the artist's canonical `name`, not the credit's `anv`.
- **Transit map libraries:** `d3-tube-map` (1.5.0) only renders a layout it
  is given, and needs the DOM, so it can't run in the share renderer.
  `transit-map` (0.1.0) computes octilinear layouts with an integer
  programming solver: heavy, asynchronous and slow for a page. Neither
  used; the MVP layout is our own (`src/lib/transitMap.ts`).
