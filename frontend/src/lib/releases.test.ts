import { EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import {
  addRelease,
  contributionsOf,
  migrateReleases,
  migrateSearch,
  discographyPagesToRead,
  releaseKey,
  releaseType,
  toEnrichedRelease,
  versionTargets,
} from "./releases";

// Shaped like real /artists/{id}/releases items.
const master = {
  id: 51539,
  title: "The Lonesome Crowded West",
  type: "master",
  main_release: 22460452,
  artist: "Modest Mouse",
  role: "Appearance",
  resource_url: "https://api.discogs.com/masters/51539",
  year: 2022,
  thumb: "",
};
const mainVersion = {
  id: 22460452,
  title: "The Lonesome Crowded West",
  type: "release",
  artist: "Modest Mouse",
  role: "Main",
  resource_url: "https://api.discogs.com/releases/22460452",
  year: 2022,
  thumb: "",
};
// A release with the same numeric id as the master, a different album.
const sameIdRelease = {
  id: 51539,
  title: "Something Else",
  type: "release",
  artist: "Other Band",
  resource_url: "https://api.discogs.com/releases/51539",
  year: 1990,
};

const results = (map: Map<string, EnrichedRelease>) =>
  Array.from(map.values()).map((r) => [r.key, r.contributorIds]);

describe("releaseKey and releaseType", () => {
  it("keys masters and releases apart", () => {
    expect(releaseKey("master", 1)).toBe("master:1");
    expect(releaseKey("release", 1)).toBe("release:1");
  });

  it("reads the type, falling back to the resource URL", () => {
    expect(releaseType({ type: "master" })).toBe("master");
    expect(
      releaseType({ resource_url: "https://api.discogs.com/masters/9" }),
    ).toBe("master");
    expect(
      releaseType({ resource_url: "https://api.discogs.com/releases/9" }),
    ).toBe("release");
    expect(releaseType({})).toBe("release");
  });
});

describe("toEnrichedRelease", () => {
  it("keeps only the fields results use, with type and key", () => {
    expect(toEnrichedRelease(master, 7)).toEqual({
      id: 51539,
      type: "master",
      key: "master:51539",
      mainRelease: 22460452,
      title: "The Lonesome Crowded West",
      year: "2022",
      artist: "Modest Mouse",
      thumb: "",
      resource_url: "https://api.discogs.com/masters/51539",
      contributorIds: [7],
      contributions: { 7: [{ role: "Appearance", release: 22460452 }] },
    });
  });

  it("notes the version: a release's own id, a master's main_release", () => {
    expect(toEnrichedRelease(mainVersion, 1).contributions).toEqual({
      1: [{ role: "Main", release: 22460452 }],
    });
    const noVersion = { ...master, main_release: undefined };
    expect(toEnrichedRelease(noVersion, 1).contributions).toEqual({
      1: [{ role: "Appearance" }],
    });
    expect(
      toEnrichedRelease({ ...master, role: undefined }, 1).contributions,
    ).toBeUndefined();
  });

  it("reads master_id on releases when present", () => {
    expect(
      toEnrichedRelease({ ...mainVersion, master_id: 51539 }, 1).masterId,
    ).toBe(51539);
    expect(toEnrichedRelease(mainVersion, 1).masterId).toBeUndefined();
  });
});

describe("community counts", () => {
  it("keeps want and have from the item's stats", () => {
    const item = {
      ...master,
      stats: { community: { in_wantlist: 988, in_collection: 6835 } },
    };
    expect(toEnrichedRelease(item, 1).community).toEqual({
      want: 988,
      have: 6835,
    });
    expect(toEnrichedRelease(master, 1).community).toBeUndefined();
  });

  it("takes the larger counts when the same album comes from two people", () => {
    const map = new Map<string, EnrichedRelease>();
    const stats = (want: number, have: number) => ({
      stats: { community: { in_wantlist: want, in_collection: have } },
    });
    addRelease(map, toEnrichedRelease({ ...master, ...stats(10, 50) }, 1));
    addRelease(map, toEnrichedRelease({ ...master, ...stats(12, 40) }, 2));
    expect(map.get("master:51539")?.community).toEqual({ want: 12, have: 50 });
  });
});

describe("addRelease", () => {
  it("keeps a master and a release with the same numeric id apart", () => {
    const map = new Map<string, EnrichedRelease>();
    addRelease(map, toEnrichedRelease(master, 1));
    addRelease(map, toEnrichedRelease(sameIdRelease, 2));
    expect(results(map)).toEqual([
      ["master:51539", [1]],
      ["release:51539", [2]],
    ]);
  });

  it("merges the same master from several contributors", () => {
    const map = new Map<string, EnrichedRelease>();
    addRelease(map, toEnrichedRelease(master, 1));
    addRelease(map, toEnrichedRelease({ ...master, role: "Main" }, 2));
    addRelease(map, toEnrichedRelease(master, 1));
    expect(results(map)).toEqual([["master:51539", [1, 2]]]);
    expect(map.get("master:51539")?.contributions).toEqual({
      1: [{ role: "Appearance", release: 22460452 }],
      2: [{ role: "Main", release: 22460452 }],
    });
  });

  it("keeps every role a person has on one master", () => {
    // In Utero, from Albini's discography: Producer on one version, Remix
    // on another.
    const inUtero = {
      id: 42177,
      type: "master",
      title: "In Utero",
      resource_url: "https://api.discogs.com/masters/42177",
    };
    const map = new Map<string, EnrichedRelease>();
    addRelease(
      map,
      toEnrichedRelease(
        { ...inUtero, role: "Producer", main_release: 465796 },
        9,
      ),
    );
    addRelease(
      map,
      toEnrichedRelease(
        { ...inUtero, role: "Remix", main_release: 4943830 },
        9,
      ),
    );
    const merged = map.get("master:42177")!;
    expect(merged.mainRelease).toBe(465796);
    expect(contributionsOf(merged, 9)).toEqual([
      { role: "Producer", release: 465796 },
      { role: "Remix", release: 4943830 },
    ]);
  });

  it("folds the master's main release into the master, either order", () => {
    const first = new Map<string, EnrichedRelease>();
    addRelease(first, toEnrichedRelease(master, 1));
    expect(addRelease(first, toEnrichedRelease(mainVersion, 2))).toBe(
      "master:51539",
    );
    expect(results(first)).toEqual([["master:51539", [1, 2]]]);

    const second = new Map<string, EnrichedRelease>();
    addRelease(second, toEnrichedRelease(mainVersion, 2));
    addRelease(second, toEnrichedRelease(master, 1));
    expect(results(second)).toEqual([["master:51539", [1, 2]]]);
  });

  it("folds a release naming its master, either order", () => {
    const version = { ...mainVersion, id: 379811, master_id: 51539 };
    const map = new Map<string, EnrichedRelease>();
    addRelease(map, toEnrichedRelease(version, 3));
    addRelease(map, toEnrichedRelease(master, 1));
    expect(results(map)).toEqual([["master:51539", [1, 3]]]);
  });

  it("leaves other versions of a master alone when nothing links them", () => {
    // Without master_id, only the main release can be matched.
    const version = { ...mainVersion, id: 379811 };
    const map = new Map<string, EnrichedRelease>();
    addRelease(map, toEnrichedRelease(master, 1));
    addRelease(map, toEnrichedRelease(version, 3));
    expect(results(map)).toEqual([
      ["master:51539", [1]],
      ["release:379811", [3]],
    ]);
  });
});

describe("contributionsOf", () => {
  it("falls back to the one appearance older searches kept", () => {
    expect(
      contributionsOf({ appearances: { 1: { role: "Main" } } }, 1),
    ).toEqual([{ role: "Main" }]);
    expect(contributionsOf({}, 1)).toEqual([]);
  });
});

describe("versionTargets", () => {
  const inUtero = {
    id: 42177,
    type: "master" as const,
    mainRelease: 465796,
    resource_url: "https://api.discogs.com/masters/42177",
  };

  it("reads a release itself", () => {
    expect(
      versionTargets({ id: 5, type: "release", resource_url: "" }, [1]),
    ).toEqual([{ kind: "release", id: 5 }]);
  });

  it("reads a master's versions its people are on, each person's first first", () => {
    const release = {
      ...inUtero,
      contributions: {
        1: [
          { role: "Producer", release: 465796 },
          { role: "Remix", release: 4943830 },
        ],
        2: [{ role: "Bass", release: 111 }],
        3: [{ role: "Drums", release: 465796 }],
      },
    };
    expect(versionTargets(release, [1, 2, 3])).toEqual([
      { kind: "release", id: 465796 },
      { kind: "release", id: 111 },
      { kind: "release", id: 4943830 },
    ]);
    expect(versionTargets(release, [1, 2, 3], 2)).toHaveLength(2);
    // Only the people shown count.
    expect(versionTargets(release, [2])).toEqual([
      { kind: "release", id: 111 },
      { kind: "release", id: 465796 },
    ]);
  });

  it("falls back to the result's main release, then the master", () => {
    expect(versionTargets(inUtero, [1])).toEqual([
      { kind: "release", id: 465796 },
    ]);
    const bare = { ...inUtero, mainRelease: undefined };
    expect(versionTargets(bare, [1])).toEqual([{ kind: "master", id: 42177 }]);
  });

  it("has nothing to read without a Discogs object", () => {
    expect(
      versionTargets({ resource_url: "https://example.com/x" }, [1]),
    ).toEqual([]);
  });
});

describe("migrateReleases", () => {
  // As stored before this change: keyed by id, raw item spread in.
  const legacy = {
    51539: { ...master, contributorIds: [1, 1] },
    22460452: { ...mainVersion, contributorIds: [2] },
    700: {
      id: 700,
      title: "Untyped",
      artist: "A",
      year: "1999",
      thumb: "",
      resource_url: "https://api.discogs.com/masters/700",
      contributorIds: [4],
    },
  };

  it("keys by type, reads the type from the URL, and folds", () => {
    const migrated = migrateReleases(legacy);
    expect(Object.keys(migrated).sort()).toEqual([
      "master:51539",
      "master:700",
    ]);
    expect(migrated["master:51539"]).toMatchObject({
      type: "master",
      mainRelease: 22460452,
      contributorIds: [1, 2],
    });
    expect(migrated["master:700"].type).toBe("master");
  });

  it("leaves migrated releases as they are", () => {
    const current = migrateReleases(legacy);
    expect(migrateReleases(current)).toBe(current);
  });

  it("migrates a whole search, unchanged when already current", () => {
    const search = {
      searchId: "s",
      releases: legacy,
    } as unknown as SearchCache;
    const migrated = migrateSearch(search);
    expect(Object.keys(migrated.releases)).toHaveLength(2);
    expect(migrateSearch(migrated)).toBe(migrated);
  });
});

describe("discographyPagesToRead", () => {
  it("reads every page up to the cap", () => {
    // Jim Keltner at 500 per page: 1,445 items, 3 pages.
    expect(discographyPagesToRead({ pages: 3 })).toBe(3);
    expect(discographyPagesToRead({ pages: 1 })).toBe(1);
    expect(discographyPagesToRead({ pages: 9 }, 4)).toBe(4);
  });

  it("reads the one page it has when pagination is missing or odd", () => {
    expect(discographyPagesToRead(undefined)).toBe(1);
    expect(discographyPagesToRead({ pages: 0 })).toBe(1);
    expect(discographyPagesToRead({})).toBe(1);
  });
});
