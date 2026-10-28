import { useState } from "react";
import { SortKey, tiebreakOptions } from "@/lib/results";
import { useMediaQuery } from "./useMediaQuery";

export interface ResultsSort {
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  /** The tiebreaker in effect: chosen, valid for `sort`, and on desktop. */
  then: SortKey | null;
  setThen: (then: SortKey | null) => void;
  /** Whether the tiebreaker menu is offered (desktop only). */
  canBreakTies: boolean;
}

/**
 * The results' order, shared by the list and Share (which draws the top
 * albums in the same order).
 */
export const useResultsSort = (): ResultsSort => {
  const [sort, setSort] = useState<SortKey>("shared");
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [chosen, setThen] = useState<SortKey | null>(null);
  const then =
    desktop && tiebreakOptions(sort).some((o) => o.value === chosen)
      ? chosen
      : null;
  return { sort, setSort, then, setThen, canBreakTies: desktop };
};
