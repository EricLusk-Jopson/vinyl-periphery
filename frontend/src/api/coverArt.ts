import { targetFromKey } from "@/lib/searchTarget";
import {
  CoverEntry,
  DiscogsCover,
  needsCheck,
  needsDiscogsCheck,
  readCovers,
  writeCovers,
} from "@/services/coverCache";
import {
  batches,
  CoverMatch,
  coverArtUrl,
  discogsUrl,
  lookupBatch,
  matchFor,
  MB_BATCH_SIZE,
} from "./musicbrainz";

/**
 * Resolves result keys ("master:N" / "release:N") to cover image URLs:
 * stored mappings first, then MusicBrainz in batches, most wanted first.
 * One resolver for the app, so rows across pages share lookups and the
 * MusicBrainz queue. Covers found on Discogs (only ever on request, see
 * `discogsArt.ts`) fill in where the Cover Art Archive has none, or its
 * image didn't load.
 */

/** A URL, null for no art, undefined while unknown. */
export type CoverState = string | null | undefined;

interface Deps {
  lookup: (resources: string[]) => Promise<Map<string, CoverMatch>>;
  read: (keys: string[]) => Promise<Map<string, CoverEntry>>;
  write: (entries: CoverEntry[]) => Promise<void>;
  now: () => number;
}

export const createCoverResolver = (deps: Deps) => {
  const known = new Map<string, string | null>();
  /** Discogs covers asked for: by key, as stored. */
  const discogs = new Map<string, DiscogsCover>();
  /** Cover Art Archive URLs that failed to load this session. */
  const broken = new Set<string>();
  /** Wanted keys not yet resolved, most wanted first. */
  let pending: string[] = [];
  /** Keys whose lookup failed this session; not retried until reload. */
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  let running = false;

  const notify = () => listeners.forEach((listener) => listener());

  /** The Cover Art Archive's URL, null for none (or broken), or undefined. */
  const caaFor = (key: string): CoverState => {
    if (known.has(key)) {
      const url = known.get(key) ?? null;
      return url && broken.has(url) ? null : url;
    }
    return failed.has(key) ? null : undefined;
  };

  const pump = async () => {
    if (running) return;
    running = true;
    try {
      while (pending.length > 0) {
        const batch = pending.slice(0, MB_BATCH_SIZE);
        // Stored mappings first: no network for those.
        const stored = await deps.read(batch);
        const toLookUp: string[] = [];
        for (const key of batch) {
          const entry = stored.get(key);
          if (entry?.discogs) discogs.set(key, entry.discogs);
          if (entry && !needsCheck(entry, deps.now())) {
            known.set(
              key,
              entry.mbid
                ? coverArtUrl({ kind: entry.kind, mbid: entry.mbid })
                : null,
            );
          } else {
            toLookUp.push(key);
          }
        }
        if (stored.size > 0) notify();

        for (const group of batches(toLookUp)) {
          const targets = group.map((key) => ({
            key,
            target: targetFromKey(key),
          }));
          const resources = targets
            .filter((t) => t.target)
            .map((t) => discogsUrl(t.target!.type, t.target!.id));
          try {
            const matches =
              resources.length > 0 ? await deps.lookup(resources) : new Map();
            const entries: CoverEntry[] = [];
            for (const { key, target } of targets) {
              const match = target
                ? matchFor(matches, discogsUrl(target.type, target.id))
                : null;
              known.set(key, match ? coverArtUrl(match) : null);
              entries.push({
                key,
                mbid: match?.mbid ?? null,
                kind:
                  match?.kind ??
                  (target?.type === "master" ? "release-group" : "release"),
                checkedAt: deps.now(),
                // Kept: a Discogs answer outlives a MusicBrainz recheck.
                ...(discogs.has(key) ? { discogs: discogs.get(key) } : {}),
              });
            }
            await deps.write(entries);
          } catch {
            group.forEach((key) => failed.add(key));
          }
          notify();
        }
        pending = pending.filter((key) => !batch.includes(key));
      }
    } finally {
      running = false;
      notify();
    }
  };

  return {
    /**
     * Asks for art for these keys, most wanted first. They jump ahead of
     * anything already waiting, so rows on screen resolve first.
     */
    request(keys: string[]) {
      const wanted = keys.filter((key) => !known.has(key) && !failed.has(key));
      if (wanted.length === 0) return;
      const front = new Set(wanted);
      pending = [...wanted, ...pending.filter((key) => !front.has(key))];
      void pump();
    },
    /**
     * A row's cover: the Cover Art Archive's, then Discogs's (small). Null
     * for none, undefined while unknown.
     */
    get(key: string): CoverState {
      const caa = caaFor(key);
      if (caa) return caa;
      const found = discogs.get(key)?.thumb;
      if (found) return found;
      return caa;
    },
    /** The same cover at full size, for share images. */
    large(key: string): CoverState {
      const caa = caaFor(key);
      if (caa) return caa;
      const found = discogs.get(key)?.url;
      if (found) return found;
      return caa;
    },
    /**
     * Known to have no usable cover (no Cover Art Archive image, or one
     * that failed to load) and Discogs not asked yet (or a miss gone
     * stale): what "Find missing covers" would ask Discogs for.
     */
    missing(key: string): boolean {
      if (caaFor(key) !== null) return false;
      return needsDiscogsCheck(
        discogs.has(key) ? { discogs: discogs.get(key) } : undefined,
        deps.now(),
      );
    },
    /** Stores what Discogs answered for a key, and redraws. */
    async setDiscogs(key: string, url: string | null, thumb: string | null) {
      const entry: DiscogsCover = {
        source: "discogs",
        url,
        thumb: thumb ?? url,
        checkedAt: deps.now(),
      };
      discogs.set(key, entry);
      notify();
      const stored = (await deps.read([key])).get(key);
      const target = targetFromKey(key);
      await deps.write([
        {
          key,
          mbid: stored?.mbid ?? null,
          kind:
            stored?.kind ??
            (target?.type === "master" ? "release-group" : "release"),
          checkedAt: stored?.checkedAt ?? 0,
          discogs: entry,
        },
      ]);
    },
    /** An image that didn't load (`AlbumCover`): counts as no cover. */
    reportBroken(url: string) {
      if (broken.has(url) || !/coverartarchive\.org/.test(url)) return;
      broken.add(url);
      notify();
    },
    /** Nothing waiting or being looked up. */
    idle: () => !running && pending.length === 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export type CoverResolver = ReturnType<typeof createCoverResolver>;

/** The app's resolver. */
export const coverResolver = createCoverResolver({
  lookup: lookupBatch,
  read: readCovers,
  write: writeCovers,
  now: Date.now,
});
