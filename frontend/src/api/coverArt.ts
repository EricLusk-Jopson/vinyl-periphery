import { targetFromKey } from "@/lib/searchTarget";
import {
  CoverEntry,
  needsCheck,
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
 * MusicBrainz queue.
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
  /** Wanted keys not yet resolved, most wanted first. */
  let pending: string[] = [];
  /** Keys whose lookup failed this session; not retried until reload. */
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  let running = false;

  const notify = () => listeners.forEach((listener) => listener());

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
    get(key: string): CoverState {
      return known.has(key)
        ? known.get(key)
        : failed.has(key)
          ? null
          : undefined;
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
