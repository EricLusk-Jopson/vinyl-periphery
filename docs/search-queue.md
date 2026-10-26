# Search queue (plan, not built)

How to keep the app's Discogs key under its rate limit once usage grows. This
is a plan for later: the busiest minute so far had 4 searches, and the
authenticated limit is 60.

## What the limit actually covers

Only one call per search uses the app's key: `GET /api/search`
(`backend/handlers/search.js`), which proxies `/database/search` with
`CONSUMER_KEY` and `CONSUMER_SECRET`. Every other call (releases, band
members, discographies) goes from the user's browser, unauthenticated, and
counts against that user's own 25 a minute. That stays as it is.

So the shared budget is **60 searches started per minute across all users**,
not 60 Discogs calls per search. Discogs counts it as a moving average over
60 seconds, and reports it on every response in `X-Discogs-Ratelimit`,
`X-Discogs-Ratelimit-Used` and `X-Discogs-Ratelimit-Remaining`.

Production, previews and local development all use the same key
(`docs/deploy.md`), so they share the budget too.

## The idea

When the server is near the limit, a new search waits for a turn instead of
failing. The user sees that the site is busy and roughly how long the wait is.
Once a slot frees up, the server runs the Discogs search and the page moves
into the normal progress panel. The browser does the rest of the work exactly
as it does today.

### Fold the preflight into the search call

A separate preflight ("is there room?") followed by the search has a race:
two browsers can both hear "yes" for the last slot. It also adds a round trip
to every search, including the usual case where the site is idle.

Instead, `GET /api/search` becomes the preflight:

- **Room now:** it runs the search and returns `200` with the Discogs
  response, as it does today. No extra latency.
- **Busy:** it returns `202` with a ticket instead of results:

  ```json
  { "status": "queued", "ticket": "t_8f3…", "position": 3, "retryAfter": 4, "etaSeconds": 12 }
  ```

  plus a `Retry-After` header. The browser calls
  `GET /api/search?band=…&album=…&ticket=t_8f3…` again after `retryAfter`
  seconds. Each poll returns either a new `202` (updated position) or the
  `200` with results once the ticket reaches the front and there is room.

Checking the budget and recording the call happen in one atomic step on the
server, so two requests can never take the same slot.

The server runs the search during one of those polls, not in the background.
A Vercel function cannot outlive its request, and holding a request open for a
long wait would run into function time limits.

### Shared state

Vercel runs each request in whichever function instance is free, so the count
and the queue can't live in memory. They need a small shared store: Redis
through the Vercel Marketplace (Upstash has a free tier). Hide it behind an
interface so handlers and tests don't depend on Redis:

```js
// backend/services/searchBudget.js
reserve(ticket?)              // -> { ok: true } | { ok: false, ticket, position, retryAfter }
record(headers)               // update from X-Discogs-Ratelimit-* after each Discogs call
backOff(seconds)              // after a 429 from Discogs
release(ticket)               // optional: user cancelled
```

- A Redis implementation for Vercel (and Heroku while it lasts), with the
  check-and-record step as one Lua script.
- An in-memory implementation for local development and `node:test`. The
  handler already takes its Discogs client as an argument
  (`createSearchHandler(getClient)`); the budget would be passed in the same
  way.

### Counting

- **Own count:** a sorted set of call timestamps for the last 60 seconds.
  Before each search, drop entries older than 60 seconds and count the rest.
- **Discogs' count wins:** after each response, store
  `X-Discogs-Ratelimit-Remaining`. If Discogs reports less room than our own
  count, use Discogs' figure. That covers previews and local development
  sharing the key.
- **On a 429 from Discogs:** treat the budget as full for a while (60 seconds,
  or `Retry-After` if Discogs sends one) and queue everyone.
- **Headroom:** cap at 50, not 60, leaving room for retries
  (`fetchWithRetry` can make up to 3 attempts) and the gap between our count
  and Discogs' moving average. Make it a setting
  (`SEARCH_BUDGET_PER_MINUTE`).

### Queue order

- Tickets go in a sorted set by arrival time. Position is the ticket's rank.
- A ticket is admitted when its position is less than the free slots, so an
  arrival can't skip past people already waiting.
- A ticket that hasn't polled for 20 seconds has been abandoned (tab closed,
  search cancelled) and is dropped during the next check. Cancel can also call
  `release` to free the place right away.
- ETA: position divided by the rate slots are freeing up, which comes from the
  timestamps in the window. It's an estimate, so show it rounded ("about
  20 seconds", "under a minute").

## Frontend

All of this sits inside `discogsSearch` and `useSearchRun`. No component calls
Discogs or the store directly.

- `discogsSearch` (`frontend/src/api/mutations.ts`): on `202`, report the
  position through a new `callbacks.onQueued({ position, etaSeconds })`,
  wait with the existing abortable `sleep(retryAfter, signal)`, and poll
  again with the ticket. Cancel aborts the wait. Parse the `202` body in a
  small tested helper in `src/lib/`, not in the component.
- `useSearchRun`: a new `waiting` phase before `finding`, holding position
  and ETA.
- `SearchProgress`: in the `waiting` phase, the "Searching" stage shows
  "Waiting for a turn" with the position and ETA. Above the stages, a short
  notice: "Vinyl Periphery is busy right now. Your search will start in about
  20 seconds." When the `200` arrives, the panel continues as it does today.
  Follows `docs/redesign/DESIGN.md`. Check at 390px and 1440px.
- Analytics: a `search_queued` event (`artist`, `album`, `position`,
  `seconds_waited`, sent when the wait ends) and `queued` as a new `phase`
  value on `search_cancelled`. Add the name to both allowlists and to
  `docs/analytics.md`.
- Optional: `GET /api/health` reports `{ busy: true }`, so the home page can
  warn before the user submits.

## Order of work

0. **Measure (now, cheap).** Record `X-Discogs-Ratelimit-Used` from each
   search response, for example as a field on `search_completed`, or as a
   single log line in place of the long header dump `searchRelease` logs now.
   That gives a real peak to compare against 60.
1. **Server-side search cache.** Cache `/api/search` responses by normalised
   artist and album, for example for a day. A cache hit never touches Discogs
   or the queue. This is part of the planned caching work and puts off
   everything below. Popular albums will make up most repeat searches.
2. **Budget and busy response.** The store, the counter, and a `202` with
   `retryAfter` but no ordering. Users who poll may overtake each other, but
   the busy notice and the wait-then-continue flow are complete.
3. **Ordered tickets.** Positions, ETA, abandonment, `release`.

### When to start

Start step 2 when either happens:

- the measured peak passes about 30 searches a minute, half the budget, or
- `/api/search` gets any 429 from Discogs.

Step 1 can go in before then, since it also makes repeat searches faster.

## Out of scope: the browser's own limit

The queue protects the app's key only. Each browser still has 25 a minute for
its own calls, and `REQUEST_DELAY_MS` (2.5 seconds, 24 a minute) already paces
it. Users behind one IP address (an office, a university) share those 25,
which the queue can't see. A separate, smaller fix: when a browser call gets a
429, wait and retry it instead of skipping that contributor as it does now.
Today a failed call also skips the `sleep` (it sits inside the `try`), so
after a 429 the next request goes out at once, which makes it worse.
Discogs may not expose the rate limit headers to browser JavaScript through
CORS, so the browser can count on the status code but maybe not the headers.
