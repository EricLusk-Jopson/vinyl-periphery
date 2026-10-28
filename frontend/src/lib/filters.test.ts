import {
  activeFilterCount,
  contributorChips,
  matchesName,
  meetsRequired,
  mustIncludeOptions,
  enforceRequired,
  isContributorCounted,
  requireContributor,
  requiredChips,
  requireRole,
  roleChips,
  rolePeople,
  roleGroups,
  setIncluded,
  unrequire,
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
    "release:10": {
      id: 10,
      type: "release",
      key: "release:10",
      title: "Eve",
      year: "1979",
      artist: "APP",
      thumb: "",
      resource_url: "",
      contributorIds: [1, 3, 1],
    },
    "release:11": {
      id: 11,
      type: "release",
      key: "release:11",
      title: "Year of the Cat",
      year: "1976",
      artist: "Al Stewart",
      thumb: "",
      resource_url: "",
      contributorIds: [1],
    },
    "release:12": {
      id: 12,
      type: "release",
      key: "release:12",
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
    search.filterState.required = { contributors: [], roles: [] };
    expect(roleChips(search)).toEqual([
      {
        role: "Design",
        included: true,
        available: true,
        required: false,
        people: [{ id: 2, name: "Storm Thorgerson", included: true }],
      },
      {
        role: "Engineer",
        included: false,
        available: true,
        required: false,
        people: [{ id: 1, name: "Alan Parsons", included: true }],
      },
      {
        role: "Photography",
        included: true,
        available: true,
        required: false,
        people: [{ id: 2, name: "Storm Thorgerson", included: true }],
      },
      {
        role: "Vocals",
        included: true,
        available: false,
        required: false,
        people: [{ id: 3, name: "Clare Torry", included: false }],
      },
    ]);
  });

  it("lists everyone with a role, by name", () => {
    const search = makeSearch();
    search.contributors[1].roles.push("Vocals");
    expect(rolePeople(search, "Vocals").map((p) => p.name)).toEqual([
      "Alan Parsons",
      "Clare Torry",
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

  it("counts each required contributor and role", () => {
    const search = makeSearch();
    search.filterState.required = { contributors: [1], roles: ["Vocals"] };
    expect(activeFilterCount(search)).toBe(2);
  });

  it("counts each change from the reset state", () => {
    const search = makeSearch();
    search.filterState.contributors[2] = false;
    search.filterState.roles.Vocals = false;
    search.filterState.collaborationsOnly = true;
    search.filterState.excludeMainArtist = false;
    search.filterState.likedOnly = true;
    expect(activeFilterCount(search)).toBe(5);
  });
});

describe("setIncluded", () => {
  it("switches only the given keys and leaves the input alone", () => {
    const states = { 1: true, 2: true, 3: false };
    expect(setIncluded(states, [1, 3], false)).toEqual({
      1: false,
      2: true,
      3: false,
    });
    expect(setIncluded(states, [3], true)).toEqual({
      1: true,
      2: true,
      3: true,
    });
    expect(states).toEqual({ 1: true, 2: true, 3: false });
  });
});

describe("roleGroups", () => {
  it("groups role chips by category in display order", () => {
    expect(
      roleGroups(makeSearch()).map((g) => [
        g.label,
        g.roles.map((r) => r.role),
      ]),
    ).toEqual([
      ["Musicians", ["Vocals"]],
      ["Audio", ["Engineer"]],
      ["Physical media", ["Design", "Photography"]],
    ]);
  });
});

describe("meetsRequired", () => {
  it("passes everything when nothing is required, including old saves", () => {
    const search = makeSearch();
    expect(meetsRequired([1], search)).toBe(true);
    search.filterState.required = { contributors: [], roles: [] };
    expect(meetsRequired([1], search)).toBe(true);
  });

  it("needs every required contributor among the active ones", () => {
    const search = makeSearch();
    search.filterState.required = { contributors: [1, 3], roles: [] };
    expect(meetsRequired([1, 3], search)).toBe(true);
    expect(meetsRequired([1], search)).toBe(false);
  });

  it("needs an active contributor with each required role", () => {
    const search = makeSearch();
    search.filterState.required = { contributors: [], roles: ["Photography"] };
    expect(meetsRequired([2], search)).toBe(true);
    expect(meetsRequired([1, 3], search)).toBe(false);
    search.filterState.required.roles.push("Vocals");
    expect(meetsRequired([2], search)).toBe(false);
    expect(meetsRequired([2, 3], search)).toBe(true);
  });
});

describe("isContributorCounted", () => {
  it("needs them on and one of their roles on", () => {
    const search = makeSearch();
    expect(isContributorCounted(search, 3)).toBe(true);
    search.filterState.roles.Vocals = false;
    expect(isContributorCounted(search, 3)).toBe(false);
  });

  it("counts a required contributor whatever their roles", () => {
    const search = makeSearch();
    search.filterState.roles.Vocals = false;
    search.filterState.required = { contributors: [3], roles: [] };
    expect(isContributorCounted(search, 3)).toBe(true);
    expect(contributorChips(search).find((c) => c.id === 3)).toMatchObject({
      available: true,
      required: true,
    });
    search.filterState.contributors[3] = false;
    expect(isContributorCounted(search, 3)).toBe(false);
  });
});

describe("requireContributor and requireRole", () => {
  it("add each once", () => {
    const search = makeSearch();
    search.filterState = {
      ...search.filterState,
      ...requireContributor(search, 1),
    };
    search.filterState = {
      ...search.filterState,
      ...requireRole(search, "Vocals"),
    };
    expect(requireContributor(search, 1).required).toEqual({
      contributors: [1],
      roles: ["Vocals"],
    });
    expect(requireRole(search, "Vocals").required).toEqual({
      contributors: [1],
      roles: ["Vocals"],
    });
  });
});

describe("unrequire", () => {
  it("removes one contributor or role", () => {
    const search = makeSearch();
    search.filterState.required = { contributors: [1, 2], roles: ["Vocals"] };
    expect(unrequire(search, { contributor: 1 }).required).toEqual({
      contributors: [2],
      roles: ["Vocals"],
    });
    expect(unrequire(search, { role: "Vocals" }).required).toEqual({
      contributors: [1, 2],
      roles: [],
    });
  });
});

describe("enforceRequired", () => {
  it("keeps required contributors and roles on through deselect all", () => {
    const search = makeSearch();
    const filterState = {
      ...search.filterState,
      required: { contributors: [2], roles: ["Engineer"] },
      contributors: { 1: false, 2: false, 3: false },
      roles: {
        Engineer: false,
        Design: false,
        Photography: false,
        Vocals: false,
      },
    };
    const enforced = enforceRequired(search, filterState);
    // 2 is required; 1 is switched back on as the only Engineer.
    expect(enforced.contributors).toEqual({ 1: true, 2: true, 3: false });
    expect(enforced.roles).toEqual({
      Engineer: true,
      Design: false,
      Photography: false,
      Vocals: false,
    });
  });

  it("leaves a required role's people alone while one of them is on", () => {
    const search = makeSearch();
    search.contributors[3].roles.push("Engineer");
    const filterState = {
      ...search.filterState,
      required: { contributors: [], roles: ["Engineer"] },
      contributors: { 1: false, 2: true, 3: true },
    };
    expect(enforceRequired(search, filterState).contributors[1]).toBe(false);
  });

  it("returns the same object when nothing changes", () => {
    const search = makeSearch();
    expect(enforceRequired(search, search.filterState)).toBe(
      search.filterState,
    );
    const filterState = {
      ...search.filterState,
      required: { contributors: [1], roles: ["Vocals"] },
    };
    expect(enforceRequired(search, filterState)).toBe(filterState);
  });
});

describe("requiredChips", () => {
  it("lists required contributors then roles", () => {
    const search = makeSearch();
    search.filterState.required = { contributors: [2], roles: ["Vocals"] };
    expect(requiredChips(search)).toEqual([
      {
        kind: "contributor",
        id: 2,
        label: "Storm Thorgerson",
        detail: "Design, Photography",
      },
      { kind: "role", role: "Vocals", label: "Vocals", detail: "Musicians" },
    ]);
  });
});

describe("mustIncludeOptions", () => {
  it("is empty without a query", () => {
    expect(mustIncludeOptions(makeSearch(), "  ")).toEqual([]);
  });

  it("matches contributors then roles, leaving out required ones", () => {
    const search = makeSearch();
    expect(mustIncludeOptions(search, "o").map((o) => o.label)).toEqual([
      "Alan Parsons",
      "Clare Torry",
      "Storm Thorgerson",
      "Photography",
      "Vocals",
    ]);
    search.filterState.required = { contributors: [1], roles: ["Vocals"] };
    expect(mustIncludeOptions(search, "o", 3).map((o) => o.label)).toEqual([
      "Clare Torry",
      "Storm Thorgerson",
      "Photography",
    ]);
  });
});
