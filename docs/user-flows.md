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
3. **Follow** one of them: search from a result, then group albums
   linked by their credits into named stacks.
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
  - A new search joins no stack; nothing yet suggests the stacks it could
    join (recommendation 2).

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
- **Steps:** two tabs, **Albums** (first and the default: every search,
  newest first) and **Stacks** (with **New stack**). One search box filters the tab
  on screen: albums by title or artist, stacks by name or any album in
  them. An album card notes the stack it's in ("In My trail", "In 3
  stacks"), opens its results, and its Stacks button opens its Stacks
  drawer (flow 7). A stack card opens the stack's page.
- **Deleting:** albums are deleted only from their own results page (with
  Undo); stacks only from their own page.
- **Events:** `library_view_toggled` (`view`: stacks or albums),
  `library_searched` (`tab`), `stack_opened`, `page_view`.

## 6. Searching from a result

- **Starts at:** any result row: "Search from this album" in its footer or
  its ⋯ menu.
- **What happens:** a new search of that album (about a minute), straight
  into the Albums tab. It joins no stack by itself: stacks are made and
  filled on purpose (flows 7 and 8). The first row a user opens shows a
  one-time tip saying so.
- **Already searched:** the row offers "Open your search", and "Add to
  stacks…" on a search's results (its Stacks drawer), or "Add to this
  stack" on a stack's Results tab when it isn't in that stack yet (a
  result of the stack always links to it).
- **Events:** `search_started` (`source: "result"`), `search_jumped`,
  `stack_album_added` (`from: "results"`).

## 7. Making and filling stacks

- **New stack:** from the Stacks tab, or "New stack with this album" in an
  album's Stacks drawer. The stack editor asks for a name (the start's
  title by default) and albums: pick any album to start, then add albums
  that link to one already in. Albums that don't link yet are listed
  greyed, saying "Not linked to the stack yet", with a note above the
  list on the rule; adding others can link them. Make stack opens the
  stack's page.
- **An album's Stacks drawer** (results page header "Add to stack" / "In
  N stacks", library and stack cards): every stack, those holding it with
  Remove, those it links to with Add and what links them, and the rest
  greyed with why. An album can be in any number of stacks.
- **Taking an album out** (drawer or editor) that leaves others with no
  link back to the start asks first ("This breaks the stack's links");
  they stay, under "Not linked to the start", until linked again or taken
  out.
- **Events:** `stack_created`, `stack_album_added`, `stack_album_removed`.

## 8. A stack's page

- **Header:** Share, **Edit** (the stack editor: rename, add or take out
  albums), **Delete stack** (confirm, then Undo; its albums stay).
- **Albums tab:** the stack's albums by step from the start, each with a
  link line (which album links it, through whom); then any not linked to
  the start; then any deleted from the library (ghosted, with Search to
  run them again, which puts them back in place).
- **Results tab:** the albums read as one, filtered and sorted.
- **Events:** `stack_view_changed`, `stack_filters_applied`,
  `stack_edited`, `stack_deleted`, plus the result events.
- **Friction:** the Results tab has no "Find an album" search, unlike a
  search's results.

## 9. Sharing an image

- **Starts at:** Create visual on a results page or a stack page.
- **Steps (since #112, #113):**
  1. Picture.
  2. Albums: one count, plus the page's sort and filters.
  3. People.
  4. Look.
  5. Fine-tune.

  Then Make image, Regenerate after changes, and Share or Download. Reset
  image settings restores the sheet's defaults.
- **The People picture** works differently: its steps are Picture, Years
  (From and To), People (how many, who's drawn with Remove, and a search to
  add anyone) and Appearance. It marks every album each person worked on
  in those years, so there's no album count, page filters box or album
  fine-tune. Transit's People step has the same picker.
- **Captions** are one sentence on what the image shows.
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

## How stacks form

Stacks are made on purpose, not as a side effect of searching:

| Route | What it does |
|---|---|
| Stacks tab, New stack | Name it, pick a start, add linked albums |
| An album's Stacks drawer, New stack with this album | The same, starting from that album |
| An album's Stacks drawer, Add | Into any stack it links to |
| A stack's Results tab, "Add to this stack" | An album already searched, into this stack |
| A stack's Edit | Rename, add, take out |

The rule is the same everywhere: an album joins only if it links to one
already in the stack, and the interface greys out the rest and says why.
Before DB v4, stacks were the searches sharing a lineage; those became
named records once, keeping their ids (and filters).

## Recommendations, ranked

1. **Done:** stacks as named records with their own tab, editor and
   delete; albums in any number of stacks; search from a result in the
   row's footer and ⋯ menu, explained once by a tip.
2. **Suggest stacks after a search** when `stackOptionsFor` finds stacks it
   links to (a one-line banner under the header with Add and Dismiss).
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
