import {
  ScoredRelease,
  discogsWebUrl,
  releaseYear,
  appearanceText,
  contributionsText,
  creditAcrossVersions,
  creditsErrorMessage,
  resetFilterState,
  sharedPeople,
  sortReleases,
  popularity,
  compactCount,
  hasPopularity,
  tiebreakOptions,
} from "./results";
import { SearchCache } from "@/contexts/cache/types";

const release = (
  id: number,
  artist: string,
  year: string,
  activeContributors: number[] = [],
): ScoredRelease => ({
  id,
  type: "release",
  key: `release:${id}`,
  title: `Title ${id}`,
  artist,
  year,
  thumb: "",
  resource_url: `https://api.discogs.com/releases/${id}`,
  contributorIds: activeContributors,
  activeContributors,
  score: 0,
  confidence: 0,
});

describe("releaseYear", () => {
  it("reads numbers and numeric strings", () => {
    expect(releaseYear("1973")).toBe(1973);
    expect(releaseYear(1979)).toBe(1979);
  });

  it("treats 0, empty and junk as unknown", () => {
    expect(releaseYear("0")).toBeNull();
    expect(releaseYear("")).toBeNull();
    expect(releaseYear(undefined)).toBeNull();
    expect(releaseYear("n/a")).toBeNull();
  });
});

describe("sortReleases", () => {
  const list = [
    release(1, "Roxy Music", "1973"),
    release(2, "al stewart", "1976"),
    release(3, "Sex Pistols", "0"),
    release(4, "Pretenders", "1980"),
  ];
  const ids = (r: ScoredRelease[]) => r.map((x) => x.id);

  it("keeps the ranking for most shared", () => {
    expect(ids(sortReleases(list, "shared"))).toEqual([1, 2, 3, 4]);
  });

  it("sorts by year with unknown years last", () => {
    expect(ids(sortReleases(list, "newest"))).toEqual([4, 2, 1, 3]);
    expect(ids(sortReleases(list, "oldest"))).toEqual([1, 2, 4, 3]);
  });

  it("sorts by artist ignoring case", () => {
    expect(ids(sortReleases(list, "artist"))).toEqual([2, 4, 1, 3]);
    expect(ids(sortReleases(list, "artistDesc"))).toEqual([3, 1, 4, 2]);
  });

  it("does not change the input", () => {
    sortReleases(list, "newest");
    expect(ids(list)).toEqual([1, 2, 3, 4]);
  });
});

describe("tiebreaker", () => {
  const ids = (r: ScoredRelease[]) => r.map((x) => x.id);
  // Ranked 1-4; 1 and 3 share two people, 2 and 4 share one.
  const ranked = [
    release(1, "Roxy Music", "1973", [7, 8]),
    release(2, "Wire", "1977", [7]),
    release(3, "Eno", "1975", [7, 8]),
    release(4, "Can", "1971", [8]),
  ];

  it("orders albums sharing as many people by the tiebreaker", () => {
    expect(ids(sortReleases(ranked, "shared", "newest"))).toEqual([3, 1, 2, 4]);
    expect(ids(sortReleases(ranked, "shared", "artist"))).toEqual([3, 1, 4, 2]);
  });

  it("breaks ties in other sorts too, ranking last", () => {
    const sameYear = [
      release(1, "B", "1980", [7]),
      release(2, "A", "1980", [7, 8]),
      release(3, "C", "1990", [7]),
    ];
    expect(ids(sortReleases(sameYear, "newest", "shared"))).toEqual([3, 2, 1]);
    expect(ids(sortReleases(sameYear, "newest"))).toEqual([3, 1, 2]);
  });

  it("offers every other sort, but not the other direction of the same", () => {
    expect(tiebreakOptions("newest").map((o) => o.value)).toEqual([
      "shared",
      "popular",
      "artist",
      "artistDesc",
    ]);
    expect(tiebreakOptions("artist").map((o) => o.value)).toEqual([
      "shared",
      "popular",
      "newest",
      "oldest",
    ]);
    expect(tiebreakOptions("shared").map((o) => o.value)).toEqual([
      "popular",
      "newest",
      "oldest",
      "artist",
      "artistDesc",
    ]);
  });
});

