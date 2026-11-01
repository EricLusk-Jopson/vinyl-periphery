import { useState } from "react";
import { SortKey } from "@/lib/results";
import {
  DEFAULT_STACK_SORT,
  StackSortKey,
  stackTiebreakOptions,
} from "@/lib/stackFilters";
import { useMediaQuery } from "./useMediaQuery";

export interface StackSort {
  sort: StackSortKey;
  setSort: (sort: StackSortKey) => void;
  /** The tiebreaker in effect: chosen and valid for `sort`. */
  then: SortKey | null;
  setThen: (then: SortKey | null) => void;
  /** The tiebreaker menu is offered on desktop only. */
  canBreakTies: boolean;
}

/** A stack's results order: most links, then most shared, then popular. */
export const useStackSort = (): StackSort => {
  const [sort, setSort] = useState<StackSortKey>(DEFAULT_STACK_SORT.sort);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [chosen, setThen] = useState<SortKey | null>(DEFAULT_STACK_SORT.then);
  const then = stackTiebreakOptions(sort).some((o) => o.value === chosen)
    ? chosen
    : null;
  return { sort, setSort, then, setThen, canBreakTies: desktop };
};
