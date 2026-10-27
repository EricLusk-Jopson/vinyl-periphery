import React, { useId, useMemo, useState } from "react";
import { useCache, useSearchFilters } from "@/contexts/cache/CacheContext";
import {
  contributorChips,
  matchesName,
  roleChips,
  roleGroups,
  setIncluded,
} from "@/lib/filters";
import { resetFilterState } from "@/lib/results";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Chip } from "./Chip";
import { FilterGroup } from "./FilterGroup";
import { MustInclude } from "./MustInclude";
import { Switch } from "./Switch";

interface FilterPanelProps {
  searchId: string;
  /**
   * The sidebar has its own "Filters" heading and Reset link; in the frame
   * those live in the frame's top bar.
   */
  variant: "sidebar" | "frame";
}

/**
 * Switches, "must include", contributor chips with a name filter, and role
 * chips grouped by category.
 */
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
  const groups = useMemo(() => (search ? roleGroups(search) : []), [search]);

  if (!search) return null;
  const { filterState } = search;
  const changed = (filter: string, on: boolean) =>
    track("filter_changed", { filter, on });
  const shown = contributors.filter((c) => matchesName(c.name, query));
  const filtering = query.trim() !== "";
  // Required chips are locked: the select and deselect buttons leave them be.
  const shownUnlocked = shown.filter((c) => !c.required);
  const rolesUnlocked = roles.filter((r) => !r.required);

  // Select or deselect the contributors in view (all of them unless a name
  // filter narrows the list) or every role, except required ones.
  const setContributors = (on: boolean) =>
    updateFilterState(searchId, {
      contributors: setIncluded(
        filterState.contributors,
        shownUnlocked.map((c) => c.id),
        on,
      ),
    });
  const setRoles = (on: boolean, names = rolesUnlocked.map((r) => r.role)) =>
    updateFilterState(searchId, {
      roles: setIncluded(filterState.roles, names, on),
    });

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      {variant === "sidebar" && (
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Filters</h2>
          <button
            type="button"
            onClick={() => {
              changed("reset", true);
              updateFilterState(searchId, resetFilterState(search));
            }}
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
          onChange={() => {
            changed("hide_main_artist", !filterState.excludeMainArtist);
            toggleExcludeMainArtist();
          }}
        />
        <Switch
          label="Only albums with 2+ shared"
          checked={filterState.collaborationsOnly}
          onChange={() => {
            changed("two_plus_shared", !filterState.collaborationsOnly);
            toggleCollaborationsOnly();
          }}
        />
        <Switch
          label="Hide Various Artists"
          checked={filterState.excludeVarious}
          onChange={() => {
            changed("hide_various", !filterState.excludeVarious);
            toggleExcludeVarious();
          }}
        />
      </div>

      <MustInclude searchId={searchId} />

      <FilterGroup
        title="Contributors"
        on={contributors.filter((c) => c.included).length}
        total={contributors.length}
        scope={filtering ? "matches" : "all"}
        canSelect={shownUnlocked.some((c) => !c.included)}
        canDeselect={shownUnlocked.some((c) => c.included)}
        onSelect={() => {
          changed("all_contributors", true);
          setContributors(true);
        }}
        onDeselect={() => {
          changed("all_contributors", false);
          setContributors(false);
        }}
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
            "bg-surface",
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
                required={c.required}
                unavailableNote="all their roles are switched off"
                onToggle={() => {
                  changed("contributor", !c.included);
                  toggleContributor(c.id);
                }}
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
        canSelect={rolesUnlocked.some((r) => !r.included)}
        canDeselect={rolesUnlocked.some((r) => r.included)}
        onSelect={() => {
          changed("all_roles", true);
          setRoles(true);
        }}
        onDeselect={() => {
          changed("all_roles", false);
          setRoles(false);
        }}
      >
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const on = group.roles.filter((r) => r.included).length;
            const unlocked = group.roles.filter((r) => !r.required);
            // Deselect while any unlocked role is on; Select once none are.
            const next = !unlocked.some((r) => r.included);
            return (
              <div key={group.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-[1px] text-faint">
                    {group.label}
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {on}/{group.roles.length}
                  </span>
                  {unlocked.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        track("filter_changed", {
                          filter: "role_category",
                          on: next,
                          category: group.id,
                        });
                        setRoles(
                          next,
                          unlocked.map((r) => r.role),
                        );
                      }}
                      aria-label={`${next ? "Select" : "Deselect"} all ${group.label} roles`}
                      className="ml-auto h-11 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring lg:h-8"
                    >
                      {next ? "Select" : "Deselect"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.roles.map((r) => (
                    <Chip
                      key={r.role}
                      label={r.role}
                      included={r.included}
                      available={r.available}
                      required={r.required}
                      unavailableNote="everyone with this role is switched off"
                      onToggle={() => {
                        changed("role", !r.included);
                        toggleRole(r.role);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </FilterGroup>
    </div>
  );
};
