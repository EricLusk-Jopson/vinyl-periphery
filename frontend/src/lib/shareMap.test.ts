import { SearchCache } from "@/contexts/cache/types";
import {
  centreOfMass,
  layoutMap,
  MAP_OUTER_BAND,
  MAP_SIZES,
  mapAlbums,
  personAngle,
  relax,
} from "./shareMap";

describe("personAngle and centreOfMass", () => {
  it("gives each person a fixed point on the circle", () => {
    expect(personAngle(194118)).toBe(personAngle(194118));
    const angles = [1, 2, 3, 194118, 59373].map(personAngle);
    angles.forEach((a) => {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(2 * Math.PI);
    });
    // Neighbouring ids don't bunch up.
    expect(new Set(angles.map((a) => Math.round(a * 10))).size).toBe(5);
  });

  it("puts one person's album on the rim, and mixed ones further in", () => {
    const one = centreOfMass([7]);
    expect(Math.hypot(one.x, one.y)).toBeCloseTo(1);
    expect(one.x).toBeCloseTo(Math.cos(personAngle(7)));
    const many = centreOfMass([1, 2, 3, 4, 5, 6]);
    expect(Math.hypot(many.x, many.y)).toBeLessThan(1);
    expect(centreOfMass([])).toEqual({ x: 0, y: 0 });
  });
});

const member = (
  id: number,
  album: string,
  results: Record<number, number[]>,
  via: number[] = [],
) =>
  ({
    searchId: `A-${album}-${id}`,
    searchParams: { artist: "Artist", album },
    target: { type: "master", id, key: `master:${id}` },
    lineage: { stackId: "s", depth: via.length ? 1 : 0, path: [], via },
    releases: Object.fromEntries(
      Object.entries(results).map(([rid, contributorIds]) => [
        `master:${rid}`,
        {
          key: `master:${rid}`,
          title: `Album ${rid}`,
          artist: "X",
          contributorIds,
        },
      ]),
    ),
  }) as unknown as SearchCache;

describe("mapAlbums", () => {
  const root = member(1, "Root", { 2: [10, 11], 3: [10], 4: [12, 13] });
  const two = member(2, "Two", { 3: [14], 4: [12] }, [10]);
  const lone = member(5, "Lone", {}, [99]);

  it("takes the stack's albums, then liked albums in their results", () => {
    const likes = {
      "master:3": { title: "Album 3", artist: "X", likedAt: 1 },
      "master:4": { title: "Album 4", artist: "X", likedAt: 2 },
      "master:8": { title: "Nowhere", artist: "X", likedAt: 3 },
    };
    const albums = mapAlbums("master:1", [root, two, lone], likes);
    expect(albums.map((a) => [a.key, a.people, a.member, a.liked])).toEqual([
      ["master:2", [10, 11], true, false],
      // No result names it: the people it was reached through.
      ["master:5", [99], true, false],
      // People from every search's results, most-linked first.
      ["master:3", [10, 14], false, true],
      ["master:4", [12, 13], false, true],
    ]);
  });

  it("stops at the cap", () => {
    const likes = {
      "master:3": { title: "Album 3", artist: "X", likedAt: 1 },
    };
    expect(mapAlbums("master:1", [root, two], likes, 1)).toHaveLength(1);
  });
});

describe("relax and layoutMap", () => {
  const overlaps = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    side: number,
  ) => Math.abs(a.x - b.x) < side && Math.abs(a.y - b.y) < side;

  it("pushes covers off each other and the centre, inside the circle", () => {
    const side = MAP_SIZES[1];
    // Five covers wanting the same spot.
    const ideal = Array.from({ length: 5 }, () => ({ x: 0.5, y: 0, side }));
    const placed = relax(ideal, MAP_SIZES.centre);
    for (let i = 0; i < placed.length; i++) {
      expect(Math.hypot(placed[i].x, placed[i].y)).toBeLessThanOrEqual(
        1 - side / 2 + 1e-9,
      );
      expect(
        overlaps(placed[i], { x: 0, y: 0 }, (side + MAP_SIZES.centre) / 2),
      ).toBe(false);
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlaps(placed[i], placed[j], side)).toBe(false);
      }
    }
    // The same input lands the same way every time.
    expect(relax(ideal, MAP_SIZES.centre)).toEqual(placed);
  });

  it("puts albums one person links just outside the circle, by them", () => {
    const side = MAP_SIZES[1];
    const { albums } = layoutMap([
      {
        key: "a",
        title: "A",
        artist: "",
        people: [7],
        member: false,
        liked: true,
      },
      {
        key: "b",
        title: "B",
        artist: "",
        people: [7],
        member: false,
        liked: true,
      },
      {
        key: "c",
        title: "C",
        artist: "",
        people: [7, 8],
        member: false,
        liked: true,
      },
    ]);
    const [a, b, c] = albums;
    for (const outer of [a, b]) {
      // On the ring just past the circle, within the band kept for it.
      const r = Math.hypot(outer.x, outer.y);
      expect(r).toBeGreaterThan(1 + side / 2);
      expect(r + side / 2).toBeLessThanOrEqual(1 + MAP_OUTER_BAND);
    }
    // Near their person, and not on top of each other.
    const angle = personAngle(7);
    expect(Math.cos(Math.atan2(a.y, a.x) - angle)).toBeGreaterThan(0.9);
    expect(Math.abs(a.x - b.x) >= side || Math.abs(a.y - b.y) >= side).toBe(
      true,
    );
    // Two people: inside.
    expect(Math.hypot(c.x, c.y)).toBeLessThanOrEqual(1 - side / 2 + 1e-9);
  });

  it("sizes liked stack albums up and lists the people by albums linked", () => {
    const { albums, people } = layoutMap([
      {
        key: "a",
        title: "A",
        artist: "",
        people: [1, 2],
        member: true,
        liked: true,
      },
      {
        key: "b",
        title: "B",
        artist: "",
        people: [1],
        member: false,
        liked: true,
      },
      {
        key: "c",
        title: "C",
        artist: "",
        people: [3],
        member: true,
        liked: false,
      },
    ]);
    expect(albums.map((a) => a.z)).toEqual([2, 1, 1]);
    expect(people.map((p) => [p.id, p.albums])).toEqual([
      [1, 2],
      [2, 1],
      [3, 1],
    ]);
  });
});
