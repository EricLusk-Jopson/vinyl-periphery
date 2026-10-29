import {
  LineageStep,
  SearchCache,
  SearchLineage,
} from "@/contexts/cache/types";

/**
 * Lineage: how each search was reached. A search from the search bar or a
 * results link is a root; a search from a result row continues its parent's
 * trail. Stored on the search, so it survives its ancestors being deleted.
 */

/** Where a search started from a result row came from. */
export interface SearchOrigin {
  parentSearchId: string;
  /** The clicked row's active contributors at click time. */
  via: number[];
}

export const rootLineage = (searchId: string): SearchLineage => ({
  stackId: searchId,
  depth: 0,
  path: [],
  via: [],
});

/**
 * A root on a trail of its own, for a search taken out of its stack (or
 * saved on its own). A fresh stack id, so it can't regroup even when the
 * stack it left was named after it (it was that stack's root).
 */
export const detachedLineage = (
  searchId: string,
  now = Date.now(),
): SearchLineage => ({
  ...rootLineage(searchId),
  stackId: `${searchId}~${now}`,
});

/** A search's lineage; older searches without one are roots. */
export const lineageOf = (search: SearchCache): SearchLineage =>
  search.lineage ?? rootLineage(search.searchId);

/** A snapshot of a search as a step on its children's trail. */
export const lineageStep = (
  search: SearchCache,
  thumb: string,
): LineageStep => ({
  searchId: search.searchId,
  targetKey: search.target?.key ?? "",
  title: search.searchParams.album,
  artist: search.searchParams.artist,
  thumb,
  via: lineageOf(search).via,
});

/** The lineage of a search started from a row in `parent`'s results. */
export const childLineage = (
  parent: SearchCache,
  via: number[],
  parentThumb: string,
): SearchLineage => {
  const from = lineageOf(parent);
  return {
    stackId: from.stackId,
    depth: from.depth + 1,
    path: [...from.path, lineageStep(parent, parentThumb)],
    via: [...via],
  };
};

/**
 * The lineage for a new search. A repeat run of an album keeps the lineage
 * of the search it replaces; otherwise it continues the parent's trail, or
 * starts a new one. A parent that's gone (cleared mid-search) makes a root.
 */
export const lineageForNewSearch = ({
  searchId,
  replaced,
  parent,
  origin,
  parentThumb = "",
}: {
  searchId: string;
  /** Searches this one replaces (same album). */
  replaced: SearchCache[];
  parent?: SearchCache;
  origin?: SearchOrigin;
  parentThumb?: string;
}): SearchLineage => {
  const kept = replaced.find((s) => s.lineage)?.lineage;
  if (kept) return kept;
  if (origin && parent) return childLineage(parent, origin.via, parentThumb);
  return rootLineage(searchId);
};
