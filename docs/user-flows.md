# User flows

Every way through Vinyl Periphery as it stands, with where each flow starts,
its steps, what it costs the user, the analytics that measure it, and what
gets in the way. It's for deciding which flows to make shorter, which to
surface, and which to measure better. Recommendations are at the end of each
flow and ranked at the bottom.

Screens: Home (`/`), Library (`/library`), Stack (`/library/stack/:id`,
Albums and Results tabs), Results (`/results?artist=…&album=…`). Sheets and
drawers open over them: Filters (phones), Share, Stack, Destack.

## The core loop

1. **Search** an album (about a minute).
2. **Read** its results: albums ranked by how many of its people worked on
   them.
3. **Follow** one of them: search from a result, which joins a stack.
4. **Collect**: like, hide, filter; the library keeps everything.
5. **Share** an image of what was found.

Steps 1 and 2 are well served. Step 3 is the app's distinctive move and,
until now, was the hardest to find (see flow 6). Step 5 was reworked in #112
and #113.

## 1. First search (typed)

- **Starts at:** Home hero form, or the header's compact form on any other
  page (from md; on phones the header's search icon goes Home).
- **Steps:** type artist and album (or tap a "Try" example), Find
  connections. `/api/search` finds the Discogs album; the progress view
  replaces the hero; when it finishes, Results opens if the user is still
  watching, otherwise a "Results ready" toast offers it.
- **Branches:**
  - Album already in the library: a dialog offers to open it or run it
    again.
  - Not found: a toast, and the search button shakes.
  - Discogs error: a toast.
  - The user can hide the progress (a slim status bar stays) or cancel.
- **Events:** `search_started` (`source`), `search_completed`,
  `search_not_found`, `search_failed`, `search_cancelled`,
  `example_filled`.
- **Friction:**
  - "How it works" now ends with "Follow the credits" (stacks), but says
    nothing of likes or sharing.
  - The search is always a root: an album already in another search's
    results gets no stack unless the user uses the Stack drawer (flow 7).

## 2. Reading results

- **Starts at:** a finished search, a library card, a recent search on Home,
  a shared results link (on a device without the search, the page offers
  "Run this search").
- **Steps:** scan the ranked rows (cover, title, artist, year, "via" names,
  shared count, popularity); tap a row to open its credits (who did what on
  both albums, fetched 2.5s apart and cached); "Find an album" pins one
  result; "Show more" pages on.
- **Events:** `result_opened`, `result_credits`, `results_searched`,
  `result_picked`, `discogs_opened`.
- **Friction:** a row's main tap opens credits, which is right, but it was
  also the only way to reach "Search from this album" (now also in ⋯,
  flow 6).

## 3. Filtering and sorting

- **Starts at:** the Filters sidebar (desktop) or Filters sheet (phones), the
  sort menus above the list, and the Share sheet's "From this page" box.
- **Steps:** switches (hide the artist's own releases, 2+ shared, hide
  Various Artists, only liked, show hidden), must include (people or roles),
  contributor and role chips, Reset. Sort plus a tiebreaker (the tiebreaker
  menu only from 1024px).
- **Events:** `filter_changed` (`filter`, `on`, `from`), `chip_details`.
- **Friction:**
  - The tiebreaker is desktop only on the page but offered on phones in the
    Share sheet.
  - A new search shows only the musicians' roles; people who search for a
    producer's or engineer's work have to find the Roles group first.

## 4. Likes and hides

- **Starts at:** the "⋯" at the end of a row (Like, Hide). A liked or
  hidden row shows a heart or a crossed-out eye there, which opens the
  same menu with Unlike or Show again.
- **Effect:** a like belongs to the album and shows in every search; hidden
  albums leave the results (unless "Show hidden albums") and never go into
  an image. A toast offers Undo on hide.
- **Events:** `result_liked`, `result_hidden`.
- **Friction:** likes have no page of their own: "Only liked albums" works
  per search or stack, not across the library.

## 5. Library

- **Starts at:** Library in the header, "View library" on Home.
- **Steps:** Stacks or All; search by album or artist; open a card (a
  search's results, or a stack's page); a card's stack icon opens the Stack
  drawer; delete with Undo.
- **Events:** `library_view_toggled`, `library_searched`, `stack_opened`,
  `page_view`.
- **Friction:** the empty library says searches are kept but not how a
  stack is made.

## 6. Searching from a result (how stacks grow)

- **Starts at:** any result row, on a search's Results page or a stack's
  Results tab.
- **Before this change:** open the row, then "Search from this album", a
  text link after "View on Discogs". Nothing said it would join a stack or
  take a minute. An album already searched showed "Open your search" only.
- **Now:**
  - "Search from this album" is back where it was, the text button in the
    open row's footer, and is also the first item of every row's "⋯"
    menu, which now opens on liked and hidden rows too (with Unlike and
    Show again). A route button on every row (tried in #114) crowded the
    row's right edge and was removed.
  - The first row a user opens shows a one-time tip: search from this
    album, here or in any row's ⋯ menu, to follow its credits: a new
    search (about a minute) that joins this stack, or starts one. "Got it"
    dismisses it for good.
  - Home's "How it works" has a fourth step, "Follow the credits".
  - An album already in the library shows "Open your search", and "Stack
    it…" when that search is outside this stack (opens the Stack drawer).
- **What happens:** the new search's lineage continues the parent's trail
  (`childLineage`), so it joins the parent's stack. From a stack's Results
  tab it hangs on the member sharing the most people. The search runs as
  flow 1, from the known Discogs id, skipping `/api/search`.
- **Events:** `search_started` with `source: "result"`, `search_jumped`
  (`from: "result"`) when an already searched album is opened.
- **Still open:** after the tip is dismissed, nothing on the page names the
  stack a search will join until it's run.

## 7. Putting a search into a stack by hand

- **Starts at:** Stack on a results page header, a library card's stack
  icon, or "Stack it…" on a result row (new).
- **Steps:** the Stack drawer lists where the search could go: its current
  stack, every stack that has it in a member's results (with what links
  them), searches on their own it could start a stack with, and Standalone.
  Switch moves it.
- **Events:** `stack_saved`, `search_unstacked`.
- **Friction:** the drawer only offers stacks whose albums have this one in
  their results, which is right, but a user who wants to group two
  unrelated searches can't, and isn't told why beyond one line.

## 8. A stack's page

- **Albums tab:** the stack's searches by step from the start, each with a
  link line (which album it came from, through whom); deleted steps appear
  as ghosts with "Search again"; each card opens its results.
- **Results tab:** the members read as one album, filtered (with member
  albums as a filter) and sorted by links; searching from a result adds to
  this stack (flow 6).
- **Actions:** Share, Destack (takes the whole stack apart, with a
  confirmation).
- **Events:** `stack_view_changed`, `stack_filters_applied`,
  `stack_disbanded`, plus the result events.
- **Friction:** the Results tab has no "Find an album" search, unlike a
  search's results.

## 9. Sharing an image

- **Starts at:** Share on a results page or a stack page.
- **Steps (since #112, #113):**
  1. Picture.
  2. Albums: one count, plus the page's sort and filters.
  3. People.
  4. Look.
  5. Fine-tune.

  Then Make image, Regenerate after changes, and Share or Download. Reset
  image settings restores the sheet's defaults.
- **Events:** `share_regenerated` (`first` on Make image),
  `share_created`, `share_completed`, `share_reset`,
  `share_more_filters`, `covers_requested`, `covers_found`.
- **Friction:** adding an album the filters hide switches its people on in
  the page's filters, a change to the page that's easy to miss.

## 10. Coming back

- **Starts at:** Home's Recent searches, the library, a results or stack
  URL (bookmarked or shared).
- **Friction:** no "continue where you left off" for an unfinished stack
  beyond Recent searches, which lists searches, not stacks.

## Stack formation, evaluated

How a stack forms today:

| Route | Joins a stack? | Discoverability |
|---|---|---|
| Search from a result row | Yes, the parent's | Was low (inside an open row); now a button on every row |
| From a stack's Results tab | Yes, that stack, on the member sharing most | Same |
| Typed search of an album already in a result list | No, a root | None until the Stack drawer |
| Opening a result already searched | No | Now offers "Stack it…" |
| Stack drawer (header, library card, row) | Yes, if a member's results have it | Medium: a header button |
| A results link from another device | No, a root | None |

Findings:

- Stacks are a side effect of one action (searching from a row). That
  keeps them meaningful (every link is real), but the action was hidden and
  never explained.
- A typed search never joins a stack even when it could; the Stack drawer
  can fix it, but nothing suggests it. The fit is already computed
  (`stacksThisFits`), so the results page could say "This album is in the
  results of Stack Album 0 + 2. Stack it?" when a fit exists.
- "Open your search" used to be a dead end for stacking; it now offers
  "Stack it…".

## Recommendations, ranked

1. **Done:** search from a result in the row's footer and its ⋯ menu,
   explained once by a tip, with "Stack it…" for albums already searched.
2. **Suggest a stack after a typed search** when `stacksThisFits` finds one
   (a one-line banner under the header with Stack it and Dismiss).
3. **Teach the loop on Home:** done for "How it works" (step 4, "Follow
   the credits"); the empty library could say the same.
4. **"Find an album" on a stack's Results tab,** like a search's.
5. **One tiebreaker rule:** offer it on phones on the page too, or not in
   the Share sheet.
6. **A liked albums view** across the library.
7. **Make the Share sheet's filter change visible:** a toast with Undo when
   adding an album switches people on in the page's filters.
8. **Measure the loop:** a funnel of `search_started` by `source` (form,
   result, link), `stack_saved`, and `share_completed` per session would
   show how many users ever follow a result. Examples count as `form`
   (with `example_filled` before them).
