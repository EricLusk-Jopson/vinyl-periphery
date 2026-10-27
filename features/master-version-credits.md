# Credits for the right version of a master

Status: proposed, not built.

## The problem

When a contributor's discography lists a **master**, the app reads that
master's credits from its **main release**. Discogs picks the main release,
and it is often not the version the contributor is credited on.

In a real example, the master for The Lonesome Crowded West (51539) has 27
versions. Its main release is the 2022 Vinyl Me, Please reissue (22460452),
not the 1997 original. Anyone credited only on the original, a reissue's
liner notes or a bonus track shows as "Not in the main release's credits".

Two smaller causes give the same result:

- **Aliases.** Someone credited under an alias has a different artist id, so
  matching by id misses them.
- **Thin credits.** Some versions list fewer credits than others.

## What already exists

- Opening a result fetches its credits once and keeps them in localStorage
  (`frontend/src/api/releaseCredits.ts`, `services/creditsCache.ts`).
- When the credits don't name someone, the row shows how that person's own
  discography lists the album, e.g. "Appears on some tracks (Trailer Trash)".
  This comes from the `role` and `trackinfo` fields the search already
  receives, so it costs no extra calls.
- The `result_credits` analytics event records, per fetch, how many people
  were `found` in the credits and how many of the rest were `hinted` by their
  discography. Those two numbers decide whether the work below is worth it.

## Option 2: "Check other versions" (recommended next)

When a person isn't in the main release's credits, show a **Check other
versions** button next to the fallback note. Don't run it automatically.

### How it works

1. **Find the version.** The browser calls a new backend endpoint, e.g.
   `GET /api/credited-versions?name=<contributor>&master=<id>&title=<album>&artist=<artist>`.
   The endpoint runs a Discogs database search with
   `type=release&credit=<name>&release_title=<title>&artist=<artist>`, using
   the app's key and secret.
   - Database search needs authentication, so it has to go through the
     backend. `backend/handlers/search.js` already holds an authenticated
     client.
   - Authenticated calls have their own limit (60 a minute), separate from
     the browser's unauthenticated 25.
   - Discogs can't filter search by master, so the endpoint keeps only the
     results whose `master_id` matches the requested master.
   - It returns them earliest first: the original is the most likely to
     carry full credits.
2. **Read its credits.** The browser fetches the first match through the
   existing credits queue (`fetchReleaseCredits` with
   `{ kind: "release", id }`), so it's stored under `release:N` like any
   other release.
3. **Show where it came from.** The person's line gets their roles plus the
   version, e.g. "Guitar, Vocals · from the 1997 CD (UP44)". If no version
   names them, it says "Not credited on any version Discogs can find" and
   the button goes away.

### Details to get right

- **Names.** Discogs disambiguates names with a suffix such as
  "Nicole Johnson (2)". Strip it before searching (the contributor display
  pipeline already does). Match the fetched credits by artist id, and also
  by the credited spelling (`anv`, e.g. "I. Brock").
- **Storage.** Store the answer per master and person (e.g.
  `master:51539:artist:260715` → release id, or "none"), so each lookup
  happens once. It can share the credits store and its 500-entry limit.
- **Backend.** Add the handler in `backend/handlers/`, re-export it from
  `api/`, mount it in `backend/server.js` (Heroku still runs from `main`),
  and add `node:test` tests next to it. Validate and length-limit every
  query parameter.
- **Analytics.** Add `version_checked` with `outcome` (found, none, failed),
  to both allowlists and `docs/analytics.md`.

### Cost

One authenticated search and one release fetch per person checked, only
when someone presses the button.

## Option 3: fall back to the original release

For names the search can't match, such as heavy name variants:

1. Fetch `/masters/{id}/versions?sort=released&sort_order=asc&per_page=5`.
2. Read the oldest one or two releases through the credits queue.
3. Match by artist id and by `anv`.

Cap it at two extra releases, and run it only from the same button, after
option 2 finds nothing. This is the slower and less certain path, so it
should only cover what option 2 misses.

### Cost

One versions call plus up to two release fetches, at 2.5s each in the
queue, so up to about 7.5 seconds.

## Not doing

- **Reading every version automatically.** The example master has 27
  versions, which is more than a minute of Discogs's unauthenticated budget
  for one row.
- **Changing the scoring.** These lookups explain a connection that's
  already there; they don't add or remove results.

## When to build

Watch `result_credits` for a few weeks. If a meaningful share of shared
people are neither `found` nor `hinted` on master results, build option 2.
Then build option 3 only if option 2's `none` outcomes stay common.
