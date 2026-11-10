import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useCache } from "@/contexts/cache/CacheContext";
import { backLink, resultParams, resultTarget } from "@/lib/routes";
import { matchingSearchIds } from "@/lib/searchTarget";
import { stacksWith } from "@/lib/stacks";
import { useLibraryStacks } from "./useLibraryStacks";

/**
 * The results page's back link (see `backLink`): where it was opened
 * from, or else the one stack its album is in, or the library.
 */
export const useResultsBack = (): { to: string; label: string } => {
  const { search, state } = useLocation();
  const { searches } = useCache();
  const stacks = useLibraryStacks();
  const stackId = useMemo(() => {
    const params = resultParams(search);
    if (!params) return null;
    const found =
      searches[matchingSearchIds(searches, params, resultTarget(search))[0]];
    if (!found) return null;
    const holding = stacksWith(found, stacks);
    return holding.length === 1 ? holding[0].stackId : null;
  }, [search, searches, stacks]);
  return backLink(state, stackId);
};
