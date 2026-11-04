import React, { useMemo } from "react";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { track } from "@/lib/analytics";
import {
  countedContributors,
  requiredFilters,
  requireContributor,
  unrequire,
} from "@/lib/filters";
import { ScoredRelease } from "@/lib/results";
import { searchSwimlanes } from "@/lib/swimlanes";
import { Swimlanes } from "./Swimlanes";

/**
 * One search's People view: its counted people across their careers.
 * Changes with the filters, like the list.
 */
export const SearchPeople: React.FC<{
  searchId: string;
  /** A picked result: show it in the list. */
  onResult: (key: string) => void;
}> = ({ searchId, onResult }) => {
  const { searches, updateFilterState } = useCache();
  const search = searches[searchId];
  const { releases } = useFilteredAndScoredReleases(searchId);
  const lanes = useMemo(
    () =>
      search
        ? searchSwimlanes(
            search,
            countedContributors(search),
            releases as ScoredRelease[],
          )
        : null,
    [search, releases],
  );
  if (!search || !lanes) return null;
  const required = new Set(requiredFilters(search.filterState).contributors);

  return (
    <Swimlanes
      lanes={lanes}
      describe={(key) => search.releases[key]}
      required={(id) => required.has(id)}
      onName={(lane) => {
        const on = !required.has(lane.id);
        track("filter_changed", {
          filter: "must_include_contributor",
          on,
          source: "swimlanes",
        });
        updateFilterState(
          searchId,
          on
            ? requireContributor(search, lane.id)
            : unrequire(search, { contributor: lane.id }),
        );
      }}
      onResult={(key) => {
        track("swimlane_tick_opened", { scope: "search" });
        onResult(key);
      }}
    />
  );
};
