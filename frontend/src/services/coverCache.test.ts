import {
  CoverEntry,
  MISS_RECHECK_MS,
  needsCheck,
  readCovers,
  writeCovers,
} from "./coverCache";

const now = 1_800_000_000_000;
const hit: CoverEntry = {
  key: "master:1",
  mbid: "abc",
  kind: "release-group",
  checkedAt: now - 10 * MISS_RECHECK_MS,
};
const miss = (age: number): CoverEntry => ({
  key: "release:2",
  mbid: null,
  kind: "release",
  checkedAt: now - age,
});

describe("needsCheck", () => {
  it("checks keys never looked up", () => {
    expect(needsCheck(undefined, now)).toBe(true);
  });

  it("keeps hits for good", () => {
    expect(needsCheck(hit, now)).toBe(false);
  });

  it("re-checks misses after 30 days", () => {
    expect(needsCheck(miss(MISS_RECHECK_MS - 1), now)).toBe(false);
    expect(needsCheck(miss(MISS_RECHECK_MS), now)).toBe(true);
  });
});

describe("readCovers and writeCovers", () => {
  it("round-trips entries, misses included (in memory without IndexedDB)", async () => {
    await writeCovers([hit, miss(0)]);
    const found = await readCovers(["master:1", "release:2", "master:9"]);
    expect(found.get("master:1")).toEqual(hit);
    expect(found.get("release:2")?.mbid).toBeNull();
    expect(found.has("master:9")).toBe(false);
  });
});
