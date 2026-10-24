import { SearchCache } from "@/contexts/cache/types";
import { resetFilterState } from "./results";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";
import { defaultRolePipeline } from "./transformers/roleProcessor";

export interface ContributorChip {
  id: number;
  name: string;
  roles: string[];
  /** Albums in this search the contributor worked on. */
  count: number;
  /** Not switched off by the user. */
  included: boolean;
  /** At least one of their roles is on, so they can count. */
  available: boolean;
}

export interface RoleChip {
  role: string;
  included: boolean;
  /** At least one included contributor has this role. */
  available: boolean;
}

/** Contributor chips, most albums first, then by name. */
export const contributorChips = (search: SearchCache): ContributorChip[] => {
  const counts = new Map<number, number>();
  for (const release of Object.values(search.releases)) {
    for (const id of new Set(release.contributorIds)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const { filterState } = search;
  return Object.values(search.contributors)
    .map((c) => ({
      id: c.id,
      name: defaultContributorDisplayPipeline(c.name),
      roles: defaultRolePipeline(c.roles),
      count: counts.get(c.id) ?? 0,
      included: filterState.contributors[c.id] ?? true,
      available: c.roles.some((role) => filterState.roles[role]),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** Role chips, in alphabetical order. */
export const roleChips = (search: SearchCache): RoleChip[] => {
  const { filterState } = search;
  return Object.keys(search.roles)
    .sort((a, b) => a.localeCompare(b))
    .map((role) => ({
      role,
      included: filterState.roles[role] ?? true,
      available: Object.values(search.contributors).some(
        (c) => c.roles.includes(role) && filterState.contributors[c.id],
      ),
    }));
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Case- and accent-insensitive "contains", for the name filter. */
export const matchesName = (name: string, query: string): boolean =>
  fold(name).includes(fold(query.trim()));

/**
 * How many filters differ from "Reset": each contributor or role switched
 * off, plus each of the three switches changed. Shown on the mobile
 * Filters bar.
 */
export const activeFilterCount = (search: SearchCache): number => {
  const base = resetFilterState(search);
  const { filterState } = search;
  const off = (states: Record<string | number, boolean>) =>
    Object.values(states).filter((on) => !on).length;
  return (
    off(filterState.contributors) +
    off(filterState.roles) +
    Number(filterState.excludeMainArtist !== base.excludeMainArtist) +
    Number(filterState.collaborationsOnly !== base.collaborationsOnly) +
    Number(filterState.excludeVarious !== base.excludeVarious)
  );
};
