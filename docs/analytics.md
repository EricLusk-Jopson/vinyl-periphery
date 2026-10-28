# Analytics

Anonymous usage events go to their own tab in the Google Sheet that
EuroVisaCalculator also uses.

```
browser  track()  ──sendBeacon──▶  /api/event  ──POST + VP token──▶  Apps Script  ──▶  "VP Events" sheet
```

- The browser sends events to our own `/api/event`, so ad blockers that block
  analytics hosts don't drop them, and the Apps Script URL and token stay on
  the server.
- `/api/event` checks the event against an allowlist, cleans the fields, adds
  the timestamp and user agent, and forwards it. It answers 204 even if the
  sheet is down. Analytics never affects the app.
- No cookies or storage. The session id is random, kept in memory, and
  changes on every page load. No IP addresses are stored. Nothing is sent if
  the browser signals Global Privacy Control or Do Not Track.

## Setup

The script serves both sites. Each sends its own token, and the token decides
the sheet: `EVC_TOKEN` writes to "Events", `VP_TOKEN` to "VP Events". Anything
without a known token is rejected.

Do these in order. EuroVisaCalculator has to be sending its token before the
script starts requiring one, or its events are rejected in between.

1. **Make two tokens**, long random values that differ, for example with
   `openssl rand -hex 24` twice.
2. **EuroVisaCalculator first.** Merge its token PR, set
   `PUBLIC_ANALYTICS_TOKEN` to the EVC token in its Vercel project, and
   redeploy. `PUBLIC_` variables are baked in at build time, so it needs a
   new build. The current script ignores the extra field, so nothing breaks.
3. **Update the Apps Script.** Open the spreadsheet, then **Extensions → Apps
   Script**, and replace the code with
   [`analytics/apps-script.js`](analytics/apps-script.js). In **Project
   Settings → Script Properties**, add `EVC_TOKEN` and `VP_TOKEN`.
4. **Deploy a new version, same URL.** **Deploy → Manage deployments**, edit
   the existing web app deployment, set **Version** to **New version**, and
   deploy. Creating a *new deployment* instead would change the URL and break
   EuroVisaCalculator.
5. **Set Vinyl Periphery's env vars in Vercel**, for **Production only** so
   previews and local dev stay out of the sheet:

   | Name | Value |
   |---|---|
   | `ANALYTICS_URL` | The web app's `/exec` URL |
   | `ANALYTICS_TOKEN` | The VP token |

   Redeploy production after adding them. While the site is still on Heroku,
   set the same two config vars there to start collecting now.

The "VP Events" tab is created with a header row on the first event. "Events"
also gains a `sessionId` column: EuroVisaCalculator already sends one, but the
old script dropped it. Add the header to column H by hand.

The Vinyl Periphery token stays on the server. EuroVisaCalculator posts from
the browser, so its token is visible in the site's JavaScript: it keeps each
site's rows in the right sheet and stops drive-by posts to the bare URL, but
anyone who reads the bundle can reuse it.

To test locally, put both Vinyl Periphery variables in `.env` and run
`npm run server`. Every action in the app then appends a row.

## Columns

| Column | Content |
|---|---|
| timestamp | Server time, ISO 8601 UTC |
| event | One of the events below |
| properties | JSON object with the event's details |
| url | Path the event happened on, e.g. `/library` |
| referrer | Where the visitor came from, origin and path only |
| userAgent | Browser user agent |
| screenWidth | Window width in CSS pixels |
| sessionId | Random per page load; groups one visit's events |

## Events

