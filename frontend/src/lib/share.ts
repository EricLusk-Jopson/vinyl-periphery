import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { ScoredRelease } from "./results";
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
  | { v: 1; l: "card"; a: ShareAlbum; x: Array<ShareAlbum & { n: number }> }
  | {
      v: 1;
      l: "map";
      c: ShareAlbum;
      /** x, y: thousandths of the radius, y up; z: size tier. */
      n: Array<ShareAlbum & { x: number; y: number; z: 1 | 2 }>;
      /** People around the rim: name, and angle in degrees. */
      p: Array<{ n: string; a: number }>;
    };

export const SHARE_RESULTS = 6;

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
): SharePayload => ({
  v: 1,
  l: "card",
  a: {
    t: search.searchParams.album,
    r: search.searchParams.artist,
    i: artFor(search.target?.key, coverFor),
  },
  x: ranked.slice(0, SHARE_RESULTS).map((release) => ({
    t: release.title,
    r: release.artist,
    i: artFor(release.key, coverFor),
    n: release.activeContributors.length,
  })),
});

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
