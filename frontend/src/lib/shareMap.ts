import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { lineageOf } from "./lineage";

/**
 * The share map: one album at the centre, the stack's other albums and the
 * liked albums in their results around it.
 *
 * Every contributor gets a fixed point on the unit circle (random, but the
 * same every time: seeded by their Discogs id). An album sits at the centre
 * of mass of the people linking it, so albums sharing people sit together,
 * and an album linked by people from all sides drifts toward the middle.
 * Then overlapping covers are pushed apart. Pure, so it can be tested and
 * its output sent to the renderer as plain positions.
 */

export const MAX_MAP_ALBUMS = 24;
export const MAX_MAP_PEOPLE = 8;

/** Cover sides, as fractions of the circle's radius. */
export const MAP_SIZES = { centre: 0.46, 1: 0.28, 2: 0.36 } as const;
/** Room kept between covers, as a fraction of the radius. */
const GAP = 0.03;

export interface MapAlbum {
  key: string;
  title: string;
  artist: string;
  /** Contributor ids linking it to the rest of the map. */
  people: number[];
  /** One of the stack's own searches. */
  member: boolean;
  liked: boolean;
}

export interface PlacedAlbum extends MapAlbum {
  /** Centre of its cover, in the unit circle. */
  x: number;
  y: number;
  /** Size tier: 2 for a liked stack album, else 1. */
  z: 1 | 2;
}

export interface MapPerson {
  id: number;
  /** Radians, counter-clockwise from the right. */
  angle: number;
  /** How many albums on the map they link. */
  albums: number;
}

/** A contributor's fixed point on the circle, from their Discogs id. */
export const personAngle = (id: number): number => {
  // A multiplicative hash spreads neighbouring ids around the circle.
  const hashed = Math.imul(id ^ (id >>> 16), 0x45d9f3b) >>> 0;
  return (
    ((Math.imul(hashed ^ (hashed >>> 16), 0x45d9f3b) >>> 0) / 2 ** 32) *
    2 *
    Math.PI
  );
};

/** The centre of mass of people's points on the circle. */
export const centreOfMass = (people: number[]): { x: number; y: number } => {
  if (people.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const id of people) {
    x += Math.cos(personAngle(id));
    y += Math.sin(personAngle(id));
  }
  return { x: x / people.length, y: y / people.length };
};

/**
 * The albums around the centre: the other searches (`members`), then liked
 * albums found in their results, most-linked first, up to `max`. Each with
 * the people linking it, gathered from every member's results; a member no
 * result names falls back to the people it was reached through.
 */
export const mapAlbums = (
  centreKey: string,
  members: SearchCache[],
  likes: Likes,
  max = MAX_MAP_ALBUMS,
): MapAlbum[] => {
  const peopleFor = (key: string) =>
    Array.from(
      new Set(
        members.flatMap((m) =>
          m.target?.key === key
            ? []
            : (m.releases?.[key]?.contributorIds ?? []),
        ),
      ),
    ).sort((a, b) => a - b);

  const albums: MapAlbum[] = [];
  const seen = new Set([centreKey]);
  for (const member of members) {
    const key = member.target?.key;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const people = peopleFor(key);
    albums.push({
      key,
      title: member.searchParams.album,
      artist: member.searchParams.artist,
      people: people.length > 0 ? people : [...lineageOf(member).via],
      member: true,
      liked: Boolean(likes[key]),
    });
  }

  const liked: MapAlbum[] = [];
  for (const key of Object.keys(likes)) {
    if (seen.has(key)) continue;
    const release = members
      .map((m) => m.releases?.[key])
      .find((r) => r !== undefined);
    if (!release) continue;
    seen.add(key);
    liked.push({
      key,
      title: release.title,
      artist: release.artist,
      people: peopleFor(key),
      member: false,
      liked: true,
    });
  }
  liked.sort(
    (a, b) =>
      b.people.length - a.people.length || a.title.localeCompare(b.title),
  );
  return [...albums, ...liked].filter((a) => a.people.length > 0).slice(0, max);
};

const sizeTier = (album: MapAlbum): 1 | 2 =>
  album.member && album.liked ? 2 : 1;

/**
 * Pushes overlapping covers apart while each is pulled back toward its
 * place, keeping every cover inside the circle. The centre cover stays put.
 * Deterministic: the same albums always land in the same places.
 */
export const relax = (
  ideal: Array<{ x: number; y: number; side: number }>,
  centreSide: number,
  iterations = 300,
): Array<{ x: number; y: number }> => {
  const points = ideal.map((p) => ({ ...p }));
  const all = [{ x: 0, y: 0, side: centreSide, fixed: true }, ...points];
  const inside = (p: { x: number; y: number; side: number }) => {
    const limit = 1 - p.side / 2;
    const length = Math.hypot(p.x, p.y);
    if (length > limit) {
      p.x *= limit / length;
      p.y *= limit / length;
    }
  };
  for (let step = 0; step < iterations; step++) {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const reach = (a.side + b.side) / 2 + GAP;
        const overlapX = reach - Math.abs(dx);
        const overlapY = reach - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (dx === 0 && dy === 0) {
          // Same spot: split them along a direction fixed by their order.
          dx = Math.cos(j * 2.399963);
          dy = Math.sin(j * 2.399963);
        }
        // Along the axis that needs the shorter move.
        const alongX = overlapX < overlapY;
        const move = (alongX ? overlapX : overlapY) / 2;
        const sign = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
        const aFixed = "fixed" in a;
        const shareA = aFixed ? 0 : 1;
        const shareB = aFixed ? 2 : 1;
        if (alongX) {
          a.x -= sign * move * shareA;
          b.x += sign * move * shareB;
        } else {
          a.y -= sign * move * shareA;
          b.y += sign * move * shareB;
        }
      }
    }
    points.forEach((p, i) => {
      p.x += (ideal[i].x - p.x) * 0.02;
      p.y += (ideal[i].y - p.y) * 0.02;
      inside(p);
    });
  }
  return points.map(({ x, y }) => ({ x, y }));
};

/** Albums with their places on the map, and the people around the rim. */
export const layoutMap = (
  albums: MapAlbum[],
): { albums: PlacedAlbum[]; people: MapPerson[] } => {
  const ideal = albums.map((album) => {
    const z = sizeTier(album);
    const side = MAP_SIZES[z];
    const point = centreOfMass(album.people);
    // Keep the ideal spot inside the circle, too.
    const limit = 1 - side / 2;
    const length = Math.hypot(point.x, point.y);
    const scale = length > limit ? limit / length : 1;
    return { x: point.x * scale, y: point.y * scale, side };
  });
  const placed = relax(ideal, MAP_SIZES.centre);

  const counts = new Map<number, number>();
  albums.forEach((album) =>
    album.people.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)),
  );
  const people = Array.from(counts, ([id, count]) => ({
    id,
    angle: personAngle(id),
    albums: count,
  })).sort((a, b) => b.albums - a.albums || a.id - b.id);

  return {
    albums: albums.map((album, i) => ({
      ...album,
      ...placed[i],
      z: sizeTier(album),
    })),
    people,
  };
};
