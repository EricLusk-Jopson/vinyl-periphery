import {
  activeFilterCount,
  contributorChips,
  matchesName,
  meetsRequired,
  mustIncludeOptions,
  reconcileRequired,
  requireContributor,
  requiredChips,
  requireRole,
  roleChips,
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
    expect(activeFilterCount(search)).toBe(4);
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
      roleGroups(makeSearch()).map((g) => [g.label, g.roles.map((r) => r.role)]),
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

describe("requireContributor", () => {
  it("adds them once and switches them on", () => {
    const search = makeSearch();
    search.filterState.contributors[1] = false;
    const updates = requireContributor(search, 1);
    expect(updates.required).toEqual({ contributors: [1], roles: [] });
    expect(updates.contributors?.[1]).toBe(true);
    // Engineer is still on, so roles are left alone.
    expect(updates.roles).toBeUndefined();
    search.filterState = { ...search.filterState, ...updates };
    expect(requireContributor(search, 1).required?.contributors).toEqual([1]);
  });

  it("switches their roles on when every one is off", () => {
    const search = makeSearch();
    search.filterState.roles.Design = false;
    search.filterState.roles.Photography = false;
    const updates = requireContributor(search, 2);
    expect(updates.roles).toMatchObject({ Design: true, Photography: true });
  });
});

describe("requireRole", () => {
  it("switches the role on, and its people when all are off", () => {
    const search = makeSearch();
    search.filterState.roles.Vocals = false;
    search.filterState.contributors[3] = false;
    const updates = requireRole(search, "Vocals");
    expect(updates.required).toEqual({ contributors: [], roles: ["Vocals"] });
    expect(updates.roles?.Vocals).toBe(true);
    expect(updates.contributors?.[3]).toBe(true);
  });

  it("leaves contributors alone when someone with the role is on", () => {
    expect(requireRole(makeSearch(), "Engineer").contributors).toBeUndefined();
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

describe("reconcileRequired", () => {
  it("drops entries that were switched off", () => {
    const { filterState } = makeSearch();
    filterState.required = { contributors: [1, 2], roles: ["Vocals", "Design"] };
    filterState.contributors[1] = false;
    filterState.roles.Design = false;
    expect(reconcileRequired(filterState).required).toEqual({
      contributors: [2],
      roles: ["Vocals"],
    });
  });

  it("returns the same object when nothing changes", () => {
    const { filterState } = makeSearch();
    expect(reconcileRequired(filterState)).toBe(filterState);
    filterState.required = { contributors: [1], roles: ["Vocals"] };
    expect(reconcileRequired(filterState)).toBe(filterState);
  });
});

describe("requiredChips", () => {
  it("lists required contributors then roles, with availability", () => {
    const search = makeSearch();
    search.filterState.required = { contributors: [2], roles: ["Vocals"] };
    search.filterState.roles.Design = false;
    search.filterState.roles.Photography = false;
    search.filterState.contributors[3] = false;
    expect(requiredChips(search)).toEqual([
      {
        kind: "contributor",
        id: 2,
        label: "Storm Thorgerson",
        detail: "Design, Photography",
        available: false,
      },
      {
        kind: "role",
        role: "Vocals",
        label: "Vocals",
        detail: "Musicians",
        available: false,
      },
    ]);
  });
});

describe("mustIncludeOptions", () => {
  it("is empty without a query", () => {
    expect(mustIncludeOptions(makeSearch(), "  ")).toEqual([]);
  });

  it("matches contributors then roles, leaving out required ones", () => {
    const search = makeSearch();
    expect(
      mustIncludeOptions(search, "o").map((o) => o.label),
    ).toEqual([
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
