import { SearchCache } from "@/contexts/cache/types";
import { matchesName } from "./filters";
import { linkSummary } from "./linkSummary";
import { searchStartedAt } from "./searches";
import {
  albumKeyOf,
  canJoin,
  holds,
  JoinCheck,
  artistAlbums,
  artistMemberFor,
  isArtistMember,
  linkPeople,
  memberKey,
  resolveMember,
  savedByAlbum,
  StackMember,
  StackRecord,
  stepsFromStart,
} from "./stackRecords";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Stacks as the app shows them: a stack record (see `stackRecords`) with
 * its albums found in the library. Pure, so they can be tested on their own.
 */

export interface LibraryStack {
  kind: "stack";
  /** The record's id (also the route and the Results filters' key). */
  stackId: string;
  record: StackRecord;
  /** Its albums still in the library, in the order added. */
  members: SearchCache[];
  /** Its albums deleted from the library since (shown ghosted). */
  missing: StackMember[];
  /**
   * The artist it starts from, if any: its albums (all of them, on or
   * off) come first in `members`, every one at step 0.
   */
  artist?: StackArtist;
}

export interface StackArtist {
  member: StackMember;
  /** The artist's albums in the library, oldest first. */
  albums: SearchCache[];
}

/** A stack record with its albums found in the library. */
export const libraryStack = (
  record: StackRecord,
  byAlbum: Map<string, SearchCache>,
): LibraryStack => {
  const members: SearchCache[] = [];
  const missing: StackMember[] = [];
  const seen = new Set<string>();
  let artist: StackArtist | undefined;
  for (const [i, member] of record.members.entries()) {
    if (isArtistMember(member)) {
      // Only the start can be an artist (for now).
      if (i !== 0) continue;
      const albums = artistAlbums(member.targetKey, byAlbum);
      artist = { member, albums };
      for (const search of albums) {
        seen.add(search.searchId);
        members.push(search);
      }
      continue;
    }
    const search = resolveMember(member, byAlbum);
    if (!search) missing.push(member);
    else if (!seen.has(search.searchId)) {
      seen.add(search.searchId);
      members.push(search);
    }
  }
  return {
    kind: "stack",
    stackId: record.id,
    record,
    members,
    missing,
    ...(artist ? { artist } : {}),
  };
};

/** How many albums a stack starts with at step 0: its artist's, or one. */
export const startCount = (stack: Pick<LibraryStack, "artist">): number =>
  stack.artist ? Math.max(1, stack.artist.albums.length) : 1;

/** Every stack, with its albums found in the library. */
export const libraryStacks = (
  stacks: StackRecord[],
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
): LibraryStack[] => {
  const byAlbum = savedByAlbum(searches, savedIds);
  return stacks.map((record) => libraryStack(record, byAlbum));
};

export interface StackRoot {
  searchId: string;
  title: string;
  artist: string;
  thumb: string;
  targetKey: string;
  /** The start's search, while it's still in the library. */
  search?: SearchCache;
}

/** Where a stack starts: its first album, saved or as last known. */
export const stackRoot = (stack: LibraryStack): StackRoot => {
  if (stack.artist) {
    const search = stack.artist.albums[stack.artist.albums.length - 1];
    return {
      searchId: search?.searchId ?? "",
      title: stack.artist.member.title,
      artist: stack.artist.member.title,
      thumb: search?.thumb ?? stack.artist.member.thumb,
      targetKey: search?.target?.key ?? "",
      search,
    };
  }
  const first = stack.record.members[0];
  const search =
    first &&
    stack.members.find(
      (m) =>
        m.searchId === first.searchId ||
        (first.targetKey !== "" && m.target?.key === first.targetKey),
    );
  if (search) {
    return {
      searchId: search.searchId,
      title: search.searchParams.album,
      artist: search.searchParams.artist,
      thumb: search.thumb,
      targetKey: search.target?.key ?? "",
      search,
    };
  }
  return first
    ? {
        searchId: first.searchId,
        title: first.title,
        artist: first.artist,
        thumb: first.thumb,
        targetKey: first.targetKey,
      }
    : {
        searchId: "",
        title: stack.record.name,
        artist: "",
        thumb: "",
        targetKey: "",
      };
};

