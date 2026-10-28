import { SearchCache } from "@/contexts/cache/types";
import { lineageOf } from "./lineage";
import { ScoredRelease } from "./results";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Share images: the payload the renderer (/api/og) draws from, built from
 * data already in the app. Everything the image shows travels in the URL,
 * so rendering never calls Discogs. Format: backend/og/payload.js.
 */

export type ShareLayout = "card" | "trail";
export type ShareSize = "story" | "square";

/** Art id: "g:<release-group mbid>", "r:<release mbid>", or "". */
type ArtId = string;

interface ShareAlbum {
  t: string;
  r: string;
  i: ArtId;
}

export type SharePayload =
  | { v: 1; l: "card"; a: ShareAlbum; x: Array<ShareAlbum & { n: number }> }
  | { v: 1; l: "trail"; s: Array<ShareAlbum & { v: string[] }> };

export const SHARE_RESULTS = 6;
export const SHARE_STEPS = 6;
const MAX_VIA = 4;

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

const viaNames = (ids: number[], names: Map<number, string>) =>
  ids
    .map((id) => names.get(id))
    .filter((name): name is string => Boolean(name))
    .slice(0, MAX_VIA);

/** Trail: root to this search, with who linked each step to the last. */
export const trailPayload = (
  search: SearchCache,
  searches: Record<string, SearchCache>,
  coverFor: CoverFor,
): SharePayload => {
  const names = contributorNames(searches);
  const lineage = lineageOf(search);
  const steps = [
    ...lineage.path.map((step) => ({
      t: step.title,
      r: step.artist,
      // The snapshot's art if it was a cover URL, else whatever is known now.
      i: artIdFromCoverUrl(step.thumb) || artFor(step.targetKey, coverFor),
      v: viaNames(step.via, names),
    })),
    {
      t: search.searchParams.album,
      r: search.searchParams.artist,
      i: artFor(search.target?.key, coverFor),
      v: viaNames(lineage.via, names),
    },
  ];
  return { v: 1, l: "trail", s: steps.slice(-SHARE_STEPS) };
};

/** Whether a search has a trail worth drawing (it was reached from another). */
export const hasTrail = (search: SearchCache): boolean =>
  lineageOf(search).path.length > 0;

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

/** The image URL (same origin). */
export const shareImagePath = (
  payload: SharePayload,
  size: ShareSize,
): string =>
  `/api/og?${new URLSearchParams({ p: encodeSharePayload(payload), size })}`;

/** The link a share carries: Open Graph tags for previews, then `to`. */
export const shareLink = (
  origin: string,
  payload: SharePayload,
  to: string,
): string =>
  `${origin}/s?${new URLSearchParams({ p: encodeSharePayload(payload), to })}`;

export const SIZES: { id: ShareSize; label: string; ratio: string }[] = [
  { id: "story", label: "Story", ratio: "9 / 16" },
  { id: "square", label: "Square", ratio: "1 / 1" },
];
