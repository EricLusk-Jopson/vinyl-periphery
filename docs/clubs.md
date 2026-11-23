# Clubs: store and API

Music clubs (`features/music-clubs.md`) are the app's first server-side
store of user content. Everything else stays in the browser, and the app
works fully without a club.

## Store

Turso (libSQL). `backend/clubs/schema.js` lists the tables, applied with
`CREATE … IF NOT EXISTS` on each cold start (`backend/clubs/db.js`):

| Table | Holds |
|---|---|
| `clubs` | id (also the invite secret), name, format (`handoff` or `chain`), admin member id |
| `members` | name per club, unique ignoring case and spacing |
| `member_tokens` | SHA-256 of each member token: one per phone or browser |
| `picks` | round, order in the round (`seq`), date, picker, listener, kind, album (key, artist, title), answers, reason |
| `reactions` | text, official (author is the pick's listener) |
| `write_counts` | fixed-window write counters for rate limits |

Env: `CLUBS_DATABASE_URL` and `CLUBS_DATABASE_TOKEN`. Without the URL every
club endpoint answers 503. Locally, `CLUBS_DATABASE_URL=file:clubs.db` in
`.env` makes a SQLite file in the repo root (ignored by git).

## Trust

The honour system, as agreed for a group of friends:

- The club id is a long random value and the invite. Anyone with it can
  read the club, and choose any member's name to get a token for them.
- Writes carry `Authorization: Bearer <token>`. The token decides who you
  are: picks default to you as picker, reactions are always yours.
- The admin is whoever created the club. They can add picks for others
  (backfilling), edit or delete any pick, delete any reaction, rename
  anyone, and change the club's name and format. Under the honour system
  anyone could choose the admin's name too.
- Later accounts attach to existing members; nothing needs migrating.

Abuse limits: per club, 30 writes a minute and 600 a day (a round of picks
counts once); per address (hashed, never stored raw), 20 club creations
or joins an hour. Text caps: club name 80, member name 40, artist and title
200, reason and reaction 2,000 characters; at most 4 picks a round.

## Endpoints

All answers are JSON with `Cache-Control: no-store`; errors are
`{ error }`. Writes from another site's pages are refused (`Origin`).

| Method | Path | Body or query | Who | Answer |
|---|---|---|---|---|
| GET | `/api/clubs` | `?id=` | anyone with the id | `{ club, members, picks, reactions, you? }` |
| POST | `/api/clubs` | `{ name, format?, memberName }` | anyone | 201 `{ club, member, token }` |
| PATCH | `/api/clubs` | `{ id, name?, format? }` | admin | `{ club }` |
| POST | `/api/club-members` | `{ clubId, name }` | anyone with the id | 201 `{ member, token }`, or 409 `{ error, member }` if taken |
| POST | `/api/club-members` | `{ clubId, memberId }` | anyone with the id | `{ member, token }` |
| PATCH | `/api/club-members` | `{ memberId?, name }` | yourself, or admin | `{ member }` |
| POST | `/api/club-picks` | `{ picks: [...], round? }` | member | 201 `{ picks }` |
| PATCH | `/api/club-picks` | `{ id, ...fields }` | picker or admin | `{ pick }` |
| DELETE | `/api/club-picks` | `?id=` | picker or admin | 204 |
| POST | `/api/club-reactions` | `{ pickId, text }` | member | 201 `{ reaction }` |
| PATCH | `/api/club-reactions` | `{ id, text }` | author | `{ reaction }` |
| DELETE | `/api/club-reactions` | `?id=` | author or admin | 204 |

A pick is `{ date?, pickerId?, listenerId?, kind?, album: { key?, artist,
title }, answers?, reason? }`. Defaults: today, you, no listener, `plain`.
`key` is `master:N` or `release:N` when the album is on Discogs; albums
that aren't are just artist and title. `answers` may be any pick in an
earlier round. The club's format decides only what the form offers; the
server takes any pick of this shape, so history in any format imports as
is.

Without `round`, a post starts the next round, numbered in the same
transaction as the insert. With `round` (at most the next), the picks join
that round, as when a wild card is added later.

An edit can't change a pick's round or picker. Clearing a field takes
`null`. Changing the listener moves the official mark on its reactions.
Deleting a pick deletes its reactions, and picks that answered it then
answer nothing.
