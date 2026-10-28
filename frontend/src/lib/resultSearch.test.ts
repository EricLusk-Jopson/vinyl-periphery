import { SearchCache } from "@/contexts/cache/types";
import { filtersToShow, pinToTop, searchResults } from "./resultSearch";

const person = (id: number, name: string, roles: string[]) => ({
  id,
  name,
  roles,
  sources: ["credits" as const],
  resourceUrl: "",
});

const release = (
  id: number,
  title: string,
  artist: string,
  contributorIds: number[],
) => ({
  id,
  type: "release" as const,
  key: `release:${id}`,
  title,
  year: "1979",
  artist,
  thumb: "",
  resource_url: "",
  contributorIds,
});

const makeSearch = (): SearchCache => ({
  searchId: "s-1",
  searchParams: { artist: "Pink Floyd", album: "The Wall" },
  contributors: {
    1: person(1, "Alan Parsons", ["Engineer"]),
    2: person(2, "Storm Thorgerson", ["Design", "Photography"]),
    3: person(3, "Clare Torry", ["Vocals"]),
  },
  roles: { Engineer: true, Design: true, Photography: true, Vocals: true },
  releases: {
    "release:10": release(10, "Eve", "APP", [1, 3, 1]),
    "release:11": release(
      11,
      "Even in the Quietest Moments",
      "Supertramp",
      [2],
    ),
    "release:12": release(12, "Animals", "Pink Floyd", [2]),
    "release:13": release(13, "Steve's Album", "Steve", [1]),
  },
  filterState: {
    contributors: { 1: true, 2: true, 3: false },
    roles: { Engineer: false, Design: true, Photography: true, Vocals: true },
    excludeMainArtist: true,
    collaborationsOnly: true,
    excludeVarious: false,
    required: { contributors: [2], roles: [] },
  },
  thumb: "",
});

describe("searchResults", () => {
  it("finds titles and artists whatever the filters, title starts first", () => {
    const found = searchResults(makeSearch(), "eve", new Set(["release:11"]));
    expect(found.map((m) => [m.title, m.visible])).toEqual([
      ["Eve", false],
      ["Even in the Quietest Moments", true],
      ["Steve's Album", false],
    ]);
  });

  it("says how many people link each one, by role category", () => {
    const [eve] = searchResults(makeSearch(), "Eve", new Set());
    expect(eve).toMatchObject({
      contributors: 2,
      summary: "via Musicians (1) · Audio (1)",
      year: 1979,
    });
  });

  it("matches nothing for an empty query", () => {
    expect(searchResults(makeSearch(), "  ", new Set())).toEqual([]);
  });
});

describe("filtersToShow", () => {
  it("switches on exactly the album's people and their roles", () => {
    expect(filtersToShow(makeSearch(), "release:10")).toEqual({
      contributors: { 1: true, 2: false, 3: true },
      roles: {
        Engineer: true,
        Design: false,
        Photography: false,
        Vocals: true,
      },
      excludeMainArtist: true,
      collaborationsOnly: false,
      excludeVarious: false,
      required: { contributors: [], roles: [] },
    });
  });

  it("turns off hiding the searched artist for their own album", () => {
    expect(filtersToShow(makeSearch(), "release:12")?.excludeMainArtist).toBe(
      false,
    );
  });

  it("is null for an unknown result", () => {
    expect(filtersToShow(makeSearch(), "release:99")).toBeNull();
  });
});

describe("pinToTop", () => {
  const list = [{ key: "a" }, { key: "b" }, { key: "c" }];
  it("moves the pinned result first and keeps the rest in order", () => {
    expect(pinToTop(list, "c").map((r) => r.key)).toEqual(["c", "a", "b"]);
  });
  it("leaves the list alone without a pin, or when it isn't there", () => {
    expect(pinToTop(list, null)).toBe(list);
    expect(pinToTop(list, "z")).toBe(list);
  });
});
