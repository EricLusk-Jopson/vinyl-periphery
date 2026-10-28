import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { ALBUM_MAP_PEOPLE, layoutAlbumMap } from "./albumMap";
import { requiredFilters } from "./filters";
import {
  resetFilterState,
  ScoredRelease,
  SORT_OPTIONS,
  SortKey,
} from "./results";
import { layoutMap, mapAlbums, MAX_MAP_PEOPLE } from "./shareMap";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Share images: the payload the renderer (/api/og) draws from, built from
 * data already in the app. Everything the image shows travels in the URL,
 * so rendering never calls Discogs. Format: backend/og/payload.js.
 */

export type ShareLayout = "map" | "card";

/** Art id: "g:<release-group mbid>", "r:<release mbid>", or "". */
type ArtId = string;

interface ShareAlbum {
  t: string;
  r: string;
  i: ArtId;
}

export type SharePayload =
  | {
      v: 1;
      l: "card";
      a: ShareAlbum;
      x: Array<ShareAlbum & { n: number }>;
      /** How the albums were chosen (sort and filters), when it says. */
      d?: string;
      /** No covers: every album as its title and artist. */
      nc?: 1;
    }
  | {
      v: 1;
      l: "map";
      c: ShareAlbum;
      /**
       * x, y: thousandths of the radius, y up; z: size tier; s: cover side
       * in thousandths of the radius, which wins over z when present.
       */
      n: Array<
        ShareAlbum & {
          x: number;
          y: number;
          z: 1 | 2;
          s?: number;
          /** The people (indices into p) linking it, for lines. */
          l?: number[];
        }
      >;
      /** People around the rim: name, and angle in degrees. */
      p: Array<{ n: string; a: number }>;
      d?: string;
      nc?: 1;
      /** Lines from each person to their albums (`l`). */
      ln?: 1;
    };

/** Rows on the results card by default (it takes up to ten). */
export const SHARE_RESULTS = 5;

/** How many albums each layout can show, and how many it starts with. */
export const SHARE_COUNTS: Record<
  ShareLayout,
  { options: number[]; start: number }
> = {
  map: { options: [6, 12, 18, 24], start: 12 },
  card: { options: [3, 5, 8, 10], start: 5 },
};

/**
 * The counts to offer when `available` albums match: those below it, then
 * "All" when it's under the largest. Nothing to choose with one album or
 * none.
 */
export const countOptions = (
  layout: ShareLayout,
  available: number,
): Array<{ count: number; label: string }> => {
  const { options } = SHARE_COUNTS[layout];
  const max = options[options.length - 1];
  const below = options.filter((n) => n < available && n < max);
  const all =
    available <= max ? [{ count: available, label: `All ${available}` }] : [];
  const choices = [
    ...below.map((n) => ({ count: n, label: String(n) })),
    ...(available > max ? [{ count: max, label: String(max) }] : all),
  ];
  return choices.length > 1 ? choices : [];
};

/** The art id in a Cover Art Archive URL, or "". */
export const artIdFromCoverUrl = (url: string | null | undefined): ArtId => {
  const match =
    /^https:\/\/coverartarchive\.org\/(release-group|release)\/([0-9a-f-]{36})\//i.exec(
      url ?? "",
    );
  if (!match) return "";
  return `${match[1] === "release-group" ? "g" : "r"}:${match[2].toLowerCase()}`;
};

/** Looks up a cover URL for a result key (the app's cover resolver). */
export type CoverFor = (key: string) => string | null | undefined;

const artFor = (key: string | undefined, coverFor: CoverFor): ArtId =>
  key ? artIdFromCoverUrl(coverFor(key)) : "";

/** Periphery card: the searched album and its top results. */
export const cardPayload = (
  search: SearchCache,
  ranked: ScoredRelease[],
  coverFor: CoverFor,
  caption?: string,
  count = SHARE_RESULTS,
): SharePayload => ({
  v: 1,
  l: "card",
  a: {
    t: search.searchParams.album,
    r: search.searchParams.artist,
    i: artFor(search.target?.key, coverFor),
  },
  x: ranked.slice(0, count).map((release) => ({
    t: release.title,
    r: release.artist,
    i: artFor(release.key, coverFor),
    n: release.activeContributors.length,
  })),
  ...(caption ? { d: caption } : {}),
});

