import { ReleaseType, SearchParams, SearchTarget } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { releaseKey } from "./releases";

/** A target from its type and id. */
export const searchTarget = (type: ReleaseType, id: number): SearchTarget => ({
  type,
  id,
  key: releaseKey(type, id),
});

/** "master:123" -> a target, or null for anything else. */
export const targetFromKey = (
  key: string | null | undefined,
): SearchTarget | null => {
  const match = /^(master|release):(\d+)$/.exec(key ?? "");
  if (!match) return null;
  const id = Number(match[2]);
  return id > 0 ? searchTarget(match[1] as ReleaseType, id) : null;
};

/**
 * The album a text search found: the first result's master when it has one,
 * otherwise the release itself.
 */
export const targetFromSearchResult = (
  result: { id: number; master_id?: number } | undefined,
): SearchTarget | null => {
  if (!result) return null;
  if (Number(result.master_id) > 0) {
    return searchTarget("master", Number(result.master_id));
  }
  return result.id > 0 ? searchTarget("release", result.id) : null;
};

const normalise = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

const sameText = (a: SearchParams, b: SearchParams) =>
  normalise(a.artist) === normalise(b.artist) &&
  normalise(a.album) === normalise(b.album);

/**
 * Ids of stored searches for the same album. With a target, a search
 * matches on its target key; searches from before targets existed match on
 * typed artist and album. Without a target (a results link with no id),
 * the typed text is all there is.
 */
export const matchingSearchIds = (
  searches: Record<string, SearchCache>,
  params: SearchParams,
  target?: SearchTarget | null,
): string[] =>
  Object.values(searches)
    .filter((s) =>
      target && s.target
        ? s.target.key === target.key
        : sameText(s.searchParams, params),
    )
    .map((s) => s.searchId);