describe("popular sort", () => {
  const withCounts = (id: number, want?: number, have?: number) => ({
    ...release(id, "A", "2000"),
    ...(want === undefined ? {} : { community: { want, have: have ?? 0 } }),
  });

  it("puts the most wanted and owned first, albums without counts last", () => {
    const sorted = sortReleases(
      [
        withCounts(1, 5, 5),
        withCounts(2),
        withCounts(3, 100, 900),
        withCounts(4, 0, 40),
      ],
      "popular",
    );
    expect(sorted.map((r) => r.id)).toEqual([3, 4, 1, 2]);
    expect(popularity(withCounts(3, 100, 900))).toBe(1000);
    expect(popularity(withCounts(2))).toBeNull();
  });
});

describe("discogsWebUrl", () => {
  it("maps releases and masters to their Discogs pages", () => {
    expect(discogsWebUrl("https://api.discogs.com/releases/249504")).toBe(
      "https://www.discogs.com/release/249504",
    );
    expect(discogsWebUrl("https://api.discogs.com/masters/10362")).toBe(
      "https://www.discogs.com/master/10362",
    );
  });

  it("returns null for anything else", () => {
    expect(discogsWebUrl(undefined)).toBeNull();
    expect(discogsWebUrl("")).toBeNull();
    expect(discogsWebUrl("https://api.discogs.com/artists/45")).toBeNull();
    expect(discogsWebUrl("https://evil.example/releases/1")).toBeNull();
  });
});

describe("sharedPeople", () => {
  const contributors = {
    1: {
      id: 1,
      name: "Alan Parsons",
      roles: ["Engineer"],
      sources: [],
      resourceUrl: "",
    },
    2: {
      id: 2,
      name: "Clare Torry (2)",
      roles: ["Vocals", "Lead Vocals"],
      sources: [],
      resourceUrl: "",
    },
    3: {
      id: 3,
      name: "Clare Torry",
      roles: ["Vocals"],
      sources: [],
      resourceUrl: "",
    },
  } as SearchCache["contributors"];

  it("lists names and roles, tidied, without duplicate names", () => {
    expect(
      sharedPeople(release(9, "X", "1979", [1, 2, 3, 99]), contributors),
    ).toEqual([
      { id: 1, name: "Alan Parsons", roles: "Engineer" },
      { id: 2, name: "Clare Torry", roles: "Vocals, Lead Vocals" },
    ]);
  });
});

describe("resetFilterState", () => {
  it("turns everything back on except hiding the searched artist", () => {
    const search = {
      contributors: { 1: {}, 2: {} },
      roles: { Engineer: false, Vocals: true },
    } as unknown as SearchCache;
    expect(resetFilterState(search)).toEqual({
      contributors: { 1: true, 2: true },
      roles: { Engineer: true, Vocals: true },
      excludeMainArtist: true,
      collaborationsOnly: false,
      excludeVarious: false,
      likedOnly: false,
      required: { contributors: [], roles: [] },
    });
  });
});

