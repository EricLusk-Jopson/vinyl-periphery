import {
  activeFilterCount,
  contributorChips,
  matchesName,
  roleChips,
} from "./filters";
import { SearchCache } from "@/contexts/cache/types";

const makeSearch = (): SearchCache => ({
  searchId: "s-1",
  searchParams: { artist: "Pink Floyd", album: "The Dark Side of the Moon" },
  contributors: {
    1: {
      id: 1,
      name: "Alan Parsons",
      roles: ["Engineer"],
      sources: ["credits"],
      resourceUrl: "",
    },
    2: {
      id: 2,
      name: "Storm Thorgerson (2)",
      roles: ["Design", "Photography"],
      sources: ["credits"],
      resourceUrl: "",
    },
    3: {
      id: 3,
      name: "Clare Torry",
      roles: ["Vocals"],
      sources: ["credits"],
      resourceUrl: "",
    },
  },
  roles: { Engineer: true, Design: true, Photography: true, Vocals: true },
  releases: {
    10: {
      id: 10,
      title: "Eve",
      year: "1979",
      artist: "APP",
      thumb: "",
      resource_url: "",
      contributorIds: [1, 3, 1],
    },
    11: {
      id: 11,
      title: "Year of the Cat",
      year: "1976",
      artist: "Al Stewart",
      thumb: "",
      resource_url: "",
      contributorIds: [1],
    },
    12: {
      id: 12,
      title: "Houses of the Holy",
      year: "1973",
      artist: "Led Zeppelin",
      thumb: "",
      resource_url: "",
      contributorIds: [2],
    },
  },
  filterState: {
    contributors: { 1: true, 2: true, 3: true },
    roles: { Engineer: true, Design: true, Photography: true, Vocals: true },
    excludeMainArtist: true,
    collaborationsOnly: false,
    excludeVarious: false,
  },
  thumb: "",
});

describe("contributorChips", () => {
  it("counts albums once each and sorts by count, then name", () => {
    const chips = contributorChips(makeSearch());
    expect(chips.map((c) => [c.name, c.count])).toEqual([
      ["Alan Parsons", 2],
      ["Clare Torry", 1],
      ["Storm Thorgerson", 1],
    ]);
  });

  it("marks excluded and unavailable contributors", () => {
    const search = makeSearch();
    search.filterState.contributors[1] = false;
    search.filterState.roles.Vocals = false;
    const byName = Object.fromEntries(
      contributorChips(search).map((c) => [c.name, c]),
    );
    expect(byName["Alan Parsons"]).toMatchObject({
      included: false,
      available: true,
    });
    expect(byName["Clare Torry"]).toMatchObject({
      included: true,
      available: false,
    });
    // Still available through Photography with Design off.
    search.filterState.roles.Design = false;
    expect(contributorChips(search).find((c) => c.id === 2)?.available).toBe(
      true,
    );
  });
});

describe("roleChips", () => {
  it("lists roles alphabetically with their state", () => {
    const search = makeSearch();
    search.filterState.roles.Engineer = false;
    search.filterState.contributors[3] = false;
    expect(roleChips(search)).toEqual([
      { role: "Design", included: true, available: true },
      { role: "Engineer", included: false, available: true },
      { role: "Photography", included: true, available: true },
      { role: "Vocals", included: true, available: false },
    ]);
  });
});

describe("matchesName", () => {
  it("ignores case, accents and surrounding space", () => {
    expect(matchesName("Björk", "bjork")).toBe(true);
    expect(matchesName("Alan Parsons", " PARS ")).toBe(true);
    expect(matchesName("Alan Parsons", "")).toBe(true);
    expect(matchesName("Alan Parsons", "torry")).toBe(false);
  });
});

describe("activeFilterCount", () => {
  it("is 0 at the reset state", () => {
    expect(activeFilterCount(makeSearch())).toBe(0);
  });

  it("counts each change from the reset state", () => {
    const search = makeSearch();
    search.filterState.contributors[2] = false;
    search.filterState.roles.Vocals = false;
    search.filterState.collaborationsOnly = true;
    search.filterState.excludeMainArtist = false;
    expect(activeFilterCount(search)).toBe(4);
  });
});
