import { ReleaseCredits } from "@/api/releaseCredits";

/**
 * Credits read from result albums, kept in localStorage so reopening a
 * result, in any search or a later visit, needs no new Discogs call. Apart
 * from the search cache so its shape doesn't change. Holds the most recent
 * MAX_ENTRIES; credits rarely change on Discogs, so entries don't expire.
 */

export const CREDITS_STORAGE_KEY = "vinyl-periphery-credits";
export const MAX_ENTRIES = 500;

interface Entry {
  /** When it was stored, for dropping the oldest. */
  at: number;
  value: ReleaseCredits;
}

type Store = Record<string, Entry>;

const read = (storage: Storage): Store => {
  try {
    const parsed = JSON.parse(storage.getItem(CREDITS_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const readCredits = (
  key: string,
  storage: Storage = localStorage,
): ReleaseCredits | undefined => {
  try {
    return read(storage)[key]?.value;
  } catch {
    return undefined;
  }
};

export const writeCredits = (
  key: string,
  value: ReleaseCredits,
  storage: Storage = localStorage,
  now = Date.now(),
): void => {
  try {
    const store = read(storage);
    store[key] = { at: now, value };
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => store[a].at - store[b].at)
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete store[k]);
    }
    storage.setItem(CREDITS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked: the credits still show, just aren't kept.
  }
};