/** A stack's name. */
export const stackLabel = (stack: LibraryStack): string => stack.record.name;

/** An album deleted from the library, still listed in a stack. */
export interface GhostStep {
  member: StackMember;
}

/** Albums no link joins to the start sit at this step. */
export const UNLINKED = -1;

export interface StackLayout {
  /** Member search id -> its step: fewest links from the start (UNLINKED). */
  levels: Map<string, number>;
  /** The stack's albums deleted from the library. */
  ghosts: GhostStep[];
  /** Member search id -> the albums one step closer that link it. */
  parents: Map<string, StackParent[]>;
}

/** An album one step closer to the start that links to this one. */
export interface StackParent {
  /** The album's node: its target key, or its search id. */
  key: string;
  title: string;
  artist: string;
  /** Who links them: credited on both. Raw, not filtered. */
  people: number[];
  /** Their names, through the display pipeline, where known. */
  names: string[];
  /** Not in the library any more (shown ghosted). */
  ghost: boolean;
  /** Always false now: links come from credits only. */
  byTrail: boolean;
}

/**
 * A stack as a graph: albums linked when one has the other among its
 * results. Each album's step is its fewest links from the start (the first
 * album still in the library); albums nothing links to it are UNLINKED
 * (removing an album can leave them so, after a warning).
 */
export const stackLayout = (stack: LibraryStack): StackLayout => {
  const steps = stepsFromStart(stack.members, startCount(stack));
  const levels = new Map(
    stack.members.map((m) => [
      m.searchId,
      steps.get(albumKeyOf(m)) ?? UNLINKED,
    ]),
  );
  const nameOf = (id: number, ...searches: SearchCache[]) => {
    for (const s of [...searches, ...stack.members]) {
      const name = s?.contributors?.[id]?.name;
      if (name) return defaultContributorDisplayPipeline(name);
    }
    return null;
  };
  const parents = new Map<string, StackParent[]>();
  for (const child of stack.members) {
    const level = steps.get(albumKeyOf(child));
    const list: StackParent[] = [];
    if (level !== undefined && level > 0) {
      for (const parent of stack.members) {
        if (steps.get(albumKeyOf(parent)) !== level - 1) continue;
        const people = linkPeople(child, parent);
        if (people.length === 0) continue;
        list.push({
          key: albumKeyOf(parent),
          title: parent.searchParams.album,
          artist: parent.searchParams.artist,
          people,
          names: people
            .map((id) => nameOf(id, child, parent))
            .filter((n): n is string => n !== null),
          ghost: false,
          byTrail: false,
        });
      }
    }
    parents.set(
      child.searchId,
      list.sort(
        (a, b) =>
          b.people.length - a.people.length || a.title.localeCompare(b.title),
      ),
    );
  }
  return {
    levels,
    ghosts: stack.missing.map((member) => ({ member })),
    parents,
  };
};

const MAX_LINK_NAMES = 2;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const albumName = (parent: StackParent) =>
  parent.ghost ? `${parent.title} (deleted)` : parent.title;

const distinctPeople = (parents: StackParent[]) =>
  new Set(parents.flatMap((p) => p.people)).size;

/**
 * A card's link line: where it was reached from and who links them. "From
 * In Utero · Steve Albini, Krist Novoselic +1"; with several parents, the
 * one sharing most people and a count: "From In Utero and 1 more · 4
 * people". Empty for the start.
 */
