import { useState } from "react";
import { SortKey, tiebreakOptions } from "@/lib/results";
import { useMediaQuery } from "./useMediaQuery";

export interface ResultsSort {
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  /** The tiebreaker in effect: chosen and valid for `sort`. */
  then: SortKey | null;
  setThen: (then: SortKey | null) => void;
  /** Whether the tiebreaker menu is offered (desktop only; elsewhere the
   * default tiebreaker still applies). */
  canBreakTies: boolean;
}

/** The order results start in: most shared, then most popular. */
export const DEFAULT_SORT: { sort: SortKey; then: SortKey } = {
  sort: "shared",
  then: "popular",
};

/**
 * The results' order, shared by the list and Share (which draws the top
 * albums in the same order).
 */
export const useResultsSort = (): ResultsSort => {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT.sort);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [chosen, setThen] = useState<SortKey | null>(DEFAULT_SORT.then);
  const then = tiebreakOptions(sort).some((o) => o.value === chosen)
    ? chosen
    : null;
  return { sort, setSort, then, setThen, canBreakTies: desktop };
};
