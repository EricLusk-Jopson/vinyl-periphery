import { SearchCache } from "@/contexts/cache/types";
import {
  layoutStackMap,
  orderStackResults,
  relaxGraph,
  STACK_SIZES,
  stackAsSearch,
  stackResults,
} from "./stackMap";

const member = (
  id: number,
  results: Record<number, number[]>,
  savedAt = id,
): SearchCache =>
  ({
    searchId: `s-${id}`,
    searchParams: { artist: `Artist ${id}`, album: `Album ${id}` },
    target: { type: "master", id, key: `master:${id}` },
    contributors: {},
    roles: {},
    releases: Object.fromEntries(
      Object.entries(results).map(([rid, people]) => [
        `master:${rid}`,
        {
          id: Number(rid),
          type: "master",
          key: `master:${rid}`,
          title: `Result ${rid}`,
          artist: "Someone",
          year: "2000",
          thumb: "",
          resource_url: "",
          contributorIds: people,
        },
      ]),
    ),
    filterState: {
      contributors: {},
      roles: {},
      excludeMainArtist: true,
      collaborationsOnly: false,
      excludeVarious: false,
    },
    thumb: "",
    savedAt,
  }) as unknown as SearchCache;

const centre = { key: "master:1", title: "Album 1", artist: "Artist 1" };
const distance = (a: { x: number; y: number }, b = { x: 0, y: 0 }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

// 1 -> 2 and 3 (step 1); 2 -> 4 (step 2).
const root = member(1, { 2: [1], 3: [2], 50: [1, 2], 51: [2] });
const two = member(2, { 4: [5], 50: [5], 52: [5, 6] });
const three = member(3, { 53: [7] });
const four = member(4, { 52: [8] });
const levels = new Map([
  ["s-1", 0],
  ["s-2", 1],
  ["s-3", 1],
  ["s-4", 2],
]);
const all = [root, two, three, four];

describe("layoutStackMap", () => {
  const keys = stackResults(centre, all).map((r) => r.key);
  const nodes = layoutStackMap(centre, all, levels, {}, keys);
  const byKey = (key: string) => nodes.find((n) => n.key === key)!;

  it("puts the stack's albums on a ring, sides one step long", () => {
    // Four albums: a square, the start at the top, then clockwise in the
    // order walked (1, 2, 4 from 2, then 3).
    const ring = ["master:1", "master:2", "master:4", "master:3"].map(byKey);
    const middle = {
      x: ring.reduce((s, n) => s + n.x, 0) / 4,
      y: ring.reduce((s, n) => s + n.y, 0) / 4,
    };
    for (let k = 0; k < 4; k++) {
      expect(distance(ring[k], ring[(k + 1) % 4])).toBeCloseTo(1);
      expect(distance(ring[k], middle)).toBeCloseTo(Math.SQRT1_2);
    }
    expect(byKey("master:1").y).toBeGreaterThan(middle.y);
    // Album 4 still links to the album it came from.
    expect(byKey("master:4").links).toEqual([nodes.indexOf(byKey("master:2"))]);
  });

  it("makes a line of two and a triangle of three", () => {
    const pair = layoutStackMap(centre, [root, two], levels, {}, []);
    expect(distance(pair[0], pair[1])).toBeCloseTo(1);
    const trio = layoutStackMap(centre, [root, two, three], levels, {}, []);
    expect(distance(trio[0], trio[1])).toBeCloseTo(1);
    expect(distance(trio[1], trio[2])).toBeCloseTo(1);
    expect(distance(trio[2], trio[0])).toBeCloseTo(1);
  });

  it("places results by the stack albums they share people with", () => {
    // 53 shares only with album 3: next to it, not near album 2.
    const r53 = byKey("master:53");
    expect(distance(r53, byKey("master:3"))).toBeLessThan(
      distance(r53, byKey("master:2")),
    );
    // 50 shares with albums 1 (two people) and 2 (one): linked to both.
    expect(byKey("master:50").links).toEqual([
      0,
      nodes.indexOf(byKey("master:2")),
    ]);
  });

  it("keeps the stack's albums out of the results and covers apart", () => {
    expect(
      nodes
        .filter((n) => n.member)
        .map((n) => n.key)
        .sort(),
    ).toEqual(["master:1", "master:2", "master:3", "master:4"]);
    expect(nodes.filter((n) => !n.member)).toHaveLength(4);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const reach = (nodes[i].side + nodes[j].side) / 2;
        const apart =
          Math.abs(nodes[i].x - nodes[j].x) >= reach - 1e-6 ||
          Math.abs(nodes[i].y - nodes[j].y) >= reach - 1e-6;
        expect(apart).toBe(true);
      }
    }
  });

  it("draws the results it's given, in that order", () => {
    const liked = { "master:51": { title: "", artist: "", likedAt: 0 } };
    const two = layoutStackMap(centre, all, levels, liked, [
      "master:51",
      "master:50",
    ]);
    const results = two.filter((n) => !n.member);
    expect(results.map((n) => n.key)).toEqual(["master:51", "master:50"]);
    expect(results[0].side).toBeCloseTo(
      STACK_SIZES.smallest + STACK_SIZES.liked,
    );
  });
});

describe("stackResults", () => {
  it("lists each result once, most connected first, stack albums left out", () => {
    const results = stackResults(centre, all);
    // 50: two people from album 1 and one from 2; 52: two from 2 and one
    // from 4. Both 3; both linked to two albums.
    expect(results.map((r) => [r.key, r.score])).toEqual([
      ["master:50", 3],
      ["master:52", 3],
      ["master:51", 1],
      ["master:53", 1],
    ]);
    // Linked by everyone in the stack on it.
    expect(results[0].activeContributors.sort()).toEqual([1, 2, 5]);
  });

  it("orders by the chosen sort, liked albums first when asked", () => {
    const results = stackResults(centre, all);
    const likes = { "master:53": { title: "", artist: "", likedAt: 0 } };
    const keys = (r: { key: string }[]) => r.map((x) => x.key);
    expect(
      keys(orderStackResults(results, "shared", null, likes, true)),
    ).toEqual(["master:53", "master:50", "master:52", "master:51"]);
    expect(
      keys(orderStackResults(results, "shared", null, likes, false)),
    ).toEqual(["master:50", "master:52", "master:51", "master:53"]);
    // A tiebreaker sorts by people shared first; every artist is the
    // same here, so ties keep their order.
    expect(
      keys(orderStackResults(results, "shared", "artistDesc", {}, false)),
    ).toEqual(["master:50", "master:52", "master:51", "master:53"]);
  });

  it("searches the stack's results as one search", () => {
    const as = stackAsSearch(root, all, stackResults(centre, all));
    expect(Object.keys(as.releases).sort()).toEqual([
      "master:50",
      "master:51",
      "master:52",
      "master:53",
    ]);
  });
});

describe("relaxGraph", () => {
  it("never moves fixed covers", () => {
    const placed = relaxGraph([
      { x: 0, y: 0, side: 0.5, fixed: true },
      { x: 0, y: 0, side: 0.3, fixed: false },
      { x: 0.1, y: 0, side: 0.3, fixed: false },
    ]);
    expect(placed[0]).toEqual({ x: 0, y: 0 });
    expect(distance(placed[1])).toBeGreaterThan(0.3);
  });
});