export const linkLineText = (parents: StackParent[]): string => {
  if (parents.length === 0) return "";
  const [first] = parents;
  if (parents.length > 1) {
    return `From ${albumName(first)} and ${parents.length - 1} more · ${plural(
      distinctPeople(parents),
      "person",
      "people",
    )}`;
  }
  if (first.people.length === 0) return `From ${albumName(first)}`;
  const shown = first.names.slice(0, MAX_LINK_NAMES);
  const rest = first.people.length - shown.length;
  const who =
    shown.length === 0
      ? plural(rest, "person", "people")
      : `${shown.join(", ")}${rest > 0 ? ` +${rest}` : ""}`;
  return `From ${albumName(first)} · ${who}`;
};

const listOf = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** The link line in full, for a card's accessible name: every name. */
export const linkLineLabel = (parents: StackParent[]): string =>
  parents.length === 0
    ? ""
    : "Linked " +
      parents
        .map((p) => {
          const unnamed = p.people.length - p.names.length;
          const who = [
            ...p.names,
            ...(unnamed > 0
              ? [
                  plural(
                    unnamed,
                    p.names.length ? "other" : "person",
                    p.names.length ? "others" : "people",
                  ),
                ]
              : []),
          ];
          return `from ${albumName(p)}${who.length ? ` by ${listOf(who)}` : ""}`;
        })
        .join("; and ");

/** Members by step (unlinked last), then oldest first within a step. */
export const stackMembersByDepth = (
  stack: LibraryStack,
  levels: Map<string, number> = stackLayout(stack).levels,
): SearchCache[] => {
  const step = (m: SearchCache) => {
    const level = levels.get(m.searchId) ?? UNLINKED;
    return level === UNLINKED ? Number.MAX_SAFE_INTEGER : level;
  };
  return [...stack.members].sort(
    (a, b) =>
      step(a) - step(b) ||
      searchStartedAt(a.searchId) - searchStartedAt(b.searchId),
  );
};

/** The deepest step in a stack. */
export const stackDepth = (stack: LibraryStack): number =>
  Math.max(0, ...stackLayout(stack).levels.values());

/** One stack, as offered for an album: in it, can join it, or can't. */
export interface StackOption {
  stack: LibraryStack;
  /** Can it go in (it links to an album there), or is it already in? */
  join: JoinCheck;
}

/**
 * Every stack, for one album's Stacks drawer: those holding it first, then
 * those it can join (most people linking first), then the rest.
 */
export const stackOptionsFor = (
  search: SearchCache,
  stacks: LibraryStack[],
): StackOption[] => {
  const rank = (o: StackOption) => (o.join.member ? 0 : o.join.ok ? 1 : 2);
  return stacks
    .map((stack) => ({
      stack,
      join: holds(stack.record, search)
        ? { ok: false, member: true, people: [] }
        : canJoin(search, stack.members),
    }))
    .sort(
      (a, b) =>
        rank(a) - rank(b) || b.join.people.length - a.join.people.length,
    );
};

/**
 * The badge on an album's Stacks button: "add" when it's in no stack yet
 * but could go in one (it links to an album there), else null.
 */
export const stackBadge = (
  search: SearchCache,
  stacks: LibraryStack[],
): "add" | null => {
  let canAdd = false;
  for (const stack of stacks) {
    if (holds(stack.record, search)) return null;
    if (!canAdd && stack.members.length > 0) {
      canAdd = canJoin(search, stack.members).ok;
    }
  }
  return canAdd ? "add" : null;
};

/** The badge, said: for the Stacks button's accessible name. */
export const stackBadgeLabel = (badge?: "add" | null): string =>
  badge ? " (not in a stack yet: it can join one)" : "";

/** The stacks holding this album. */
export const stacksWith = (
  search: SearchCache,
  stacks: LibraryStack[],
): LibraryStack[] => stacks.filter((s) => holds(s.record, search));

/**
 * What links an album to the stack, by role: the linking album's people on
 * it, as `linkSummary` puts them ("via Instruments (2) · Production (1)").
 */
export const fitLinkText = (fit: {
  parent: SearchCache;
  via: number[];
}): string =>
  linkSummary(
    fit.via.map((id) => fit.parent.contributors?.[id] ?? { id, roles: [] }),
  );

