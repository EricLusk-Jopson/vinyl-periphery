import { CoverKind } from "@/api/musicbrainz";

/**
 * Discogs key -> MusicBrainz match, misses included, in IndexedDB so art
 * lookups happen once per album per browser. A separate database from saved
 * searches, so neither needs the other's version bumps. Where IndexedDB is
 * unavailable (private windows, tests) it keeps the mappings in memory.
 */

const DB_NAME = "vinyl-periphery-covers";
const DB_VERSION = 1;
const STORE = "covers";

/** Misses are checked again after this long: MusicBrainz keeps growing. */
export const MISS_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;

export interface CoverEntry {
  /** "master:123" / "release:456". */
  key: string;
  /** Null for a miss: MusicBrainz had no link for this Discogs page. */
  mbid: string | null;
  kind: CoverKind;
  checkedAt: number;
}

/** Whether an entry is missing or a miss old enough to check again. */
export const needsCheck = (
  entry: CoverEntry | undefined,
  now = Date.now(),
): boolean =>
  !entry || (entry.mbid === null && now - entry.checkedAt >= MISS_RECHECK_MS);

const memory = new Map<string, CoverEntry>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === "undefined") return resolve(null);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) {
            request.result.createObjectStore(STORE, { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
};

/** Stored entries for these keys; keys with none are left out. */
export const readCovers = async (
  keys: string[],
): Promise<Map<string, CoverEntry>> => {
  const found = new Map<string, CoverEntry>();
  const db = await openDb();
  if (!db) {
    for (const key of keys) {
      const entry = memory.get(key);
      if (entry) found.set(key, entry);
    }
    return found;
  }
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE, "readonly").objectStore(STORE);
      let pending = keys.length;
      if (pending === 0) return resolve(found);
      for (const key of keys) {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) found.set(key, request.result as CoverEntry);
          if (--pending === 0) resolve(found);
        };
        request.onerror = () => {
          if (--pending === 0) resolve(found);
        };
      }
    } catch {
      resolve(found);
    }
  });
};

/** Stores entries. Failures are ignored: art just gets looked up again. */
export const writeCovers = async (entries: CoverEntry[]): Promise<void> => {
  const db = await openDb();
  if (!db) {
    entries.forEach((entry) => memory.set(entry.key, entry));
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      entries.forEach((entry) => store.put(entry));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
};