describe("creditAcrossVersions", () => {
  const credits = (
    releaseId: number,
    byPerson: Record<number, { role: string; tracks?: string[] }[]>,
  ) => ({ releaseId, fromMainRelease: false, credits: byPerson });
  // In Utero: Albini produced one version, remixed another.
  const produced = credits(465796, {
    1: [{ role: "Producer" }, { role: "Bass", tracks: ["A1"] }],
    2: [],
  });
  const remixed = credits(4943830, { 1: [{ role: "Remix" }] });

  it("joins roles from every version naming the person, without tracks", () => {
    expect(creditAcrossVersions([produced, remixed], true, 1)).toEqual({
      status: "found",
      roles: "Producer, Bass, Remix",
    });
    expect(
      creditAcrossVersions(
        [produced, credits(9, { 1: [{ role: "Producer" }] })],
        true,
        1,
      ),
    ).toEqual({ status: "found", roles: "Producer, Bass" });
  });

  it("shows roles as soon as one version has them", () => {
    expect(creditAcrossVersions([remixed], false, 1)).toEqual({
      status: "found",
      roles: "Remix",
    });
  });

  it("waits for every version before saying there's no role", () => {
    expect(creditAcrossVersions([produced], false, 2)).toEqual({
      status: "pending",
    });
    expect(creditAcrossVersions([produced, remixed], true, 2)).toEqual({
      status: "no-role",
    });
    expect(creditAcrossVersions([produced, remixed], true, 3)).toEqual({
      status: "not-found",
    });
  });

  it("is unavailable when no version loaded", () => {
    expect(creditAcrossVersions([], true, 1)).toEqual({
      status: "unavailable",
    });
    expect(creditAcrossVersions([], false, 1)).toEqual({ status: "pending" });
  });
});

describe("creditsErrorMessage", () => {
  it("explains rate limits, missing releases and being offline", () => {
    expect(creditsErrorMessage(429)).toMatch(/busy/);
    expect(creditsErrorMessage(404)).toMatch(/no release/);
    expect(creditsErrorMessage(0)).toMatch(/reach Discogs/);
    expect(creditsErrorMessage(500)).toBe(
      "Couldn't load this album's credits.",
    );
    expect(creditsErrorMessage(undefined)).toBe(
      "Couldn't load this album's credits.",
    );
  });
});

describe("appearanceText", () => {
  it("puts Discogs's discography roles into words", () => {
    expect(appearanceText({ role: "Main" })).toBe("Main artist");
    expect(appearanceText({ role: "Appearance" })).toBe(
      "Appears on this album",
    );
    expect(
      appearanceText({ role: "TrackAppearance", trackinfo: "Trailer Trash" }),
    ).toBe("Appears on some tracks");
  });

  it("cleans up credit roles and skips empty ones", () => {
    expect(appearanceText({ role: "Written-By" })).toBe("Written By");
    expect(appearanceText({ role: "Producer", trackinfo: "A1" })).toBe(
      "Producer",
    );
    expect(appearanceText({ role: "[ ]" })).toBeNull();
    expect(appearanceText(undefined)).toBeNull();
  });
});

describe("contributionsText", () => {
  it("lists every role once", () => {
    expect(
      contributionsText([
        { role: "Producer", release: 465796 },
        { role: "Remix", release: 4943830 },
        { role: "Producer", trackinfo: "A1", release: 1 },
      ]),
    ).toBe("Producer, Remix");
    expect(contributionsText([{ role: "Appearance" }])).toBe(
      "Appears on this album",
    );
  });

  it("is null with nothing to say", () => {
    expect(contributionsText([])).toBeNull();
    expect(contributionsText([{ role: "[ ]" }])).toBeNull();
  });
});

describe("compactCount", () => {
  it("shortens counts without rounding up", () => {
    expect(compactCount(950)).toBe("950");
    expect(compactCount(1_000)).toBe("1k");
    expect(compactCount(1_299)).toBe("1.2k");
    expect(compactCount(12_999)).toBe("12k");
    expect(compactCount(3_450_000)).toBe("3.4M");
  });
});

describe("hasPopularity", () => {
  it("is false for searches stored before counts were kept", () => {
    const none = release(1, "A", "2000");
    const counted = {
      ...release(2, "B", "2000"),
      community: { want: 0, have: 0 },
    };
    expect(hasPopularity([none, none])).toBe(false);
    expect(hasPopularity([none, counted])).toBe(true);
  });
});
