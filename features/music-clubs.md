# Music clubs

Status: in progress. Section 1 (store and API) built; see `docs/clubs.md`.
Agreed with Eric, 2026-11-22.

## The idea

A club is a small group passing album recommendations around, like Eric's
album game: six friends, a Messenger group chat, running for about 12
years. Today the history lives in a chat scroll and a partial Rate Your
Music list. The reasons, the links between picks and the order are hard to
see.

Vinyl Periphery becomes the club's record: every pick, why it was picked,
what it answers, and what the listener thought. The group chat keeps
running the game. The app does not manage turns or send nudges.

Scope is Eric's own club first. Other clubs can use it, but nothing is
built for strangers (no discovery, no public clubs). The app keeps working
fully without joining a club or having an account.

## The game being modelled

- Each week one player hands two picks to one assigned listener.
- One pick is similar: it answers one of the two picks they received, with
  a reason (shared people, mood, a hunch, a language).
- One pick is a wild card.
- If nothing received fits, a player may answer an older pick by the
  person they inherited from.
- The listener replies with a few lines. No ratings.
- Everyone else may listen along.

Earlier formats (one pick at a time, everyone listens before moving on)
import cleanly too.

## Data model

Server-side, in Turso. Shapes as the API returns them (`docs/clubs.md`):

```ts
interface Club { id: string; name: string; format: "handoff" | "chain"; adminId: string; createdAt: number }
interface Member { id: string; clubId: string; name: string; joinedAt: number }
interface Pick {
  id: string; clubId: string;
  round: number;            // order within the club
  date: string;             // YYYY-MM-DD; backdated for imports
  pickerId: string;
  listenerId?: string;      // the assigned listener, if the format has one
  kind: "similar" | "wild" | "plain";
  album: { key?: string; artist: string; title: string };
  answers?: string;         // id of an earlier pick this one answers
  reason?: string;
}
interface Reaction { id: string; pickId: string; memberId: string; text: string; official: boolean; createdAt: number }
```

- `answers` may point to any earlier pick. The club's format only decides
  which picks the form offers.
- `reason` and `answers` are optional, so history with no reasons imports
  as is. Albums not on Discogs are allowed (artist and title only).
- When both albums of a link have a `key`, the app shows their shared
  people under the reason, never instead of it.
- No ratings, anywhere.

## Formats

- Handoff (the current game): two picks a round, one similar and one wild;
  similar answers one of the previous round's picks, falling back to an
  older pick by the previous picker.
- Chain (the old format): one pick a round, optionally answering the
  previous one.

Others only when a real club asks.

## Membership and trust

The invite link holds the club id. Opening it shows the members; you choose
your name or add one, and get a member token (localStorage, in try/catch).
On a new phone, open the link and choose your name again. The honour
system: anyone with the link could post as anyone. Rate limits per club
and text caps guard against abuse.

## Timeline

One vertical timeline: two columns, a row per round with its picks side by
side at their date. One continuous line follows the chain of answers; a
similar pick sits under the pick it answers. Answering the previous
player's wild card steps the line sideways within the previous row. Links
to older picks are tags at both ends ("answers Quasimoto, March 2024" /
"answered by Madvillainy, November 2026") that scroll to the other end, and
break the line. A season is an unbroken run of the line, derived, never
stored, shaded alternately with date ranges. Members joining are small
markers. Single-pick formats: one pick a row.

Each pick expanded: the reason in full, shared people with the pick it
answers, reactions (the listener's first and marked), and actions (search
from this album, add to library, Listen, Discogs).

Code: `src/lib/clubTimeline.ts` (rows, columns, line segments, seasons,
tags; pure and tested), rendered in SVG with DOM covers. At 390px two
covers and the line between them must fit.

## Sharing

Messenger takes no bots, so players paste links. Each round's link unfurls
with an OG card (both covers, picker, the similar pick's reason) from
`/api/og` with a new layout; the club's link unfurls with its name and
latest round. Track `club_link_copied`.

## Importing

The admin imports CSV or JSON: date, picker, artist, title, and optional
kind, answers and reason. Albums are matched to Discogs by text search at
the user's pace, within the rate limit; unmatched ones stay as artist and
title and can be matched later by pasting a Discogs link.

## Sections (one PR each, into `develop`)

1. Store and API. Done.
2. Club page and adding picks: join flow, add a round (the form offers only
   the picks the format allows), reactions.
3. Timeline: `clubTimeline.ts` and its rendering.
4. Import.
5. Share cards.

## Analytics

`club_created`, `club_joined`, `pick_added` (`kind`), `reaction_added`
(`official`), `club_imported` (`rows`), `club_link_copied`,
`timeline_tag_followed`. Added with the client actions that send them.

## Decided

- Editing and deleting a pick: the picker and the admin. Reactions: edited
  by their author, deleted by their author or the admin.
- Reactions can be added to any pick, imported ones included.
- A club is visible to anyone with the link (the same as members-only under
  the honour system; revisit once accounts exist).

## Open

- Timeline order: newest first or oldest first.
- Line colour per season, or one colour throughout.
