import { SearchCache } from "@/contexts/cache/types";
import {
  activeCredits,
  albumKeyOf,
  availableAlbums,
  availablePeople,
  availableRoles,
  countedPeople,
  Credit,
  CreditFilters,
  creditsOf,
} from "./credits";

const search = {
  searchId: "s-1",
  target: { type: "master", id: 1, key: "master:1" },
  contributors: {
    1: { id: 1, name: "Steve Albini", roles: ["Engineer", "Guitar"] },
    2: { id: 2, name: "Krist Novoselic", roles: ["Bass", "Bass"] },
  },
} as unknown as SearchCache;

const filters = (over: Partial<CreditFilters> = {}): CreditFilters => ({
  contributors: {},
  roles: {},
  ...over,
});

const people = (credits: Credit[]) =>
  Array.from(new Set(credits.map((c) => c.person))).sort();

describe("creditsOf", () => {
  it("gives one credit per person and role, on the searched album", () => {
    expect(creditsOf(search)).toEqual([
      { person: 1, role: "Engineer", album: "master:1" },
      { person: 1, role: "Guitar", album: "master:1" },
      { person: 2, role: "Bass", album: "master:1" },
    ]);
  });

  it("names the album by its search when it has no target", () => {
    const untargeted = { ...search, target: undefined };
    expect(albumKeyOf(untargeted)).toBe("s-1");
    expect(creditsOf(untargeted)[0].album).toBe("s-1");
  });
});

describe("activeCredits", () => {
  const credits = creditsOf(search);

  it("keeps everything on with nothing excluded", () => {
    expect(activeCredits(credits, filters())).toHaveLength(3);
  });

  it("keeps a person with two roles when one role is excluded", () => {
    const on = activeCredits(credits, filters({ roles: { Engineer: false } }));
    expect(on).toEqual([
      { person: 1, role: "Guitar", album: "master:1" },
      {
        person: 2,
        role: "Bass",
        album: "master:1",
      },
    ]);
    expect(people(on)).toEqual([1, 2]);
  });

  it("drops a person excluded, or whose album is excluded", () => {
    expect(
      people(activeCredits(credits, filters({ contributors: { 1: false } }))),
    ).toEqual([2]);
    expect(
      activeCredits(credits, filters({ albums: { "master:1": false } })),
    ).toEqual([]);
  });

  it("treats only an explicit false as excluded", () => {
    expect(
      activeCredits(
        credits,
        filters({ contributors: { 1: true }, roles: { Bass: true } }),
      ),
    ).toHaveLength(3);
  });
});

describe("countedPeople", () => {
  const credits = creditsOf(search);

  it("counts a required person whatever their roles", () => {
    const all = { Engineer: false, Guitar: false, Bass: false };
    expect(countedPeople(credits, filters({ roles: all }))).toEqual(new Set());
    expect(
      countedPeople(
        credits,
        filters({ roles: all, required: { contributors: [1], roles: [] } }),
      ),
    ).toEqual(new Set([1]));
  });

  it("doesn't count a required person who is switched off", () => {
    expect(
      countedPeople(
        credits,
        filters({
          contributors: { 1: false },
          required: { contributors: [1], roles: [] },
        }),
      ),
    ).toEqual(new Set([2]));
  });
});

describe("availability", () => {
  const credits = creditsOf(search);

  it("says whether switching something on would count, ignoring its own switch", () => {
    // Albini switched off still has a role on: available.
    expect(
      availablePeople(credits, filters({ contributors: { 1: false } })),
    ).toEqual(new Set([1, 2]));
    // Both his roles off: unavailable, unless required.
    const off = { Engineer: false, Guitar: false };
    expect(availablePeople(credits, filters({ roles: off }))).toEqual(
      new Set([2]),
    );
    expect(
      availablePeople(
        credits,
        filters({ roles: off, required: { contributors: [1], roles: [] } }),
      ),
    ).toEqual(new Set([1, 2]));
    // A role is available while someone credited with it is on.
    expect(
      availableRoles(
        credits,
        filters({ roles: off, contributors: { 2: false } }),
      ),
    ).toEqual(new Set(["Engineer", "Guitar"]));
    expect(
      availableAlbums(credits, filters({ albums: { "master:1": false } })),
    ).toEqual(new Set(["master:1"]));
  });

  it("makes people and roles only credited on an excluded album unavailable", () => {
    const two: Credit[] = [
      ...credits,
      { person: 3, role: "Drums", album: "master:2" },
    ];
    const f = filters({ albums: { "master:2": false } });
    expect(availablePeople(two, f).has(3)).toBe(false);
    expect(availableRoles(two, f).has("Drums")).toBe(false);
    expect(availablePeople(two, f).has(1)).toBe(true);
  });
});