| Event | When | Properties |
|---|---|---|
| `page_view` | Every route change, including the first load | `page`: home, library, results |
| `search_started` | A search begins | `artist`, `album`, `source`: form, result or link; `by_id`: true when the album was known by Discogs id (a result row, or a link with `&master=` / `&release=`) and the text search was skipped |
| `search_completed` | Results are stored | `artist`, `album`, `seconds`, `releases_read`, `contributors`, `albums`, `roles` (distinct roles), `roles_uncategorized_count`, `roles_uncategorized` (see below), `discography_calls` (pages read across contributors), `discographies_capped` (contributors with more than `MAX_DISCOGRAPHY_PAGES` pages) |
| `search_not_found` | Discogs has no match | `artist`, `album`, `seconds` |
| `search_failed` | An error stops the search | `artist`, `album`, `phase`, `seconds`, `error` |
| `search_cancelled` | The user cancels, or leaves mid-search | `artist`, `album`, `phase`, `seconds` |
| `example_filled` | An example search fills the form | `artist`, `album` |
| `result_opened` | A result row is expanded | `rank`, `shared`, `sort` |
| `discogs_opened` | "View on Discogs" is followed | `rank`, `shared`, `sort` |
| `result_liked` | A result's heart is tapped: liked or unliked (likes belong to the album, in every search) | `liked`, `rank`, `shared`, `sort` |
| `filter_changed` | Any filter, switch, select-all or reset | `filter`, `on`; `category` for `role_category`. `filter` is one of `hide_main_artist`, `two_plus_shared`, `hide_various`, `contributor`, `role`, `all_contributors`, `all_roles`, `role_category`, `must_include_contributor`, `must_include_role`, `reset` |
| `result_credits` | An opened result's credits are fetched from Discogs (not when read from storage), once per row when every version it reads has loaded or failed | `outcome`: loaded (any version) or failed (none), `shared` (people linking it), `versions` (releases read: 1, or up to 3 for an album with several versions); when loaded, `found` (of the people, how many some version's credits name) and `hinted` (of the rest, how many have a discography role to show instead); when any failed, `failed` (how many) and `status` (HTTP status of the first, 0 offline) |
| `cover_lookup` | Every result in a search has art or is known to have none (once per search per page load) | `albums`, `hits` (art found, from storage or MusicBrainz), `misses` (no MusicBrainz link, or the lookup failed) |
| `stack_saved` | A search is added to a stack it fits, or starts one after a search on its own, from a Stack button | `members` (searches in the stack afterwards), `depth` (along its trail), `from`: results or library, `joined`: true, `new_stack`: true when it starts a stack, `moved`: true when it left another stack |
| `stack_opened` | A stack's page is opened | `members`, `ghosts` (deleted steps shown) |
| `stack_deleted` | A whole stack is deleted after confirming (library card or stack page) | `members` |
| `stack_disbanded` | A stack is disbanded after confirming: its searches stay saved, each on its own | `members` |
| `search_unstacked` | A saved search is taken out of its stack from a Stack button (results page, library card or stack page; it stays saved, on its own) | `from`: results or library, `members` (saved searches left in the stack), `depth` (its step in the stack) |
| `search_jumped` | An existing search is opened instead of running a new one | `from`: result (a result row) or form (the search bar) |
| `library_view_toggled` | The library switches between stacked and flat | `view`: stacked or flat |
| `library_searched` | The library search is used (once typing pauses) | `results`, `length` (characters typed; the text isn't sent) |
| `share_created` | Share or Download is pressed and the image is made | `layout`: map or card |
| `share_completed` | The share sheet finished, the image downloaded, or the link was copied | `layout`, `method`: share, download or link |

## Uncategorized roles

The Roles filter groups roles into Musicians, Writing, Audio, Physical media,
Management and Other, using the patterns in
`frontend/src/lib/transformers/roleCategories.ts`. `search_completed` reports
the roles that fell into Other: `roles_uncategorized` is the list joined with
`|`, cut to whole roles within the 200-character limit, and
`roles_uncategorized_count` is the full count, so a cut list shows. Every few
hundred searches, tally the values in that column, add patterns for the
common ones (with a test case each) and ship.

## Adding an event

Add the name to `AnalyticsEvent` in `frontend/src/lib/analytics.ts` **and**
`EVENTS` in `backend/handlers/event.js` (the server drops names it doesn't
know), call `track()` where it happens, and add a row to the table above.
Property values must be strings, numbers or booleans; keys are lowercase
snake_case.
