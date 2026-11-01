/**
 * Buckets for Discogs credit roles: the headings of Discogs's own credits
 * list (https://www.discogs.com/help/creditslist), so whole groups can be
 * switched off at once and links can be described by kind. Every role on
 * that list is matched by name (`discogsRoles.ts`); credits written some
 * other way fall back to their last words ("Guitar Technician" is a
 * Technician), their singular or plural, then a few common words. Roles
 * nothing matches fall into "other", and those are reported with
 * `search_completed` (`roles_uncategorized`) so the list can grow.
 */

import { DISCOGS_ROLES } from "./discogsRoles";

export type RoleCategory = keyof typeof DISCOGS_ROLES;

/** Display order: performers first, then making the record, then the rest. */
export const ROLE_CATEGORIES: {
  id: RoleCategory;
  /** Discogs's heading. */
  label: string;
  /** For one-line summaries ("via Writing (2) · Technical (1)"). */
  short: string;
}[] = [
  { id: "vocals", label: "Vocals", short: "Vocals" },
  { id: "instruments", label: "Instruments", short: "Instruments" },
  { id: "featuring", label: "Featuring & Presenting", short: "Featuring" },
  { id: "conducting", label: "Conducting & Leading", short: "Conducting" },
  { id: "writing", label: "Writing & Arrangement", short: "Writing" },
  { id: "production", label: "Production", short: "Production" },
  { id: "remix", label: "Remix", short: "Remix" },
  { id: "djmix", label: "DJ Mix", short: "DJ Mix" },
  { id: "technical", label: "Technical", short: "Technical" },
  { id: "visual", label: "Visual", short: "Visual" },
  { id: "spoken", label: "Acting, Literary & Spoken", short: "Spoken" },
  { id: "management", label: "Management", short: "Management" },
  { id: "other", label: "Other", short: "Other" },
];

/** A name as a lookup key: no case, accents, spaces or punctuation. */
const keyOf = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&]+/gu, "");

const withoutParentheses = (name: string) =>
  name.replace(/\([^)]*\)/g, " ").trim();

/** Discogs's names -> heading; a name's parenthesised part is optional. */
const BY_KEY: Map<string, RoleCategory> = (() => {
  const map = new Map<string, RoleCategory>();
  const entries = Object.entries(DISCOGS_ROLES) as [
    RoleCategory,
    readonly string[],
  ][];
  for (const [category, names] of entries) {
    for (const name of names) map.set(keyOf(name), category);
  }
  // "Tar (Drum)" also answers to "Tar", unless another role has that name
  // ("Adapted By (Text)" leaves "Adapted By" to Writing).
  for (const [category, names] of entries) {
    for (const name of names) {
      const bare = keyOf(withoutParentheses(name));
      if (bare && !map.has(bare)) map.set(bare, category);
    }
  }
  return map;
})();

/** Common words in credits Discogs's list doesn't name exactly. */
const WORDS: [RoleCategory, RegExp][] = [
  ["vocals", /\b(vocal|vocals|voices|singer|singing|sung)\b/i],
  ["conducting", /\b(conduct\w*)\b/i],
  ["writing", /\b(arrang\w*|compos\w*|lyric\w*|writ\w*|programm\w*)\b/i],
  ["production", /\b(produc\w*)\b/i],
  ["technical", /\b(mix\w*|master\w*|record\w*|engineer\w*|edit\w*|cut)\b/i],
  [
    "visual",
    /\b(photo\w*|design\w*|art|artwork|illustrat\w*|layout|graphic\w*)\b/i,
  ],
  ["spoken", /\b(notes|liner)\b/i],
  ["management", /\b(manag\w*|a&r|booking|promot\w*)\b/i],
  [
    "instruments",
    /\b(sax\w*|keys|guitar\w*|bass|drum\w*|percussion|piano|organ|synth\w*|strings?|horns?|trumpet\w*|trombone\w*|violin\w*|cello\w*|flute\w*|clarinet\w*|harmonica|banjo|mandolin)\b/i,
  ],
];

/** One credit's heading, or null when nothing matches it. */
const lookUp = (role: string): RoleCategory | null => {
  // Exactly as Discogs names it, parentheses and all: "Adapted By (Text)".
  const exact = BY_KEY.get(keyOf(role));
  if (exact) return exact;
  const words = withoutParentheses(role).split(/\s+/).filter(Boolean);
  // The whole name, then its endings: "Strings Arranged By" -> "Arranged By".
  for (let i = 0; i < words.length; i++) {
    const tail = words.slice(i).join(" ");
    for (const key of [
      keyOf(tail),
      keyOf(tail).replace(/s$/, ""),
      `${keyOf(tail)}s`,
    ]) {
      const found = key && BY_KEY.get(key);
      if (found) return found;
    }
  }
  return WORDS.find(([, pattern]) => pattern.test(role))?.[0] ?? null;
};

/**
 * The heading a role belongs to. Takes a role as Discogs sends it or after
 * `defaultRolePipeline`: bracketed notes are ignored, and of a
 * comma-separated list the first role that matches decides.
 */
export const roleCategory = (role: string): RoleCategory => {
  const parts = role
    .replace(/\[[^\]]*\]/g, " ")
    .split(",")
    .map((p) => p.replace(/[-–—]/g, " ").trim())
    .filter(Boolean);
  for (const part of parts) {
    const found = lookUp(part);
    if (found) return found;
  }
  return "other";
};

/** Roles grouped by bucket, in display order, empty buckets left out. */
export const groupRoles = <T>(
  items: T[],
  roleOf: (item: T) => string,
): { id: RoleCategory; label: string; items: T[] }[] =>
  ROLE_CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((item) => roleCategory(roleOf(item)) === c.id),
  })).filter((group) => group.items.length > 0);

/** Roles no pattern matches, sorted, for `roles_uncategorized`. */
export const uncategorizedRoles = (roles: Iterable<string>): string[] =>
  Array.from(new Set(roles))
    .filter((role) => roleCategory(role) === "other")
    .sort((a, b) => a.localeCompare(b));
