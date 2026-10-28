import { Contributor } from "@/api/types";
import {
  ROLE_CATEGORIES,
  RoleCategory,
  roleCategory,
} from "./transformers/roleCategories";

/**
 * What links two albums, said by role rather than by name: "Musicians (2)
 * · Audio (1)". A name alone says nothing about why the link matters (a
 * mastering engineer and a drummer read the same); the category does.
 * Categories come in the Roles filter's order. When every link is in one
 * category, or a category is Other, the roles themselves say more, so
 * they're named instead ("Lacquer Cut By").
 */

const MAX_ROLES = 3;

export interface LinkGroup {
  category: RoleCategory;
  label: string;
  /** How many of the linking people have a role in it. */
  people: number;
  /** Their roles in it, in first-seen order. */
  roles: string[];
}

/** The linking people's roles, grouped by category, in filter order. */
export const linkGroups = (
  people: Array<Pick<Contributor, "id" | "roles">>,
): LinkGroup[] => {
  const byCategory = new Map<
    RoleCategory,
    { people: Set<number>; roles: string[] }
  >();
  for (const person of people) {
    for (const role of person.roles) {
      const category = roleCategory(role);
      const group = byCategory.get(category) ?? {
        people: new Set<number>(),
        roles: [],
      };
      group.people.add(person.id);
      if (!group.roles.includes(role)) group.roles.push(role);
      byCategory.set(category, group);
    }
  }
  return ROLE_CATEGORIES.flatMap(({ id, label }) => {
    const group = byCategory.get(id);
    return group
      ? [{ category: id, label, people: group.people.size, roles: group.roles }]
      : [];
  });
};

const roleList = (roles: string[]) =>
  roles.length > MAX_ROLES
    ? `${roles.slice(0, MAX_ROLES).join(", ")} +${roles.length - MAX_ROLES}`
    : roles.join(", ");

/**
 * The summary line: "via Musicians (2) · Audio (1)", "via Lacquer Cut By"
 * (one category: its roles), Other always by its roles. With no roles
 * known, how many people.
 */
export const linkSummary = (
  people: Array<Pick<Contributor, "id" | "roles">>,
): string => {
  const groups = linkGroups(people);
  if (groups.length === 0) {
    return people.length === 1
      ? "via 1 contributor"
      : `via ${people.length} contributors`;
  }
  if (groups.length === 1) return `via ${roleList(groups[0].roles)}`;
  return `via ${groups
    .map((g) =>
      g.category === "other" ? roleList(g.roles) : `${g.label} (${g.people})`,
    )
    .join(" · ")}`;
};
