import { ReleaseType } from "./types";

/**
 * Album art without Discogs image calls: MusicBrainz maps a Discogs master
 * or release URL to a release group or release, and the Cover Art Archive
 * serves art for those. All from the browser; nothing goes through /api.
 *
 * MusicBrainz allows about one request a second per IP, so lookups run one
 * batch at a time, MB_REQUEST_GAP_MS apart, backing off on 503.
 */

/**
 * URLs per lookup. An existing client uses 100; the server's maximum isn't
 * confirmed (the build sandbox can't reach musicbrainz.org).
 */
export const MB_BATCH_SIZE = 100;
export const MB_REQUEST_GAP_MS = 1100;
/** Waits after a 503, doubling each time, before giving up on a batch. */
export const MB_BACKOFF_MS = [2000, 4000, 8000];

export type CoverKind = "release-group" | "release";

export interface CoverMatch {
  kind: CoverKind;
  mbid: string;
}

/** The Discogs web URL MusicBrainz stores for a master or release. */
export const discogsUrl = (type: ReleaseType, id: number): string =>
  `https://www.discogs.com/${type}/${id}`;

/** The lookup URL for a batch of Discogs URLs. */
export const lookupUrl = (resources: string[]): string =>
  `https://musicbrainz.org/ws/2/url?${resources
    .map((r) => `resource=${encodeURIComponent(r)}`)
    .join("&")}&inc=release-group-rels+release-rels&fmt=json`;

/** Front cover, 250px, from the Cover Art Archive. An image, not an API. */
export const coverArtUrl = ({ kind, mbid }: CoverMatch): string =>
  `https://coverartarchive.org/${kind}/${mbid}/front-250`;

/** The release-group target is keyed `release_group`; both are accepted. */
interface RawRelation {
  "target-type"?: string;
  release_group?: { id?: string };
  "release-group"?: { id?: string };
  release?: { id?: string };
}

interface RawUrl {
  resource?: string;
  relations?: RawRelation[];
}

/** Trailing slashes and http/https differences don't stop a match. */
const normaliseUrl = (url: string) =>
  url
    .trim()
    .replace(/^http:/, "https:")
    .replace(/\/+$/, "");

/**
 * Discogs URL -> match, from a lookup response. One URL comes back as a
 * single object; several as `{ urls: [...] }`. URLs MusicBrainz doesn't know
 * are missing from the response: those are misses. A master's URL links a
 * release group, a release's a release; either is taken when present.
 */
export const parseLookup = (json: unknown): Map<string, CoverMatch> => {
  const data = (json ?? {}) as { urls?: RawUrl[] } & RawUrl;
  const urls: RawUrl[] = Array.isArray(data.urls) ? data.urls : [data];
  const matches = new Map<string, CoverMatch>();
  for (const url of urls) {
    if (!url?.resource) continue;
    for (const relation of url.relations ?? []) {
      const group = (relation.release_group ?? relation["release-group"])?.id;
      const release = relation.release?.id;
      const match: CoverMatch | null = group
        ? { kind: "release-group", mbid: group }
        : release
          ? { kind: "release", mbid: release }
          : null;
      if (match) {
        matches.set(normaliseUrl(url.resource), match);
        break;
      }
    }
  }
  return matches;
};

/** `items` in groups of `size`. */
export const batches = <T>(items: T[], size = MB_BATCH_SIZE): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One lookup at a time, MB_REQUEST_GAP_MS apart, across the whole app.
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

const queued = <T>(call: () => Promise<T>): Promise<T> => {
  const run = queue.then(async () => {
    const gap = lastCall + MB_REQUEST_GAP_MS - Date.now();
    if (gap > 0) await wait(gap);
    try {
      return await call();
    } finally {
      lastCall = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
};

export class MusicBrainzError extends Error {
  constructor(readonly status: number) {
    super(`MusicBrainz lookup failed: ${status}`);
    this.name = "MusicBrainzError";
  }
}

/**
 * Looks up one batch of Discogs URLs (at most MB_BATCH_SIZE). Resolves to
 * the matches found; a 404 means none matched. Retries 503s with backoff,
 * then fails, so the caller can leave the batch for another time rather
 * than record misses.
 */
export const lookupBatch = (
  resources: string[],
): Promise<Map<string, CoverMatch>> =>
  queued(async () => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(lookupUrl(resources), {
        headers: { Accept: "application/json" },
      });
      if (response.ok) return parseLookup(await response.json());
      if (response.status === 404) return new Map();
      if (response.status === 503 && attempt < MB_BACKOFF_MS.length) {
        await wait(MB_BACKOFF_MS[attempt]);
        continue;
      }
      throw new MusicBrainzError(response.status);
    }
  });

/** The match for a Discogs URL in a lookup result, or null for a miss. */
export const matchFor = (
  matches: Map<string, CoverMatch>,
  resource: string,
): CoverMatch | null => matches.get(normaliseUrl(resource)) ?? null;
