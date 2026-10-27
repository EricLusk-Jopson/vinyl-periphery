import { defaultRolePipeline } from "../lib/transformers/roleProcessor";
import { sleep } from "./abort";
import { REQUEST_DELAY_MS } from "./limits";
import { EnrichedRelease, RawArtist } from "./types";

/**
 * What each person did on a result album, read from that album's Discogs
 * release when its row is opened. The search itself only knows who links a
 * result to the searched album, not what they did on it.
 */

/** One role on a release, on every track or only some. */
export interface Credit {
  role: string;
  /** Track positions ("A1", "B2"); absent when it covers the whole release. */
  tracks?: string[];
}

export interface ReleaseCredits {
  /** The Discogs release the credits were read from. */
  releaseId: number;
  /** True when read from a master's main release rather than the result. */
  fromMainRelease: boolean;
  /** Artist id -> what they did. Empty array: credited with no role. */
  credits: Record<number, Credit[]>;
}

/** Which Discogs object a result is, from its API resource URL. */
export type CreditsTarget =
  | { kind: "release"; id: number }
  | { kind: "master"; id: number; mainRelease?: number };

/** Artist releases list masters with `main_release`; the type omits it. */
type ResultRelease = EnrichedRelease & { main_release?: number };

export const creditsTarget = (release: ResultRelease): CreditsTarget | null => {
  const match = release.resource_url?.match(
    /^https:\/\/api\.discogs\.com\/(releases|masters)\/(\d+)\/?$/,
  );
  if (!match) return null;
  const id = Number(match[2]);
  if (match[1] === "releases") return { kind: "release", id };
  return {
    kind: "master",
    id,
    ...(Number(release.main_release) > 0
      ? { mainRelease: Number(release.main_release) }
      : {}),
  };
};

/** Cache key. Masters and releases are kept apart: their ids overlap. */
export const targetKey = (target: CreditsTarget): string =>
  `${target.kind}:${target.id}`;

interface RawCreditedArtist extends RawArtist {
  /** Discogs's track list for a credit, e.g. "A1 to A3, B2". */
  tracks?: string;
}

interface RawTrack {
  position?: string;
  type_?: string;
  artists?: RawCreditedArtist[];
  extraartists?: RawCreditedArtist[];
  sub_tracks?: RawTrack[];
}

export interface RawRelease {
  id: number;
  artists?: RawCreditedArtist[];
  extraartists?: RawCreditedArtist[];
  tracklist?: RawTrack[];
}

const splitTracks = (tracks: string | undefined): string[] | undefined => {
  const list = (tracks ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
};

/**
 * Roles per artist id on a release: main artists, release credits, and
 * per-track artists and credits. A role on the whole release wins over the
 * same role on some tracks. Roles go through `defaultRolePipeline`, the same
 * cleanup as the searched album's roles.
 */
export const parseReleaseCredits = (
  data: RawRelease,
): Record<number, Credit[]> => {
  // id -> role -> tracks (null: the whole release)
  const found = new Map<number, Map<string, Set<string> | null>>();

  const add = (
    artist: RawCreditedArtist,
    rawRole: string | string[] | undefined,
    tracks: string[] | undefined,
  ) => {
    if (!artist?.id) return;
    const roles = found.get(artist.id) ?? new Map();
    found.set(artist.id, roles);
    for (const role of defaultRolePipeline(
      ([] as (string | undefined)[])
        .concat(rawRole)
        .filter((r): r is string => !!r),
    )) {
      if (!tracks) {
        roles.set(role, null);
      } else if (roles.get(role) !== null) {
        const set = roles.get(role) ?? new Set<string>();
        tracks.forEach((t) => set.add(t));
        roles.set(role, set);
      }
    }
  };

  data.artists?.forEach((a) => add(a, "Main Artist", undefined));
  data.extraartists?.forEach((a) => add(a, a.role, splitTracks(a.tracks)));

  const readTrack = (track: RawTrack) => {
    const position = track.position?.trim();
    const tracks = position ? [position] : undefined;
    track.artists?.forEach((a) => add(a, "Track Artist", tracks));
    track.extraartists?.forEach((a) => add(a, a.role, tracks));
    track.sub_tracks?.forEach(readTrack);
  };
  data.tracklist?.forEach(readTrack);

  return Object.fromEntries(
    Array.from(found, ([id, roles]) => [
      id,
      Array.from(roles, ([role, tracks]) =>
        tracks ? { role, tracks: Array.from(tracks) } : { role },
      ),
    ]),
  );
};

export class DiscogsError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 for a network failure. */
    readonly status: number,
  ) {
    super(message);
    this.name = "DiscogsError";
  }
}

// Credit lookups run one at a time, REQUEST_DELAY_MS apart, so opening rows
// quickly can't run past Discogs's rate limit.
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

const queued = <T>(call: () => Promise<T>): Promise<T> => {
  const run = queue.then(async () => {
    const wait = lastCall + REQUEST_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return call();
  });
  queue = run.catch(() => {});
  return run;
};

const getJson = async <T>(path: string): Promise<T> =>
  queued(async () => {
    let response: Response;
    try {
      response = await fetch(`https://api.discogs.com${path}`);
    } catch {
      throw new DiscogsError("Network error", 0);
    }
    if (!response.ok) {
      throw new DiscogsError(
        response.statusText || "Request failed",
        response.status,
      );
    }
    return (await response.json()) as T;
  });

/**
 * Fetches and parses a result's credits. A master is read from its main
 * release: one call when the result already names it, two when not.
 */
export const fetchReleaseCredits = async (
  target: CreditsTarget,
): Promise<ReleaseCredits> => {
  let releaseId = target.id;
  if (target.kind === "master") {
    releaseId =
      target.mainRelease ??
      (await getJson<{ main_release?: number }>(`/masters/${target.id}`))
        .main_release ??
      0;
    if (!releaseId) throw new DiscogsError("No main release", 404);
  }
  const data = await getJson<RawRelease>(`/releases/${releaseId}`);
  return {
    releaseId,
    fromMainRelease: target.kind === "master",
    credits: parseReleaseCredits(data),
  };
};
