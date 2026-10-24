# Redesign spec

The goal is a site that looks and feels professional on phone and desktop. The
current one reads as a homebrew project: red borders on everything, a display
font used for body text, 9.6px footer text, an animated background competing
with the content, and results that hide why they matched.

This spec covers the UI only. The search pipeline, Discogs calls, cache shape
and scoring do not change during the redesign. Those come after, with the move
to Vercel.

- Tokens, type and colour rules: [tokens.md](tokens.md)
- Reference screens: [reference/](reference/). Each `.dc.html` file is a
  self-contained mockup with inline styles. Use them as the visual reference
  for layout, spacing, sizes and copy. Rebuild them as React and Tailwind; do
  not copy the markup. The sample data in them is illustrative.

| Screen | Reference |
|---|---|
| Home, desktop | `reference/Home.dc.html` |
| Search in progress, desktop | `reference/Searching.dc.html` |
| Results, desktop (interactive: filters work) | `reference/Results.dc.html` |
| Home, mobile (390px) | `reference/MobileHome.dc.html` |
| Results, mobile | `reference/MobileResults.dc.html` |
| Filters, mobile (superseded: now a full-screen frame, see Layout) | `reference/MobileFilters.dc.html` |

## Direction

Dark, quiet and typographic, like a record sleeve and its liner notes.

- Near-black ground, one red accent used sparingly.
- Bebas Neue only for display text. IBM Plex Sans for reading. IBM Plex Mono
  for credits and metadata.
- The TV-static identity survives as a faint, static grain texture behind the
  home hero and the album header. Nothing animates in the background.
- Every result says why it is there: the shared contributors are visible
  without expanding anything.

## Layout

- Breakpoints: Tailwind defaults. Three layouts: phone (below `md`, design
  at 390px, check 320px), tablet (`md` to `lg`, design at 768px) and desktop
  (`lg` up, design at 1440px). Each screen should fit a phone without
  sideways scrolling and with the main action on the first screen.
- Header: 64px desktop, 56px mobile, bottom border, not fixed. On phones the
  logo is the disc only, and on results a back chevron sits before it.
- Home: hero with eyebrow, display headline, one-paragraph explainer, search
  form in a surface panel, example searches, recent searches, how it works,
  footer. Phones drop the explainer and example searches so the form fits on
  the first screen.
- Results: album header band (cover, eyebrow, title, artist, year,
  contributor count, Save) over a two-column body. Filters sidebar 280–320px
  on the left from `lg` up; results list takes the rest. Below `lg` a sticky
  toolbar (count, sort, Filters button with the active count) sits above the
  list, and the filters slide in from the right: full screen on phones, a
  420px panel on tablets.
- After a search, the search form moves into the header as a compact form
  (two inputs and an icon button) from tablet up, and a search icon on phones.

## Components

Each row says which current file it replaces. Build new components under
`frontend/src/components/` in the folder named, delete the old file in the
same PR, and keep props minimal.

