import { RequiredFilters, SearchCache } from "@/contexts/cache/types";
import { resetFilterState } from "./results";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";
import {
  groupRoles,
  ROLE_CATEGORIES,
  roleCategory,
  RoleCategory,
} from "./transformers/roleCategories";
import { defaultRolePipeline } from "./transformers/roleProcessor";

type FilterState = SearchCache["filterState"];

export interface ContributorChip {
  id: number;
  name: string;
  roles: string[];
  /** Albums in this search the contributor worked on. */
  count: number;
  /** Not switched off by the user. */
  included: boolean;
  /** At least one of their roles is on (or they're required), so they count. */
  available: boolean;
  /** On "must include": locked on, changed only from that list. */
  required: boolean;
}

export interface RoleChip {
  role: string;
  included: boolean;
  /** At least one included contributor has this role. */
  available: boolean;
  /** On "must include": locked on, changed only from that list. */
  required: boolean;
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
  const required = requiredFilters(filterState);
  return Object.values(search.contributors)
    .map((c) => ({
      id: c.id,
      name: defaultContributorDisplayPipeline(c.name),
      roles: defaultRolePipeline(c.roles),
      count: counts.get(c.id) ?? 0,
      included: filterState.contributors[c.id] ?? true,
      available:
        required.contributors.includes(c.id) ||
        c.roles.some((role) => filterState.roles[role]),
      required: required.contributors.includes(c.id),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** Role chips, in alphabetical order. */
export const roleChips = (search: SearchCache): RoleChip[] => {
  const { filterState } = search;
  const required = requiredFilters(filterState);
  return Object.keys(search.roles)
    .sort((a, b) => a.localeCompare(b))
    .map((role) => ({
      role,
      included: filterState.roles[role] ?? true,
      available: Object.values(search.contributors).some(
        (c) => c.roles.includes(role) && filterState.contributors[c.id],
      ),
      required: required.roles.includes(role),
    }));
};

export interface RoleGroup {
  id: RoleCategory;
  label: string;
  roles: RoleChip[];
}

/** Role chips grouped by category (musicians, writing, audio...). */
export const roleGroups = (search: SearchCache): RoleGroup[] =>
  groupRoles(roleChips(search), (r) => r.role).map(({ items, ...group }) => ({
    ...group,
    roles: items,
  }));

/** The "must include" lists, empty for searches saved before they existed. */
export const requiredFilters = (filterState: FilterState): RequiredFilters =>
  filterState.required ?? { contributors: [], roles: [] };

/**
 * Whether a contributor counts towards results: switched on, and either
 * required or with at least one role on. A required person counts whatever
 * their roles, since it's the person that was asked for.
 */
export const isContributorCounted = (
  search: SearchCache,
  id: number,
): boolean => {
  const { filterState } = search;
  if (!filterState.contributors[id]) return false;
  if (requiredFilters(filterState).contributors.includes(id)) return true;
  return (
    search.contributors[id]?.roles.some((role) => filterState.roles[role]) ??
    false
  );
};

/**
 * Whether a release with these counted contributors has everyone and every
 * role marked "must include". A role counts when one of them had it on the
 * searched album.
 */
export const meetsRequired = (
  activeContributorIds: number[],
  search: SearchCache,
): boolean => {
  const { contributors, roles } = requiredFilters(search.filterState);
  return (
    contributors.every((id) => activeContributorIds.includes(id)) &&
    roles.every((role) =>
      activeContributorIds.some((id) =>
        search.contributors[id]?.roles.includes(role),
      ),
    )
  );
};

/** Filter updates that mark a contributor "must include". */
export const requireContributor = (
  search: SearchCache,
  id: number,
): Partial<FilterState> => {
  const required = requiredFilters(search.filterState);
  return {
    required: {
      ...required,
      contributors: required.contributors.includes(id)
        ? required.contributors
        : [...required.contributors, id],
    },
  };
};

/** Filter updates that mark a role "must include". */
export const requireRole = (
  search: SearchCache,
  role: string,
): Partial<FilterState> => {
  const required = requiredFilters(search.filterState);
  return {
    required: {
      ...required,
      roles: required.roles.includes(role)
        ? required.roles
        : [...required.roles, role],
    },
  };
};

/**
 * Filter updates that take a contributor or role off "must include". It
 * stays switched on, so results don't jump.
 */
export const unrequire = (
  search: SearchCache,
  item: { contributor: number } | { role: string },
): Partial<FilterState> => {
  const required = requiredFilters(search.filterState);
  return {
    required:
      "contributor" in item
        ? {
            ...required,
            contributors: required.contributors.filter(
              (id) => id !== item.contributor,
            ),
          }
        : { ...required, roles: required.roles.filter((r) => r !== item.role) },
  };
};

/**
 * "Must include" wins over every other filter change: required contributors
 * and roles stay switched on, and a required role keeps someone with it on.
 * If an update (say "Deselect all" contributors) would leave a required role
 * with nobody, everyone with that role is switched back on. Applied after
 * every filter update. Returns the same object when nothing changes.
 */
export const enforceRequired = (
  search: Pick<SearchCache, "contributors">,
  filterState: FilterState,
): FilterState => {
  const required = requiredFilters(filterState);
  const contributors = { ...filterState.contributors };
  const roles = { ...filterState.roles };
  let changed = false;
  const switchOn = (
    states: Record<string | number, boolean>,
    key: string | number,
  ) => {
    if (!states[key]) {
      states[key] = true;
      changed = true;
    }
  };
  required.contributors.forEach((id) => switchOn(contributors, id));
  for (const role of required.roles) {
    switchOn(roles, role);
    const holders = Object.values(search.contributors)
      .filter((c) => c.roles.includes(role))
      .map((c) => c.id);
    if (!holders.some((id) => contributors[id])) {
      holders.forEach((id) => switchOn(contributors, id));
    }
  }
  return changed ? { ...filterState, contributors, roles } : filterState;
};

export type MustIncludeItem =
  | { kind: "contributor"; id: number; label: string; detail: string }
  | { kind: "role"; role: string; label: string; detail: string };

const categoryLabel = (role: string) =>
  ROLE_CATEGORIES.find((c) => c.id === roleCategory(role))?.label ?? "";

/** The "must include" entries, contributors first, in the order added. */
export const requiredChips = (search: SearchCache): MustIncludeItem[] => {
  const required = requiredFilters(search.filterState);
  const people: MustIncludeItem[] = required.contributors.flatMap((id) => {
    const c = search.contributors[id];
    if (!c) return [];
    return [
      {
        kind: "contributor" as const,
        id,
        label: defaultContributorDisplayPipeline(c.name),
        detail: defaultRolePipeline(c.roles).join(", "),
      },
    ];
  });
  const roles: MustIncludeItem[] = required.roles.map((role) => ({
    kind: "role" as const,
    role,
    label: role,
    detail: categoryLabel(role),
  }));
  return [...people, ...roles];
};

/**
 * Contributors and roles matching a query that aren't required yet, for the
 * "must include" picker. Contributors first, most albums first; then roles.
 */
export const mustIncludeOptions = (
  search: SearchCache,
  query: string,
  limit = 8,
): MustIncludeItem[] => {
  if (query.trim() === "") return [];
  const required = requiredFilters(search.filterState);
  const people: MustIncludeItem[] = contributorChips(search)
    .filter(
      (c) =>
        !required.contributors.includes(c.id) && matchesName(c.name, query),
    )
    .map((c) => ({
      kind: "contributor",
      id: c.id,
      label: c.name,
      detail: c.roles.join(", "),
    }));
  const roles: MustIncludeItem[] = Object.keys(search.roles)
    .filter(
      (role) => !required.roles.includes(role) && matchesName(role, query),
    )
    .sort((a, b) => a.localeCompare(b))
    .map((role) => ({
      kind: "role",
      role,
      label: role,
      detail: categoryLabel(role),
    }));
  return [...people, ...roles].slice(0, limit);
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
 * off or required, plus each of the three switches changed. Shown on the
 * mobile Filters bar.
 */
export const activeFilterCount = (search: SearchCache): number => {
  const base = resetFilterState(search);
  const { filterState } = search;
  const off = (states: Record<string | number, boolean>) =>
    Object.values(states).filter((on) => !on).length;
  const required = requiredFilters(filterState);
  return (
    off(filterState.contributors) +
    off(filterState.roles) +
    required.contributors.length +
    required.roles.length +
    Number(filterState.excludeMainArtist !== base.excludeMainArtist) +
    Number(filterState.collaborationsOnly !== base.collaborationsOnly) +
    Number(filterState.excludeVarious !== base.excludeVarious)
  );
};

/** `states` with each of `keys` switched on or off. */
export const setIncluded = <K extends string | number>(
  states: Record<K, boolean>,
  keys: K[],
  on: boolean,
): Record<K, boolean> => {
  const next = { ...states };
  for (const key of keys) next[key] = on;
  return next;
};
