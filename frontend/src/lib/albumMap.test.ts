import { ScoredRelease } from "./results";
import {
  ALBUM_SIZES,
  layoutAlbumMap,
  personCategory,
  placePeople,
} from "./albumMap";
import { MAP_SIZES } from "./shareMap";

const person = (id: number, roles: string[]) => ({ id, roles });

const album = (
  id: number,
  people: number[],
  community?: { want: number; have: number },
): ScoredRelease => ({
  id,
  type: "master",
  key: `master:${id}`,
  title: `Album ${id}`,
  artist: "Someone",
  year: "2000",
  thumb: "",
  resource_url: "",
  contributorIds: people,
  activeContributors: people,
  score: 0,
  confidence: 0,
  ...(community ? { community } : {}),
});

const contributors = {
  1: person(1, ["Drums"]),
  2: person(2, ["Guitar", "Producer"]),
  3: person(3, ["Mixed By"]),
  4: person(4, ["Mastered By"]),
  5: person(5, ["Design"]),
};

const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
};

describe("personCategory", () => {
  it("takes the first category in filter order", () => {
    expect(personCategory(["Producer", "Guitar"])).toBe("musicians");
    expect(personCategory(["Design"])).toBe("physical");
    expect(personCategory([])).toBe("other");
  });
});

describe("placePeople", () => {
  it("groups people by category, with a gap between groups", () => {
    const people = placePeople([{ people: [1, 2, 3, 4, 5] }], contributors);
    expect(people.map((p) => [p.id, p.category])).toEqual([
      [1, "musicians"],
      [2, "musicians"],
      [3, "audio"],
      [4, "audio"],
      [5, "physical"],
    ]);
    // 5 people + 3 group gaps = 8 slots of 45°.
    const slot = Math.PI / 4;
    expect(angleGap(people[0].angle, people[1].angle)).toBeCloseTo(slot);
    expect(angleGap(people[1].angle, people[2].angle)).toBeCloseTo(2 * slot);
    expect(angleGap(people[3].angle, people[4].angle)).toBeCloseTo(2 * slot);
  });

  it("spaces one category evenly, no gaps", () => {
    const people = placePeople([{ people: [1, 2] }], contributors);
    expect(angleGap(people[0].angle, people[1].angle)).toBeCloseTo(Math.PI);
  });
});

describe("layoutAlbumMap", () => {
  const radius = (a: { x: number; y: number }) => Math.hypot(a.x, a.y);

  it("puts albums sharing more people closer to the middle", () => {
    const { albums } = layoutAlbumMap(
      [album(10, [1, 2, 3]), album(11, [1, 3]), album(12, [5])],
      contributors,
      {},
    );
    const [three, two, one] = albums;
    expect(radius(three)).toBeLessThan(radius(two));
    // One person: outside the circle.
    expect(radius(one)).toBeGreaterThan(1);
    // Two or more: inside it.
    expect(radius(two) + two.side / 2).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("points an album toward its people", () => {
    const { albums, people } = layoutAlbumMap(
      [album(10, [5]), album(11, [1, 2, 3, 4, 5]), album(12, [1, 2])],
      contributors,
      {},
    );
    const designer = people.find((p) => p.id === 5)!;
    const lone = albums[0];
    expect(angleGap(Math.atan2(lone.y, lone.x), designer.angle)).toBeLessThan(
      0.3,
    );
  });

  it("sizes by popularity and likes", () => {
    const { albums } = layoutAlbumMap(
      [
        album(10, [1, 2], { want: 1000, have: 9000 }),
        album(11, [1, 3], { want: 1, have: 9 }),
        album(12, [2, 3]),
        album(13, [3, 4], { want: 1, have: 9 }),
      ],
      contributors,
      { "master:13": { title: "", artist: "", likedAt: 0 } },
    );
    const [popular, quiet, unknown, liked] = albums.map((a) => a.side);
    expect(popular).toBeCloseTo(ALBUM_SIZES.smallest + ALBUM_SIZES.popular);
    expect(quiet).toBeCloseTo(ALBUM_SIZES.smallest);
    expect(unknown).toBeCloseTo(ALBUM_SIZES.smallest);
    expect(liked).toBeCloseTo(ALBUM_SIZES.smallest + ALBUM_SIZES.liked);
  });

  it("keeps covers apart, even crowded toward one side", () => {
    // Twelve albums, most of them pulled toward the same few people.
    const crowd = [
      [1, 2, 3, 4],
      [1, 2, 3],
      [1, 3, 4],
      [2, 3, 4],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [1, 4],
      [2, 4],
      [1, 2, 3, 4, 5],
      [3, 5],
    ].map((ids, i) => album(20 + i, ids, { want: i * 50, have: i * 400 }));
    const likes = Object.fromEntries(
      ["master:20", "master:24", "master:30"].map((k) => [
        k,
        { title: "", artist: "", likedAt: 0 },
      ]),
    );
    const { albums } = layoutAlbumMap(crowd, contributors, likes);
    const all = [{ x: 0, y: 0, side: MAP_SIZES.centre }, ...albums];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const reach = (all[i].side + all[j].side) / 2;
        const apart =
          Math.abs(all[i].x - all[j].x) >= reach - 1e-6 ||
          Math.abs(all[i].y - all[j].y) >= reach - 1e-6;
        expect(apart).toBe(true);
      }
    }
  });

  it("is the same every time", () => {
    const input = [album(10, [1, 2]), album(11, [3]), album(12, [1, 4, 5])];
    expect(layoutAlbumMap(input, contributors, {})).toEqual(
      layoutAlbumMap(input, contributors, {}),
    );
  });
});
