import { SearchCache } from "@/contexts/cache/types";
import { isContributorCounted } from "./filters";
import { ScoredRelease } from "./results";

type FilterState = SearchCache["filterState"];

/**
 * Edits to a share image's albums: ones taken out, and ones added from a
 * search of the results. Kept while the share sheet is open for a search.
 */
export interface ShareEdits {
  removed: string[];
  added: string[];
}

export const NO_EDITS: ShareEdits = { removed: [], added: [] };

/**
 * Filter updates that link an album through the usual filters: its people
 * switched on, with every role they had on the searched album. Nothing is
 * switched off, so what else shows only grows.
 */
export const filtersToInclude = (
  search: SearchCache,
  key: string,
): Partial<FilterState> | null => {
  const release = search.releases[key];
  if (!release) return null;
  const people = Array.from(new Set(release.contributorIds)).filter(
    (id) => search.contributors[id],
  );
  if (people.length === 0) return null;
  const roles = new Set(people.flatMap((id) => search.contributors[id].roles));
  return {
    contributors: {
      ...search.filterState.contributors,
      ...Object.fromEntries(people.map((id) => [id, true])),
    },
    roles: {
      ...search.filterState.roles,
      ...Object.fromEntries(Array.from(roles, (role) => [role, true])),
    },
  };
};

/**
 * A result as the list would score it, for an album added to a share that
 * the switches (2+ shared, Only liked...) still hide: linked by its people
 * the filters count.
 */
export const scoredFor = (
  search: SearchCache,
  key: string,
): ScoredRelease | null => {
  const release = search.releases[key];
  if (!release) return null;
  const active = Array.from(new Set(release.contributorIds)).filter((id) =>
    isContributorCounted(search, id),
  );
  return {
    ...release,
    score: active.length,
    confidence: 1,
    activeContributors: active,
  };
};

const shared = (r: ScoredRelease) => new Set(r.activeContributors).size;

/**
 * The albums a share image draws: the top `count` of `ranked` (the list in
 * its order) less the removed ones, plus the added ones (which always
 * make it, counted within `count`). Added albums the list hides take
 * their place by shared count, ahead of albums sharing as many.
 */
export const shareSelection = (
  search: SearchCache,
  ranked: ScoredRelease[],
  count: number,
  edits: ShareEdits,
): ScoredRelease[] => {
  const removed = new Set(edits.removed);
  const added = new Set(edits.added.filter((key) => !removed.has(key)));
  const pool = ranked.filter((r) => !removed.has(r.key));
  const inPool = new Set(pool.map((r) => r.key));
  const fill = Math.max(0, count - added.size);
  let chosen = 0;
  const picked = pool.filter((r) => {
    if (added.has(r.key)) return true;
    if (chosen >= fill) return false;
    chosen++;
    return true;
  });
  const extras = Array.from(added)
    .filter((key) => !inPool.has(key))
    .map((key) => scoredFor(search, key))
    .filter((r): r is ScoredRelease => r !== null);
  for (const extra of extras) {
    const at = picked.findIndex((r) => shared(r) <= shared(extra));
    picked.splice(at === -1 ? picked.length : at, 0, extra);
  }
  return picked;
};

/** The edits, in words for the caption: "2 removed · 1 added". */
export const editsCaption = (edits: ShareEdits): string =>
  [
    edits.removed.length > 0 ? `${edits.removed.length} removed` : "",
    edits.added.length > 0 ? `${edits.added.length} added` : "",
  ]
    .filter(Boolean)
    .join(" · ");