/** What searching from a result does, for the one-time tip. */
export const searchFromNote = (): string =>
  "a new search (about a minute) that goes into your library, ready to add to any stack it links to";

/** Whether `found` is outside this stack (to offer adding it). */
export const outsideStack = (
  found: SearchCache,
  stack: LibraryStack,
): boolean => !holds(stack.record, found);

/** Saved searches whose album or artist matches. */
export const searchLibrary = (
  saved: SearchCache[],
  query: string,
): SearchCache[] =>
  query.trim() === ""
    ? saved
    : saved.filter(
        (s) =>
          matchesName(s.searchParams.album, query) ||
          matchesName(s.searchParams.artist, query),
      );

/** Stacks whose name, or one of whose albums, matches. */
export const searchStacks = (
  stacks: LibraryStack[],
  query: string,
): LibraryStack[] =>
  query.trim() === ""
    ? stacks
    : stacks.filter(
        (s) =>
          matchesName(s.record.name, query) ||
          s.record.members.some(
            (m) => matchesName(m.title, query) || matchesName(m.artist, query),
          ),
      );

export { memberKey };

// Artists -----------------------------------------------------------------

/**
 * An artist in the library: every album searched whose main artist it is,
 * grouped on its own (nothing to make or keep: a new search by them joins
 * as it finishes). Read like a stack starting from the artist, every
 * album at step 0.
 */
export interface LibraryArtist {
  kind: "artist";
  /** "artist:squid": the route and its Results filters' key. */
  artistId: string;
  name: string;
  /** Oldest first. */
  albums: SearchCache[];
  /** When an album of theirs was last searched. */
  updatedAt: number;
}

/** Every artist with an album in the library, latest searched first. */
export const libraryArtists = (
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
): LibraryArtist[] => {
  const byAlbum = savedByAlbum(searches, savedIds);
  const ids = new Map<string, string>();
  for (const search of byAlbum.values()) {
    const member = artistMemberFor(search.searchParams.artist);
    if (!ids.has(member.targetKey)) ids.set(member.targetKey, member.title);
  }
  return Array.from(ids, ([artistId, name]) => {
    const albums = artistAlbums(artistId, byAlbum);
    return {
      kind: "artist" as const,
      artistId,
      name,
      albums,
      updatedAt: Math.max(0, ...albums.map((a) => searchStartedAt(a.searchId))),
    };
  })
    .filter((a) => a.albums.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
};

/** An artist read as a stack (for its page): every album at step 0. */
export const artistStack = (artist: LibraryArtist): LibraryStack => {
  const latest = artist.albums[artist.albums.length - 1];
  const member = artistMemberFor(artist.name, latest?.thumb ?? "");
  return {
    kind: "stack",
    stackId: artist.artistId,
    record: {
      id: artist.artistId,
      name: artist.name,
      members: [member],
      createdAt: 0,
      updatedAt: artist.updatedAt,
    },
    members: artist.albums,
    missing: [],
    artist: { member, albums: artist.albums },
  };
};

/** Artists whose name, or one of whose albums, matches. */
export const searchArtists = (
  artists: LibraryArtist[],
  query: string,
): LibraryArtist[] =>
  query.trim() === ""
    ? artists
    : artists.filter(
        (a) =>
          matchesName(a.name, query) ||
          a.albums.some((s) => matchesName(s.searchParams.album, query)),
      );

/** Albums switched on, of an artist's: those its filters don't turn off. */
export const albumsOnOf = (
  albums: SearchCache[],
  states: Record<string, boolean>,
): SearchCache[] => albums.filter((a) => states[albumKeyOf(a)] !== false);

/** "3 of 5 albums on", or "5 albums" when all are. */
export const activeAlbumsText = (on: number, total: number): string =>
  on === total
    ? `${total} ${total === 1 ? "album" : "albums"}`
    : `${on} of ${total} albums on`;
