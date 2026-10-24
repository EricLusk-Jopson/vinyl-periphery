import React, { useId, useMemo, useState } from "react";
import { useCache, useSearchFilters } from "@/contexts/cache/CacheContext";
import {
  contributorChips,
  matchesName,
  roleChips,
  setIncluded,
} from "@/lib/filters";
import { resetFilterState } from "@/lib/results";
import { cn } from "@/lib/utils";
import { Chip } from "./Chip";
import { FilterGroup } from "./FilterGroup";
import { Switch } from "./Switch";

interface FilterPanelProps {
  searchId: string;
  /**
   * The sidebar has its own "Filters" heading and Reset link; in the sheet
   * those live in the sheet's header and footer.
   */
  variant: "sidebar" | "sheet";
}

/** Switches, contributor chips with a name filter, and role chips. */
export const FilterPanel: React.FC<FilterPanelProps> = ({
  searchId,
  variant,
}) => {
  const { searches, updateFilterState } = useCache();
  const {
    toggleContributor,
    toggleRole,
    toggleExcludeMainArtist,
    toggleCollaborationsOnly,
    toggleExcludeVarious,
  } = useSearchFilters(searchId);
  const search = searches[searchId];
  const [query, setQuery] = useState("");
  const id = useId();

  const contributors = useMemo(
    () => (search ? contributorChips(search) : []),
    [search],
  );
  const roles = useMemo(() => (search ? roleChips(search) : []), [search]);

  if (!search) return null;
  const { filterState } = search;
  const shown = contributors.filter((c) => matchesName(c.name, query));
  const filtering = query.trim() !== "";

  // Select or deselect the contributors in view (all of them unless a name
  // filter narrows the list) or every role.
  const setContributors = (on: boolean) =>
    updateFilterState(searchId, {
      contributors: setIncluded(
        filterState.contributors,
        shown.map((c) => c.id),
        on,
      ),
    });
  const setRoles = (on: boolean) =>
    updateFilterState(searchId, {
      roles: setIncluded(
        filterState.roles,
        roles.map((r) => r.role),
        on,
      ),
    });

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      {variant === "sidebar" && (
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Filters</h2>
          <button
            type="button"
            onClick={() =>
              updateFilterState(searchId, resetFilterState(search))
            }
            className="h-8 text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Reset
          </button>
        </div>
      )}

      <div className="flex flex-col lg:gap-1">
        <Switch
          label={`Hide ${search.searchParams.artist} releases`}
          checked={filterState.excludeMainArtist}
          onChange={toggleExcludeMainArtist}
        />
        <Switch
          label="Only albums with 2+ shared"
          checked={filterState.collaborationsOnly}
          onChange={toggleCollaborationsOnly}
        />
        <Switch
          label="Hide Various Artists"
          checked={filterState.excludeVarious}
          onChange={toggleExcludeVarious}
        />
      </div>

      <FilterGroup
        title="Contributors"
        on={contributors.filter((c) => c.included).length}
        total={contributors.length}
        scope={filtering ? "matches" : "all"}
        canSelect={shown.some((c) => !c.included)}
        canDeselect={shown.some((c) => c.included)}
        onSelect={() => setContributors(true)}
        onDeselect={() => setContributors(false)}
      >
        <label htmlFor={`${id}-filter`} className="sr-only">
          Filter contributors
        </label>
        <input
          id={`${id}-filter`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter names"
          autoComplete="off"
          className={cn(
            "h-11 rounded-lg border px-3 text-[15px] text-foreground placeholder:text-faint lg:h-9 lg:text-sm",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            variant === "sheet" ? "bg-background" : "bg-surface",
          )}
        />
        {shown.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {shown.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                count={c.count}
                description={c.roles.join(", ")}
                included={c.included}
                available={c.available}
                unavailableNote="all their roles are switched off"
                onToggle={() => toggleContributor(c.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-faint">No names match "{query.trim()}".</p>
        )}
      </FilterGroup>

      <FilterGroup
        title="Roles"
        on={roles.filter((r) => r.included).length}
        total={roles.length}
        canSelect={roles.some((r) => !r.included)}
        canDeselect={roles.some((r) => r.included)}
        onSelect={() => setRoles(true)}
        onDeselect={() => setRoles(false)}
      >
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <Chip
              key={r.role}
              label={r.role}
              included={r.included}
              available={r.available}
              unavailableNote="everyone with this role is switched off"
              onToggle={() => toggleRole(r.role)}
            />
          ))}
        </div>
      </FilterGroup>
    </div>
  );
};
