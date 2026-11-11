import { SearchCache } from "@/contexts/cache/types";
import { lineageOf } from "./lineage";
import { searchStartedAt } from "./searches";
import { withoutArtistNumber } from "./transformers/transformers";

/**
 * Stacks as records of their own: a name and the albums in it, kept in
 * the library beside the searches (IndexedDB, `stacks`). An album (a saved
 * search) can be in any number of stacks; deleting a stack never deletes
 * its albums. Every album but the first must link to one already in the
 * stack: one has the other among its results (someone credited on one
 * worked on the other). The first album is the stack's start.
 *
 * Pure, so stacks can be tested on their own.
 */

/** One album in a stack: which search, and enough to show it if deleted. */
export interface StackMember {
  /** The search when it was added; a repeat run is found by `targetKey`. */
  searchId: string;
  /** The Discogs album ("master:N" / "release:N"), or "" for old searches. */
  targetKey: string;
  title: string;
  artist: string;
  thumb: string;
  addedAt: number;
}

export interface StackRecord {
  id: string;
  name: string;
  /** In the order added; the first is the start. */
  members: StackMember[];
  createdAt: number;
  updatedAt: number;
}

/** An album's node in a stack: its Discogs key, or its search id. */
export const albumKeyOf = (search: Pick<SearchCache, "searchId" | "target">) =>
  search.target?.key || search.searchId;

export const memberKey = (member: StackMember) =>
  member.targetKey || member.searchId;

/** A saved search as a stack member. */
export const memberFor = (
  search: SearchCache,
  now = Date.now(),
): StackMember => ({
  searchId: search.searchId,
  targetKey: search.target?.key ?? "",
  title: search.searchParams.album,
  artist: withoutArtistNumber(search.searchParams.artist),
  thumb: search.thumb ?? "",
  addedAt: now,
});

/** A new stack id: "stack-" and a random part. */
export const newStackId = (random = Math.random): string =>
  `stack-${Date.now().toString(36)}-${random().toString(36).slice(2, 8)}`;

/** "Unmap + 2": the default name, from the start and the others. */
export const defaultStackName = (members: StackMember[]): string =>
  members.length === 0
    ? "New stack"
    : members.length === 1
      ? members[0].title
      : `${members[0].title} + ${members.length - 1}`;

/**
 * Saved searches by album: a member's search, or the latest run of its
 * album (a repeat run replaces the search under a new id).
 */
export const savedByAlbum = (
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
): Map<string, SearchCache> => {
  const byKey = new Map<string, SearchCache>();
  for (const id of savedIds) {
    const search = searches[id];
    if (!search) continue;
    const key = albumKeyOf(search);
    const seen = byKey.get(key);
    if (
      !seen ||
      searchStartedAt(search.searchId) > searchStartedAt(seen.searchId)
    ) {
      byKey.set(key, search);
    }
    byKey.set(search.searchId, search);
  }
  return byKey;
};

/** The saved search for a member, if it's still in the library. */
export const resolveMember = (
  member: StackMember,
  byAlbum: Map<string, SearchCache>,
): SearchCache | undefined =>
  (member.targetKey && byAlbum.get(member.targetKey)) ||
  byAlbum.get(member.searchId);

/** Who links two albums: credited on one, in the other's results. */
export const linkPeople = (a: SearchCache, b: SearchCache): number[] =>
  Array.from(
    new Set([
      ...(a.releases?.[albumKeyOf(b)]?.contributorIds ?? []),
      ...(b.releases?.[albumKeyOf(a)]?.contributorIds ?? []),
    ]),
  );

export const linked = (a: SearchCache, b: SearchCache): boolean =>
  linkPeople(a, b).length > 0;

export interface JoinCheck {
  /** It can be added: the stack is empty, or an album in it links to it. */
  ok: boolean;
  /** Already in the stack. */
  member: boolean;
  /** The album in the stack that links to it, sharing the most people. */
  via?: SearchCache;
  people: number[];
}

