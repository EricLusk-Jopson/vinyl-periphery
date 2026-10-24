import {
  ScoredRelease,
  discogsWebUrl,
  releaseYear,
  resetFilterState,
  sharedPeople,
  sortReleases,
} from "./results";
import { SearchCache } from "@/contexts/cache/types";

const release = (
  id: number,
  artist: string,
  year: string,
  activeContributors: number[] = [],
): ScoredRelease => ({
  id,
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
  });

  it("does not change the input", () => {
    sortReleases(list, "newest");
    expect(ids(list)).toEqual([1, 2, 3, 4]);
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
    });
  });
});
