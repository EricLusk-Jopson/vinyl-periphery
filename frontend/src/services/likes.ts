/**
 * Liked albums, kept in localStorage. A like belongs to the album (its
 * result key, "master:N" / "release:N"), not to a search, so it shows in
 * every search and stack the album turns up in. Liked albums fill in the
 * share map around a stack.
 */

export const LIKES_STORAGE_KEY = "vinyl-periphery-likes";

export interface Like {
  title: string;
  artist: string;
  likedAt: number;
}

export type Likes = Record<string, Like>;

const EMPTY: Likes = {};
let cache: Likes | null = null;
const listeners = new Set<() => void>();

const read = (): Likes => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIKES_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
};

/** The current likes; the same object until they change. */
export const getLikes = (): Likes => (cache ??= read());

const notify = () => listeners.forEach((listener) => listener());

/** Likes or unlikes an album. Returns whether it's liked now. */
export const setLiked = (
  key: string,
  liked: boolean,
  album: { title: string; artist: string },
  now = Date.now(),
): boolean => {
  const next = { ...getLikes() };
  if (liked) {
    next[key] = { title: album.title, artist: album.artist, likedAt: now };
  } else {
    delete next[key];
  }
  cache = next;
  try {
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the like holds until the page reloads.
  }
  notify();
  return liked;
};

/** For useSyncExternalStore; also follows other tabs. */
export const subscribeLikes = (listener: () => void): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LIKES_STORAGE_KEY) return;
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
export const resetLikesCache = () => {
  cache = null;
};
