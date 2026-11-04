/**
 * Covers from Discogs (GET /api/art), for albums MusicBrainz and the Cover
 * Art Archive don't have. Only on request ("Find missing covers"), never
 * by itself: the app's Discogs key has 60 requests a minute shared by
 * every user and by search. One user's requests go one at a time, 1.5s
 * apart (40 a minute at most); a 429 stops the queue, with no retry.
 */

export const ART_GAP_MS = 1500;

export interface DiscogsArt {
  key: string;
  /** Full size, or null for no image on Discogs. */
  image: string | null;
  thumb: string | null;
}

/** Discogs (or the server holding back for search) said not now. */
export class ArtBusyError extends Error {
  constructor() {
    super("Discogs is busy");
    this.name = "ArtBusyError";
  }
}

export const fetchDiscogsArt = async (
  key: string,
  signal?: AbortSignal,
): Promise<DiscogsArt> => {
  const response = await fetch(`/api/art?${new URLSearchParams({ key })}`, {
    signal,
  });
  if (response.status === 429) throw new ArtBusyError();
  if (!response.ok) throw new Error(`Art failed: ${response.status}`);
  const body = (await response.json()) as Partial<DiscogsArt>;
  const url = (value: unknown) =>
    typeof value === "string" && /^https:\/\/i\.discogs\.com\//.test(value)
      ? value
      : null;
  return { key, image: url(body.image), thumb: url(body.thumb) };
};

export interface ArtRunResult {
  found: number;
  none: number;
  /** Stopped by a 429. */
  busy: boolean;
  /** Stopped by the user. */
  cancelled: boolean;
  /** Keys that failed otherwise (left to try again). */
  failed: number;
}

interface RunOptions {
  signal: AbortSignal;
  /** Each answer, as it comes. */
  onResult: (art: DiscogsArt) => void | Promise<void>;
  /** After each key (answered or failed): how many are done. */
  onProgress?: (done: number) => void;
  fetchArt?: typeof fetchDiscogsArt;
  gapMs?: number;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** Asks Discogs for each key in turn, `gapMs` apart. */
export const runArtQueue = async (
  keys: string[],
  {
    signal,
    onResult,
    onProgress,
    fetchArt = fetchDiscogsArt,
    gapMs = ART_GAP_MS,
    wait = pause,
  }: RunOptions,
): Promise<ArtRunResult> => {
  const result: ArtRunResult = {
    found: 0,
    none: 0,
    busy: false,
    cancelled: false,
    failed: 0,
  };
  for (let i = 0; i < keys.length; i++) {
    if (signal.aborted) {
      result.cancelled = true;
      break;
    }
    if (i > 0) {
      await wait(gapMs, signal);
      if (signal.aborted) {
        result.cancelled = true;
        break;
      }
    }
    try {
      const art = await fetchArt(keys[i], signal);
      await onResult(art);
      if (art.image) result.found++;
      else result.none++;
    } catch (error) {
      if (signal.aborted) {
        result.cancelled = true;
        break;
      }
      if (error instanceof ArtBusyError) {
        result.busy = true;
        break;
      }
      result.failed++;
    }
    onProgress?.(i + 1);
  }
  return result;
};
