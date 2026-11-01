/**
 * Hidden albums, kept in localStorage. Like a like, a hide belongs to the
 * album (its result key), not to a search: it's hidden in every search it
 * turns up in. Hidden albums leave the results unless "Show hidden albums"
 * is on, and never go into a share image.
 */

export const HIDDEN_STORAGE_KEY = "vinyl-periphery-hidden";

export interface HiddenAlbum {
  title: string;
  artist: string;
  hiddenAt: number;
}

export type Hidden = Record<string, HiddenAlbum>;

const EMPTY: Hidden = {};
let cache: Hidden | null = null;
const listeners = new Set<() => void>();

const read = (): Hidden => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
};

/** The hidden albums; the same object until they change. */
export const getHidden = (): Hidden => (cache ??= read());

const notify = () => listeners.forEach((listener) => listener());

/** Hides or shows an album again. Returns whether it's hidden now. */
export const setHidden = (
  key: string,
  hidden: boolean,
  album: { title: string; artist: string },
  now = Date.now(),
): boolean => {
  const next = { ...getHidden() };
  if (hidden) {
    next[key] = { title: album.title, artist: album.artist, hiddenAt: now };
  } else {
    delete next[key];
  }
  cache = next;
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: hidden until the page reloads.
  }
  notify();
  return hidden;
};

/** For useSyncExternalStore; also follows other tabs. */
export const subscribeHidden = (listener: () => void): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== HIDDEN_STORAGE_KEY) return;
    cache = null;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** Forgets the in-memory copy (tests). */
export const resetHiddenCache = () => {
  cache = null;
};