const sortName = (key: SortKey) =>
  SORT_OPTIONS.find((o) => o.value === key)?.short ?? key;

/**
 * How a share's albums were chosen, in a line for the image: "Top 12 by
 * Shared, then Newest · Liked only · 2 people off". Only filters that differ
 * from Reset are named.
 */
export const selectionCaption = (
  search: SearchCache,
  count: number,
  sort: SortKey,
  then: SortKey | null,
): string => {
  const { filterState } = search;
  const base = resetFilterState(search);
  const parts = [
    `Top ${count} by ${sortName(sort)}${then ? `, then ${sortName(then)}` : ""}`,
  ];
  if (filterState.likedOnly) parts.push("Liked only");
  if (filterState.collaborationsOnly) parts.push("2+ shared");
  if (filterState.excludeVarious) parts.push("No Various Artists");
  if (filterState.excludeMainArtist !== base.excludeMainArtist) {
    parts.push(`With ${search.searchParams.artist}'s own`);
  }
  const required = requiredFilters(filterState);
  const names = [
    ...required.contributors.map((id) =>
      defaultContributorDisplayPipeline(search.contributors[id]?.name ?? ""),
    ),
    ...required.roles,
  ].filter(Boolean);
  if (names.length > 0) {
    parts.push(
      `Must include ${names.slice(0, 2).join(", ")}${
        names.length > 2 ? ` +${names.length - 2}` : ""
      }`,
    );
  }
  const off = (states: Record<string | number, boolean>) =>
    Object.values(states).filter((on) => !on).length;
  const peopleOff = off(filterState.contributors);
  const rolesOff = off(filterState.roles);
  if (peopleOff > 0) {
    parts.push(`${peopleOff} ${peopleOff === 1 ? "person" : "people"} off`);
  }
  if (rolesOff > 0) {
    parts.push(`${rolesOff} ${rolesOff === 1 ? "role" : "roles"} off`);
  }
  return parts.join(" · ");
};

/**
 * Share map for one search: its album in the middle and `shown` (its top
 * results, as filtered and sorted) around it. See `albumMap.ts`.
 */
export const albumMapPayload = (
  search: SearchCache,
  shown: ScoredRelease[],
  likes: Likes,
  coverFor: CoverFor,
  caption?: string,
): SharePayload => {
  const { albums, people } = layoutAlbumMap(shown, search.contributors, likes);
  const names = (id: number) =>
    defaultContributorDisplayPipeline(search.contributors[id]?.name ?? "");
  // Names for the people linking the most albums; the rest still placed
  // the albums, but aren't drawn.
  const labelled = new Set(
    [...people]
      .sort((a, b) => b.albums - a.albums || a.id - b.id)
      .slice(0, ALBUM_MAP_PEOPLE)
      .map((p) => p.id),
  );
  const rim = people.filter((p) => labelled.has(p.id) && names(p.id));
  const rimIndex = new Map(rim.map((p, i) => [p.id, i]));
  return {
    v: 1,
    l: "map",
    c: {
      t: search.searchParams.album,
      r: search.searchParams.artist,
      i: artFor(search.target?.key, coverFor),
    },
    n: albums.map((album) => ({
      t: album.title,
      r: album.artist,
      i: artFor(album.key, coverFor),
      x: Math.round(album.x * 1000),
      y: Math.round(album.y * 1000),
      z: album.liked ? 2 : 1,
      s: Math.round(album.side * 1000),
      // Named people only: the lines run from their dots.
      l: album.people
        .map((id) => rimIndex.get(id))
        .filter((i): i is number => i !== undefined),
    })),
    p: rim.map((p) => ({
      n: names(p.id),
      a: (Math.round((p.angle * 180) / Math.PI) + 360) % 360,
    })),
    ...(caption ? { d: caption } : {}),
  };
};

