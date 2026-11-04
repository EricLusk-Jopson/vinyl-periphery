import { Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { metaAlbum } from "./metaAlbum";
import {
  axisYears,
  buildSwimlanes,
  laneSpan,
  nearestResultTick,
  searchSwimlanes,
  stackSwimlanes,
  topLanes,
} from "./swimlanes";

const person = (
  id: number,
  name: string,
  roles: string[],
  extra: Partial<Contributor> = {},
): Contributor => ({
  id,
  name,
  roles,
  sources: ["credits"],
  resourceUrl: "",
  ...extra,
});

const release = (
  id: number,
  year: string,
  contributorIds: number[],
): EnrichedRelease => ({
  id,
  type: "master",
  key: `master:${id}`,
  title: `Album ${id}`,
  artist: "Someone",
  year,
  thumb: "",
  resource_url: "",
  contributorIds,
});

const drummer = person(1, "Jim Keltner", ["Drums"]);
const producer = person(2, "Steve Albini (2)", ["Producer"], {
  discography: { items: 2600, pages: 4, capped: true },
});
const singer = person(3, "Bob Singer", ["Vocals"], { sources: ["artist"] });

const releases = [
  release(10, "1971", [1]),
  release(11, "1971", [1]),
  release(12, "1985", [1, 2]),
  release(13, "0", [2]),
  release(14, "", [2, 3]),
  release(15, "1990", [3]),
  release(16, "2001", [2]),
];
const input = {
  people: [drummer, producer, singer].map((c) => ({ id: c.id, contributor: c })),
  releases,
  results: [
    { key: "master:10", activeContributors: [1] },
    // 12 is a result through the drummer only.
    { key: "master:12", activeContributors: [1] },
    { key: "master:16", activeContributors: [2] },
  ],
  albums: [{ key: "master:99", title: "Searched", year: 1985, accent: true }],
};

describe("buildSwimlanes", () => {
  const lanes = buildSwimlanes(input);
  const lane = (id: number) => lanes.lanes.find((l) => l.id === id)!;

  it("ticks each person's items by year, solid where they link a result", () => {
    expect(lane(1).ticks).toEqual([
      { year: 1971, results: ["master:10"], others: 1 },
      { year: 1985, results: ["master:12"], others: 0 },
    ]);
    // 12 is a result, but not through the producer: faint on his lane.
    expect(lane(2).ticks).toEqual([
      { year: 1985, results: [], others: 1 },
      { year: 2001, results: ["master:16"], others: 0 },
    ]);
    expect(lane(1).results).toBe(2);
    expect(lane(2).name).toBe("Steve Albini");
  });

  it("counts undated items and never draws them", () => {
    expect(lane(2).undated).toBe(2);
    expect(lane(3).undated).toBe(1);
    // Album 14 is on two lanes: one undated album.
    expect(lanes.undated).toBe(2);
    for (const l of lanes.lanes) {
      expect(l.ticks.every((t) => t.year > 0)).toBe(true);
    }
  });

  it("sorts by primary group, then first year", () => {
    // Band (the artist), session (drums), then production.
    expect(lanes.lanes.map((l) => l.id)).toEqual([3, 1, 2]);
    expect(lanes.lanes.map((l) => l.group)).toEqual([
      "band",
      "session",
      "production",
    ]);
  });

  it("marks lanes the page cap cut short", () => {
    expect(lane(2).partial).toBe(true);
    expect(lane(1).partial).toBe(false);
  });

  it("spans the years drawn and the album lines", () => {
    expect([lanes.from, lanes.to]).toEqual([1971, 2001]);
    expect(lanes.albums).toEqual([
      { key: "master:99", title: "Searched", year: 1985, accent: true },
    ]);
    const short = buildSwimlanes({
      ...input,
      people: [],
      albums: [{ key: "a", title: "A", year: 2000, accent: true }],
    });
    expect([short.from, short.to]).toEqual([1998, 2002]);
  });

  it("is the same for the same input", () => {
    expect(buildSwimlanes(input)).toEqual(lanes);
  });
});

describe("lane helpers", () => {
  const lanes = buildSwimlanes(input);
  it("keeps the lanes with most results, in order", () => {
    const top = topLanes(lanes, 2);
    expect(top.lanes.map((l) => l.id)).toEqual([1, 2]);
    expect(topLanes(lanes, 5)).toBe(lanes);
  });

  it("picks the nearest solid tick within reach", () => {
    const drums = lanes.lanes.find((l) => l.id === 1)!;
    expect(nearestResultTick(drums, 1983, 3)?.year).toBe(1985);
    expect(nearestResultTick(drums, 1978, 3)).toBeNull();
    expect(laneSpan(drums)).toBe("1971–1985");
  });

  it("marks the axis every ten years, or five on a short range", () => {
    expect(axisYears(1968, 2003)).toEqual([1970, 1980, 1990, 2000]);
    expect(axisYears(1998, 2012)).toEqual([2000, 2005, 2010]);
  });
});

const search = (
  id: number,
  contributors: Contributor[],
  rel: EnrichedRelease[],
): SearchCache =>
  ({
    searchId: `s-${id}`,
    searchParams: { artist: "A", album: `Album ${id}` },
    target: { type: "master", id, key: `master:${id}` },
    contributors: Object.fromEntries(contributors.map((c) => [c.id, c])),
    roles: {},
    releases: Object.fromEntries(rel.map((r) => [r.key, r])),
    filterState: {},
    thumb: "",
  }) as unknown as SearchCache;

describe("searchSwimlanes and stackSwimlanes", () => {
  it("draws one search's counted people and its year", () => {
    const s = search(12, [drummer, producer], releases);
    const lanes = searchSwimlanes(s, new Set([1]), input.results);
    expect(lanes.lanes.map((l) => l.id)).toEqual([1]);
    expect(lanes.albums).toEqual([
      { key: "master:12", title: "Album 12", year: 1985, accent: true },
    ]);
  });

  it("draws a stack's people once, with a line per stack album", () => {
    const a = search(12, [drummer, producer], releases);
    // b lists album 16 itself (2001); a lists it nowhere, and lists album
    // 12 with a different year than b does: each album's own search wins.
    const b = search(16, [producer], [release(16, "2001", [2]), release(12, "1990", [2])]);
    const meta = metaAlbum([a, b]);
    const counted = new Map([
      ["master:12", new Set([1, 2])],
      ["master:16", new Set([2])],
    ]);
    const lanes = stackSwimlanes(meta, counted, input.results, "master:12");
    expect(lanes.lanes.map((l) => l.id)).toEqual([1, 2]);
    expect(lanes.albums.map((m) => [m.key, m.year, m.accent])).toEqual([
      ["master:12", 1985, true],
      ["master:16", 2001, false],
    ]);
    // Album 12 is on the producer's discography through the second search.
    const producerLane = lanes.lanes.find((l) => l.id === 2)!;
    expect(producerLane.ticks.find((t) => t.year === 1985)?.others).toBe(1);
  });
});
