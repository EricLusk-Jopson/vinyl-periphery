import { Contributor } from "@/api/types";
import { RoleCategory, roleCategory } from "./transformers/roleCategories";

/**
 * Role groups: five coarse kinds of credit, coarser than Discogs's
 * headings (`roleCategories.ts`, which the Roles filter uses) and built on
 * them, so there is one role mapping, not two. Used to sort and colour the
 * visuals (swimlanes, transit map, later the barcode).
 *
 * "Band" isn't read from role strings: it's the album's main artist and
 * its members, as the pipeline records them (`Contributor.sources`).
 */

export type RoleGroup =
  | "band"
  | "session"
  | "production"
  | "engineering"
  | "art"
  | "other";

/** Display order, left to right / top to bottom, on every visual. */
export const ROLE_GROUPS: { id: RoleGroup; label: string }[] = [
  { id: "band", label: "Band" },
  { id: "session", label: "Session and guests" },
  { id: "production", label: "Production" },
  { id: "engineering", label: "Engineering and mastering" },
  { id: "art", label: "Art and design" },
  { id: "other", label: "Other" },
];

/** Discogs heading -> group. */
const BY_CATEGORY: Record<RoleCategory, RoleGroup> = {
  vocals: "session",
  instruments: "session",
  featuring: "session",
  conducting: "session",
  writing: "session",
  production: "production",
  remix: "production",
  djmix: "production",
  technical: "engineering",
  visual: "art",
  spoken: "other",
  management: "other",
  other: "other",
};

/**
 * Each role in a credit: brackets dropped ("Drums [Uncredited]"), lists
 * split ("Percussion, Drums"), blanks left out.
 */
export const splitRoles = (credit: string): string[] =>
  credit
    .replace(/\[[^\]]*\]/g, " ")
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** The group one role belongs to. */
export const roleGroup = (role: string): RoleGroup =>
  BY_CATEGORY[roleCategory(role)];

/** Every group a credit string falls in ("Bass, Producer"), in order. */
export const creditGroups = (credit: string): RoleGroup[] => {
  const groups = new Set(splitRoles(credit).map(roleGroup));
  return ROLE_GROUPS.map((g) => g.id).filter((id) => groups.has(id));
};

/**
 * Which group wins when a person has several on one album: band, then
 * production, engineering, session, art, other.
 */
const PRIORITY: RoleGroup[] = [
  "band",
  "production",
  "engineering",
  "session",
  "art",
  "other",
];

/** A person's primary group on an album: the highest-priority one. */
export const primaryGroup = (
  contributor: Pick<Contributor, "roles" | "sources">,
): RoleGroup => {
  if (contributor.sources.some((s) => s === "artist" || s === "member")) {
    return "band";
  }
  const groups = new Set(contributor.roles.flatMap(creditGroups));
  return PRIORITY.find((g) => groups.has(g)) ?? "other";
};

/** Where a group sits in `ROLE_GROUPS`, for sorting. */
export const groupOrder = (group: RoleGroup): number =>
  ROLE_GROUPS.findIndex((g) => g.id === group);

/**
 * For the mapping audit: the share of roles (after splitting) that land
 * in "other". Over ~20% on real searches means the mapping needs work.
 */
export const otherShare = (credits: string[]): number => {
  const roles = credits.flatMap(splitRoles);
  if (roles.length === 0) return 0;
  return roles.filter((r) => roleGroup(r) === "other").length / roles.length;
};