/** Whether `search` can go into a stack of `albums` (saved, resolved). */
export const canJoin = (
  search: SearchCache,
  albums: SearchCache[],
): JoinCheck => {
  const key = albumKeyOf(search);
  if (albums.some((a) => albumKeyOf(a) === key)) {
    return { ok: false, member: true, people: [] };
  }
  if (albums.length === 0) return { ok: true, member: false, people: [] };
  let best: { via: SearchCache; people: number[] } | null = null;
  for (const album of albums) {
    const people = linkPeople(search, album);
    if (people.length > (best?.people.length ?? 0))
      best = { via: album, people };
  }
  return best
    ? { ok: true, member: false, via: best.via, people: best.people }
    : { ok: false, member: false, people: [] };
};

/**
 * Steps from the start: each album's fewest links from the first one
 * still saved. Albums nothing links to the start are left out.
 */
export const stepsFromStart = (albums: SearchCache[]): Map<string, number> => {
  const steps = new Map<string, number>();
  if (albums.length === 0) return steps;
  const start = albums[0];
  steps.set(albumKeyOf(start), 0);
  const queue = [start];
  while (queue.length) {
    const at = queue.shift()!;
    for (const other of albums) {
      const key = albumKeyOf(other);
      if (steps.has(key) || !linked(at, other)) continue;
      steps.set(key, steps.get(albumKeyOf(at))! + 1);
      queue.push(other);
    }
  }
  return steps;
};

/**
 * The albums that would lose their link to the start if `removing` left
 * the stack (with the start removed, the next album becomes the start).
 * Empty when the stack stays in one piece.
 */
export const strandedBy = (
  albums: SearchCache[],
  removing: Set<string>,
): SearchCache[] => {
  const before = stepsFromStart(albums);
  const left = albums.filter((a) => !removing.has(albumKeyOf(a)));
  const after = stepsFromStart(left);
  // Only albums that were linked and no longer are: the change's doing.
  return left.filter(
    (a) => !after.has(albumKeyOf(a)) && before.has(albumKeyOf(a)),
  );
};

/** The stack with these members, its name and time updated. */
export const withMembers = (
  record: StackRecord,
  members: StackMember[],
  now = Date.now(),
): StackRecord => ({ ...record, members, updatedAt: now });

/** Whether the stack holds this album. */
export const holds = (record: StackRecord, search: SearchCache): boolean => {
  const key = albumKeyOf(search);
  return record.members.some(
    (m) => memberKey(m) === key || m.searchId === search.searchId,
  );
};

/** The stack without this album. */
export const without = (
  record: StackRecord,
  search: SearchCache,
  now = Date.now(),
): StackRecord => {
  const key = albumKeyOf(search);
  return withMembers(
    record,
    record.members.filter(
      (m) => memberKey(m) !== key && m.searchId !== search.searchId,
    ),
    now,
  );
};

/**
 * Stacks as earlier versions made them, from search lineage: saved
 * searches sharing a `lineage.stackId`, two or more. Each becomes a
 * record with the same id (so its Results filters carry over), named as
 * it was shown ("Unmap + 2"), the start first, then by depth on the trail
 * and age. Run once, when the library moves to stack records.
 */
export const stacksFromLineage = (
  saved: SearchCache[],
  now = Date.now(),
): StackRecord[] => {
  const byStack = new Map<string, SearchCache[]>();
  for (const search of saved) {
    const id = lineageOf(search).stackId;
    byStack.set(id, [...(byStack.get(id) ?? []), search]);
  }
  const records: StackRecord[] = [];
  for (const [id, group] of byStack) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(
      (a, b) =>
        lineageOf(a).depth - lineageOf(b).depth ||
        searchStartedAt(a.searchId) - searchStartedAt(b.searchId),
    );
    const members = ordered.map((s) => memberFor(s, s.savedAt ?? now));
    records.push({
      id,
      name: defaultStackName(members),
      members,
      createdAt: Math.min(...members.map((m) => m.addedAt)),
      updatedAt: now,
    });
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * A stored stack with Discogs's disambiguation numbers taken off its
 * albums' artists ("Squid (29)"). The same object when there's nothing to
 * change.
 */
export const withoutMemberNumbers = (record: StackRecord): StackRecord => {
  const members = record.members.map((m) => {
    const artist = withoutArtistNumber(m.artist ?? "");
    return artist === m.artist ? m : { ...m, artist };
  });
  return members.every((m, i) => m === record.members[i])
    ? record
    : { ...record, members };
};
