import { CacheState, SearchCache } from "@/contexts/cache/types";
import { searchStartedAt } from "./searches";

/**
 * sessionStorage holds about 5MB (in UTF-16 code units) per origin; going
 * over throws. Session searches are checked against a budget with headroom
 * before a search starts, so a full session asks the user to make room
 * instead of losing work. `navigator.storage.estimate()` doesn't cover
 * sessionStorage, so sizes are measured as serialised string lengths.
 */

export const SESSION_BUDGET_CHARS = 4_500_000;
/** Assumed size of a search before any have been measured. */
export const DEFAULT_SEARCH_CHARS = 400_000;
/** How many recent searches the size estimate averages. */
export const SIZE_WINDOW = 5;

/** What goes into sessionStorage: unsaved searches only (saved ones live in IndexedDB). */
export const sessionSnapshot = (state: CacheState) => ({
  searches: Object.fromEntries(
    Object.entries(state.searches).filter(
      ([id]) => !state.savedSearchIds.has(id),
    ),
  ),
  activeSearchId: state.activeSearchId,
  savedSearchIds: Array.from(state.savedSearchIds),
});

export const searchChars = (search: SearchCache): number =>
  JSON.stringify(search).length;

/**
 * Expected size of the next search: the average of the most recent ones
 * (saved or not), or a default before there are any.
 */
export const estimateNextSearch = (
  searches: SearchCache[],
  window = SIZE_WINDOW,
): number => {
  const recent = [...searches]
    .sort((a, b) => searchStartedAt(b.searchId) - searchStartedAt(a.searchId))
    .slice(0, window);
  if (recent.length === 0) return DEFAULT_SEARCH_CHARS;
  return Math.round(
    recent.reduce((sum, s) => sum + searchChars(s), 0) / recent.length,
  );
};

/** Whether another search fits in the session alongside what's there. */
export const hasRoomForSearch = (
  sessionChars: number,
  nextSearchChars: number,
  budget = SESSION_BUDGET_CHARS,
): boolean => sessionChars + nextSearchChars <= budget;

/**
 * Writes the session. Returns its length either way, and whether the
 * browser stored it (it refuses past its quota, or when storage is
 * blocked). Never throws.
 */
export const writeSession = (
  storage: Pick<Storage, "setItem">,
  key: string,
  snapshot: unknown,
): { chars: number; stored: boolean } => {
  const json = JSON.stringify(snapshot);
  try {
    storage.setItem(key, json);
    return { chars: json.length, stored: true };
  } catch {
    return { chars: json.length, stored: false };
  }
};