/** How an image is drawn, chosen in the share sheet. */
export interface ShareView {
  /** Cover art, or titles and artists only. */
  covers: boolean;
  /** Lines from each person to their albums (maps that have them). */
  lines: boolean;
}

export const DEFAULT_VIEW: ShareView = { covers: true, lines: false };

/** Whether a payload has anything to draw lines from. */
export const canDrawLines = (payload: SharePayload): boolean =>
  payload.l === "map" && payload.n.some((n) => (n.l?.length ?? 0) > 0);

/** The payload as `view` draws it: flags set, links kept only for lines. */
export const withView = (
  payload: SharePayload,
  view: ShareView,
): SharePayload => {
  const covers = view.covers ? {} : { nc: 1 as const };
  if (payload.l === "card") return { ...payload, ...covers };
  const lines = view.lines && canDrawLines(payload);
  return {
    ...payload,
    ...covers,
    ...(lines ? { ln: 1 as const } : {}),
    n: payload.n.map(({ l, ...album }) =>
      lines && l ? { ...album, l } : album,
    ),
  };
};

/**
 * Contributor id -> display name, from every search here. Ids are Discogs
 * artist ids, the same across searches, so a deleted step's people can
 * still be named from another search that has them.
 */
export const contributorNames = (
  searches: Record<string, SearchCache>,
): Map<number, string> => {
  const names = new Map<number, string>();
  for (const search of Object.values(searches)) {
    for (const contributor of Object.values(search.contributors ?? {})) {
      if (!names.has(contributor.id)) {
        names.set(
          contributor.id,
          defaultContributorDisplayPipeline(contributor.name),
        );
      }
    }
  }
  return names;
};

/** The album at the middle of a map. */
export interface MapCentre {
  key: string;
  title: string;
  artist: string;
  /** Art known for it already (e.g. a lineage snapshot's cover URL). */
  thumb?: string;
}

/**
 * Share map: `centre` in the middle, the other `members` (a stack's saved
 * searches, or none) and the liked albums in their results around it. See
 * `shareMap.ts` for how they're placed.
 */
export const mapPayload = (
  centre: MapCentre,
  members: SearchCache[],
  searches: Record<string, SearchCache>,
  likes: Likes,
  coverFor: CoverFor,
): SharePayload => {
  const names = contributorNames(searches);
  const { albums, people } = layoutMap(mapAlbums(centre.key, members, likes));
  return {
    v: 1,
    l: "map",
    c: {
      t: centre.title,
      r: centre.artist,
      i: artFor(centre.key, coverFor) || artIdFromCoverUrl(centre.thumb),
    },
    n: albums.map((album) => ({
      t: album.title,
      r: album.artist,
      i: artFor(album.key, coverFor),
      x: Math.round(album.x * 1000),
      y: Math.round(album.y * 1000),
      z: album.z,
    })),
    p: people
      .filter((person) => names.has(person.id))
      .slice(0, MAX_MAP_PEOPLE)
      .map((person) => ({
        n: names.get(person.id)!,
        a: Math.round((person.angle * 180) / Math.PI) % 360,
      })),
  };
};

/** Whether a map would have anything around its centre. */
export const mapHasAlbums = (payload: SharePayload): boolean =>
  payload.l === "map" && payload.n.length > 0;

/** base64url of the payload's UTF-8 JSON. */
export const encodeSharePayload = (payload: SharePayload): string => {
  // UTF-8 bytes as a binary string, without TextEncoder (not in every test
  // environment).
  const binary = encodeURIComponent(JSON.stringify(payload)).replace(
    /%([0-9A-F]{2})/g,
    (_, hex: string) => String.fromCharCode(parseInt(hex, 16)),
  );
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/** The image URL (same origin). Share images are square. */
export const shareImagePath = (payload: SharePayload): string =>
  `/api/og?${new URLSearchParams({ p: encodeSharePayload(payload) })}`;

/** The link a share carries: Open Graph tags for previews, then `to`. */
export const shareLink = (
  origin: string,
  payload: SharePayload,
  to: string,
): string =>
  `${origin}/s?${new URLSearchParams({ p: encodeSharePayload(payload), to })}`;
