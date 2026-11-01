import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useCache } from "@/contexts/cache/CacheContext";
import { backLink, resultParams, resultTarget } from "@/lib/routes";
import { matchingSearchIds } from "@/lib/searchTarget";
import { savedInStack, stackIdOf } from "@/lib/stacks";

/**
 * The results page's back link (see `backLink`): where it was opened
 * from, or else the stack its search is in, or the library.
 */
export const useResultsBack = (): { to: string; label: string } => {
  const { search, state } = useLocation();
  const { searches, savedSearchIds } = useCache();
  const stackId = useMemo(() => {
    const params = resultParams(search);
    if (!params) return null;
    const found =
      searches[matchingSearchIds(searches, params, resultTarget(search))[0]];
    if (!found) return null;
    const id = stackIdOf(found);
    return savedInStack(searches, savedSearchIds, id).length > 1 ? id : null;
  }, [search, searches, savedSearchIds]);
  return backLink(state, stackId);
};
