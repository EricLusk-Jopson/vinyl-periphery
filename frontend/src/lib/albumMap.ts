import { Contributor } from "@/api/types";
import { Likes } from "@/services/likes";
import { popularity, ScoredRelease } from "./results";
import { MAP_SIZES, relax } from "./shareMap";
import {
  ROLE_CATEGORIES,
  roleCategory,
  RoleCategory,
} from "./transformers/roleCategories";
import { defaultRolePipeline } from "./transformers/roleProcessor";

/**
 * The share map for one search: its album in the middle, the top results
 * (as filtered and sorted on the page) around it.
 *
 * - People sit on the unit circle grouped by role category (musicians
 *   together, then writing, audio and the rest), evenly spaced with a gap
 *   between groups. The grouping only decides where they go; nothing in
 *   the image marks the groups.
 * - An album goes in the direction of the centre of mass of its people,
 *   at a distance set by how many people it shares: the most-shared sits
 *   closest to the middle, two people just inside the circle, and one
 *   person just outside it.
 * - Its size grows with popularity (Discogs want + have, on a log scale
 *   across the albums shown), and a liked album is bigger still.
 *
 * Pure, so it can be tested and its output sent to the renderer as plain
 * positions.
 */

export const ALBUM_MAP_RESULTS = 12;
export const ALBUM_MAP_PEOPLE = 16;

/** Cover sides, as fractions of the radius. */
export const ALBUM_SIZES = { smallest: 0.2, popular: 0.1, liked: 0.06 };
/** Room between covers, as a fraction of the radius (as in shareMap). */
const GAP = 0.03;

export interface MapPersonSpot {
  id: number;
  category: RoleCategory;
  /** Radians, counter-clockwise from the right. */
  angle: number;
  /** How many of the albums shown they link. */
  albums: number;
}

export interface AlbumSpot {
  key: string;
  title: string;
  artist: string;
  people: number[];
  liked: boolean;
  /** Centre of its cover, in the unit circle (y up). */
  x: number;
  y: number;
  /** Cover side, as a fraction of the radius. */
  side: number;
}

/** A person's category: the first, in filter order, among their roles. */
export const personCategory = (roles: string[]): RoleCategory => {
  const categories = new Set(defaultRolePipeline(roles).map(roleCategory));
  return (
    ROLE_CATEGORIES.find((c) => categories.has(c.id))?.id ??
    ("other" as RoleCategory)
  );
};

/**
 * Everyone linking the albums, around the circle by category, starting at
 * the top and going clockwise. Within a category, whoever links the most
 * albums comes first. One empty slot separates categories.
 */
export const placePeople = (
  albums: Array<{ people: number[] }>,
  contributors: Record<number, Pick<Contributor, "id" | "roles">>,
): MapPersonSpot[] => {
  const counts = new Map<number, number>();
  albums.forEach((album) =>
    new Set(album.people).forEach((id) =>
      counts.set(id, (counts.get(id) ?? 0) + 1),
    ),
  );
  const order = (category: RoleCategory) =>
    ROLE_CATEGORIES.findIndex((c) => c.id === category);
  const people = Array.from(counts, ([id, count]) => ({
    id,
    category: personCategory(contributors[id]?.roles ?? []),
    albums: count,
  })).sort(
    (a, b) =>
      order(a.category) - order(b.category) ||
      b.albums - a.albums ||
      a.id - b.id,
  );
  const groups = new Set(people.map((p) => p.category)).size;
  const slots = people.length + (groups > 1 ? groups : 0);
  let slot = 0;
  return people.map((person, i) => {
    if (i > 0 && people[i - 1].category !== person.category) slot++;
    const angle = Math.PI / 2 - (2 * Math.PI * slot) / Math.max(1, slots);
    slot++;
    return { ...person, angle };
  });
};

/** Popularity on a 0-1 log scale across `albums`; 0 without counts. */
const popularityScale = (albums: ScoredRelease[]) => {
  const logs = albums.map((a) => {
    const p = popularity(a);
    return p === null ? null : Math.log10(1 + p);
  });
  const known = logs.filter((l): l is number => l !== null);
  const low = Math.min(...known);
  const high = Math.max(...known);
  return (i: number) => {
    const l = logs[i];
    if (l === null || known.length === 0) return 0;
    return high > low ? (l - low) / (high - low) : 1;
  };
};

/** The albums' places and sizes, and the people's places. */
export const layoutAlbumMap = (
  albums: ScoredRelease[],
  contributors: Record<number, Pick<Contributor, "id" | "roles">>,
  likes: Likes,
): { albums: AlbumSpot[]; people: MapPersonSpot[] } => {
  const withPeople = albums.map((album) => ({
    album,
    people: Array.from(new Set(album.activeContributors)),
  }));
  const people = placePeople(withPeople, contributors);
  const angleOf = new Map(people.map((p) => [p.id, p.angle]));
  const most = Math.max(1, ...withPeople.map((a) => a.people.length));
  const scale = popularityScale(albums);
  const centreSide = MAP_SIZES.centre;

  const ideal = withPeople.map(({ album, people: ids }, i) => {
    const liked = Boolean(likes[album.key]);
    const side =
      ALBUM_SIZES.smallest +
      ALBUM_SIZES.popular * scale(i) +
      (liked ? ALBUM_SIZES.liked : 0);
    // Direction: the centre of mass of its people (the first person's
    // when they cancel out).
    let x = 0;
    let y = 0;
    ids.forEach((id) => {
      x += Math.cos(angleOf.get(id) ?? 0);
      y += Math.sin(angleOf.get(id) ?? 0);
    });
    const direction =
      Math.hypot(x, y) > 1e-6 ? Math.atan2(y, x) : (angleOf.get(ids[0]) ?? 0);
    // Distance: fewer people, farther out.
    const n = ids.length;
    const outer = n <= 1;
    // Covers are squares: clear of the centre one along the axis that
    // dominates the direction, so farther out on a diagonal.
    const closest =
      (centreSide / 2 + GAP + side / 2) /
      Math.max(Math.abs(Math.cos(direction)), Math.abs(Math.sin(direction)));
    const inside = 1 - side / 2;
    const t = most > 2 ? (most - n) / (most - 2) : 0;
    const r = outer ? 1 + GAP + side / 2 : closest + t * (inside - closest);
    return {
      x: r * Math.cos(direction),
      y: r * Math.sin(direction),
      side,
      outer,
      liked,
    };
  });
  const placed = relax(ideal, centreSide);

  return {
    albums: withPeople.map(({ album, people: ids }, i) => ({
      key: album.key,
      title: album.title,
      artist: album.artist,
      people: ids,
      liked: ideal[i].liked,
      x: placed[i].x,
      y: placed[i].y,
      side: ideal[i].side,
    })),
    people,
  };
};
