import { SearchCache } from "@/contexts/cache/types";
import { childLineage, rootLineage } from "./lineage";
import {
  canJoin,
  defaultStackName,
  holds,
  memberFor,
  withoutMemberNumbers,
  resolveMember,
  savedByAlbum,
  stacksFromLineage,
  stepsFromStart,
  strandedBy,
  without,
  StackRecord,
} from "./stackRecords";

/** An album whose results are the given album ids, linked by person 1. */
const album = (
  id: number,
  title: string,
  results: number[] = [],
  parent?: SearchCache,
): SearchCache => {
  const search = {
    searchId: `${title}-${1000 + id}`,
    searchParams: { artist: `${title} Artist`, album: title },
    target: { type: "master", id, key: `master:${id}` },
    thumb: "",
    releases: Object.fromEntries(
      results.map((r) => [
        `master:${r}`,
        { key: `master:${r}`, contributorIds: [1] },
      ]),
    ),
  } as unknown as SearchCache;
  search.lineage = parent
    ? childLineage(parent, [1], "")
    : rootLineage(search.searchId);
  return search;
};

// A seed linking B, B linking C; D links nothing.
const seed = album(1, "Seed", [2]);
const b = album(2, "B", [3], seed);
const c = album(3, "C", [], b);
const d = album(4, "D");

describe("canJoin", () => {
  it("lets in anything to an empty stack, then only linked albums", () => {
    expect(canJoin(seed, []).ok).toBe(true);
    expect(canJoin(b, [seed])).toMatchObject({
      ok: true,
      via: seed,
      people: [1],
    });
    // C links to B only, found from either side.
    expect(canJoin(c, [seed]).ok).toBe(false);
    expect(canJoin(c, [seed, b])).toMatchObject({ ok: true, via: b });
    expect(canJoin(d, [seed, b, c]).ok).toBe(false);
    expect(canJoin(b, [seed, b])).toMatchObject({ ok: false, member: true });
  });
});

describe("stepsFromStart and strandedBy", () => {
  it("counts links from the start", () => {
    const steps = stepsFromStart([seed, b, c, d]);
    expect(Object.fromEntries(steps)).toEqual({
      "master:1": 0,
      "master:2": 1,
      "master:3": 2,
    });
  });

  it("names the albums a removal would cut off from the start", () => {
    expect(strandedBy([seed, b, c], new Set(["master:2"]))).toEqual([c]);
    expect(strandedBy([seed, b, c], new Set(["master:3"]))).toEqual([]);
    // Without the start, B starts: C still links to it.
    expect(strandedBy([seed, b, c], new Set(["master:1"]))).toEqual([]);
  });
});

describe("members", () => {
  const record: StackRecord = {
    id: "stack-1",
    name: "Mine",
    members: [memberFor(seed, 1), memberFor(b, 2)],
    createdAt: 1,
    updatedAt: 2,
  };

  it("finds a member's search, or the album's latest run", () => {
    const rerun = { ...b, searchId: "B-9999" } as SearchCache;
    const byAlbum = savedByAlbum(
      { [seed.searchId]: seed, [rerun.searchId]: rerun },
      new Set([seed.searchId, rerun.searchId]),
    );
    expect(resolveMember(record.members[0], byAlbum)).toBe(seed);
    expect(resolveMember(record.members[1], byAlbum)).toBe(rerun);
  });

  it("holds and takes out albums, by album", () => {
    expect(holds(record, b)).toBe(true);
    expect(holds(record, c)).toBe(false);
    expect(without(record, b, 5)).toMatchObject({
      members: [record.members[0]],
      updatedAt: 5,
    });
  });

  it("names a stack from its albums by default", () => {
    expect(defaultStackName([])).toBe("New stack");
    expect(defaultStackName(record.members)).toBe("Seed + 1");
  });
});

describe("stacksFromLineage", () => {
  it("turns lineage stacks of two or more into records, start first", () => {
    const records = stacksFromLineage([c, d, b, seed], 99);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: seed.searchId,
      name: "Seed + 2",
      updatedAt: 99,
    });
    expect(records[0].members.map((m) => m.title)).toEqual(["Seed", "B", "C"]);
  });
});

describe("withoutMemberNumbers", () => {
  it("takes Discogs's numbers off members' artists, the same record when clean", () => {
    const member = { searchId: "a", targetKey: "master:1", title: "Cowards", thumb: "", addedAt: 1 };
    const record = {
      id: "stack-1",
      name: "Squid",
      createdAt: 1,
      members: [
        { ...member, artist: "Squid (29)" },
        { ...member, searchId: "b", targetKey: "master:2", artist: "Black Midi" },
      ],
    } as unknown as StackRecord;
    const clean = withoutMemberNumbers(record);
    expect(clean.members.map((m) => m.artist)).toEqual(["Squid", "Black Midi"]);
    expect(clean.members[1]).toBe(record.members[1]);
    expect(withoutMemberNumbers(clean)).toBe(clean);
  });
});