| Component | Replaces | Notes |
|---|---|---|
| `layout/AppShell` | `App.tsx` layout markup | Header, `<main>`, footer. No background canvas |
| `layout/Header` | `layout/Header.tsx` | Wordmark (disc mark plus "Vinyl Periphery" in Bebas), Library link with label on desktop, icon on mobile. Compact search on every page but home |
| `layout/Footer` | `layout/Footer.tsx` | One row on desktop, stacked on mobile. Links in `muted-foreground` 14px. Discogs attribution 13px. Drop the yellow coffee badge for a text link; drop the rate-limit apology |
| `layout/Grain` | `layout/TVStaticEffect.tsx`, `lib/colors/paletteExtractor.ts` | Static SVG `feTurbulence` noise, `aria-hidden`, 10–14% opacity, positioned behind a section. Remove `extract-colors` and the `images.weserv.nl` proxy |
| `search/SearchForm` | `searchForm/SearchForm.tsx` | Variants: `hero` (labels above, large) and `compact` (header). Labels are real `<label>`s. Do not clear the inputs on failure |
| `search/SearchProgress` | `common/ProgressButton.tsx` | Album header, stage list (done, active, pending), progress bar with `role="progressbar"`, "21 of 48 · about 1 min left", cancel button. ETA from remaining calls × delay |
| `results/AlbumHeader` | heading in `ReleaseList.tsx` | Cover (or tinted placeholder with initials), eyebrow, title, meta, Save |
| `results/ReleaseRow` | `resultsDisplay/ReleaseCard.tsx` | Cover 56px, title, artist · year, mono "via" line with shared names, right side "N shared" plus up to four dots. Expands in place (`aria-expanded`) to show each shared person with their roles on the searched album, "View on Discogs", and "Search from this album" |
| `results/ReleaseList` | `resultsDisplay/ReleaseList.tsx` | Count, sort select, rows, "Show more" (20 at a time) instead of numbered pages, empty state with Reset |
| `filters/FilterPanel` | `resultsDisplay/FilterActions.tsx`, `ContributorList.tsx`, `RoleList.tsx` | Same content in sidebar and sheet. Switches for the three toggles, Reset link, contributor chips with a name filter input, role chips |
| `filters/Chip` | `common/FilterButton.tsx` | `<button aria-pressed>`. Three states that differ in more than colour: included (raised fill, emphasis border), excluded (transparent, struck through), unavailable (dashed border, faint). Shows a count of matching albums in mono |
| `filters/Switch` | outline buttons in `FilterActions.tsx` | `<button role="switch" aria-checked>`, 44px row |
| `filters/FilterFrame` | right-side `Sheet` in `Header.tsx` | Radix dialog sliding in from the right, full screen on phones and 420px on tablets. Top bar with back and Reset, pinned "Show N albums" |
| `library/LibraryPage` | `resultsDisplay/HistoryPanel.tsx` | The `/library` page, linked from the header and the home page. Tabs for this session and saved, as cards with Save and Delete always visible. Sorted by time, not by id |

Tooltips are not used for information the user needs. Contributor roles show
in the expanded row and in the chip's accessible name.

## Copy

- Plain and short. Sentence case for everything except the display type.
- Main action: "Find connections".
- Search hint under the form: "A full search takes 1 to 3 minutes. Discogs
  limits how quickly we can read its data."
- Results count: "62 albums". Score: "2 shared". Filters: "Hide Pink Floyd
  releases" (use the searched artist's name), "Only albums with 2+ shared",
  "Hide Various Artists".

## Accessibility

- Real `<button>`, `<a>`, `<input>` with `<label>`. Icon-only buttons have
  `aria-label`.
- Visible focus: 2px `ring` outline.
- Contrast per tokens.md. Nothing under 12px.
- The filters frame and dialogs trap focus and close on Escape (Radix does this).

## Phases

Each phase is one PR into `develop`. Every PR must pass `npm run lint`,
`npx tsc -b`, `npm test` and `npm run build` in `frontend/`, and be checked at
390px and 1440px.

1. **Foundation.** Tokens as CSS variables, one Tailwind theme, Plex fonts,
   favicon and meta tags, delete `App.css`, migrate components off the old
   custom scale keys, fix lint errors. This document and `CLAUDE.md`. No
   visible redesign yet beyond colours and borders.
2. **Layout shell.** `AppShell`, `Header`, `Footer`, `Grain`. Remove
   `TVStaticEffect`, palette extraction, the pause button and the
   `extract-colors` dependency. The Filters sheet trigger stays in the header
   until phase 6.
3. **Home and search form.** Hero, `SearchForm` (both variants), examples,
   recent searches, how it works.
4. **Search in progress.** `SearchProgress` replaces the progress button.
   Needs a cancel path: an `AbortController` threaded through the mutations.
5. **Results.** `AlbumHeader`, `ReleaseList`, `ReleaseRow`.
6. **Filters.** `FilterPanel`, `Chip`, `Switch`, sidebar on `lg+`,
   `FilterSheet` below. Remove the header Filters trigger.
7. **Library and cleanup.** `LibraryPage` and routing (`/`, `/library`, `/results/:searchId`). Remove legacy token aliases from
   `tailwind.config.js` and any component left unused.

## Out of scope for the redesign

Changing what data is fetched, how results are scored, the cache context, or
the backend. If a UI change needs new data (cover art for the searched album,
release counts), use what the current pipeline already returns and note the gap
in the PR.
