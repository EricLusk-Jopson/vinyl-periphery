import { SearchCache } from "@/contexts/cache/types";
import {
  detachedLineage,
  childLineage,
  lineageForNewSearch,
  lineageOf,
  rootLineage,
} from "./lineage";

const search = (
  searchId: string,
  album: string,
  extra: Partial<SearchCache> = {},
) =>
  ({
    searchId,
    searchParams: { artist: `${album} artist`, album },
    target: { type: "master", id: 1, key: `master:${album.length}` },
    thumb: "",
    ...extra,
  }) as SearchCache;

describe("rootLineage and lineageOf", () => {
  it("makes roots, and treats searches without lineage as roots", () => {
    expect(rootLineage("r")).toEqual({
      stackId: "r",
      depth: 0,
      path: [],
      via: [],
    });
    expect(lineageOf(search("old", "Old"))).toEqual(rootLineage("old"));
  });
});

describe("childLineage", () => {
  const root = search("root", "Unmap", { lineage: rootLineage("root") });

  it("continues the parent's trail with a snapshot of the parent", () => {
    const child = childLineage(root, [1, 2], "https://art/root.jpg");
    expect(child).toEqual({
      stackId: "root",
      depth: 1,
      path: [
        {
          searchId: "root",
          targetKey: "master:5",
          title: "Unmap",
          artist: "Unmap artist",
          thumb: "https://art/root.jpg",
          via: [],
        },
      ],
      via: [1, 2],
    });
  });

  it("carries each step's via, so the trail can draw every link", () => {
    const child = search("child", "Bon Iver", {
      lineage: childLineage(root, [1, 2], ""),
    });
    const grandchild = childLineage(child, [3], "");
    expect(grandchild.stackId).toBe("root");
    expect(grandchild.depth).toBe(2);
    expect(grandchild.path.map((s) => [s.searchId, s.via])).toEqual([
      ["root", []],
      ["child", [1, 2]],
    ]);
    expect(grandchild.via).toEqual([3]);
  });

  it("keeps the trail when an ancestor is gone", () => {
    // Snapshots, not references: the path doesn't depend on the parent's
    // own parent still existing.
    const orphan = search("child", "Bon Iver", {
      lineage: {
        stackId: "deleted-root",
        depth: 1,
        path: [
          {
            searchId: "deleted-root",
            targetKey: "master:9",
            title: "Gone",
            artist: "A",
            thumb: "",
            via: [],
          },
        ],
        via: [4],
      },
    });
    expect(childLineage(orphan, [5], "").stackId).toBe("deleted-root");
  });
});

describe("lineageForNewSearch", () => {
  const parent = search("p", "Unmap", { lineage: rootLineage("p") });
  const origin = { parentSearchId: "p", via: [7] };

  it("roots searches from the search bar or a link", () => {
    expect(lineageForNewSearch({ searchId: "n", replaced: [] })).toEqual(
      rootLineage("n"),
    );
  });

  it("makes a child for a search from a result row", () => {
    expect(
      lineageForNewSearch({ searchId: "n", replaced: [], parent, origin })
        .depth,
    ).toBe(1);
  });

  it("roots a row search whose parent is gone", () => {
    expect(
      lineageForNewSearch({ searchId: "n", replaced: [], origin }),
    ).toEqual(rootLineage("n"));
  });

  it("keeps the lineage of the search a repeat run replaces", () => {
    const earlier = search("e", "Bon Iver", {
      lineage: childLineage(parent, [7], ""),
    });
    expect(lineageForNewSearch({ searchId: "n", replaced: [earlier] })).toBe(
      earlier.lineage,
    );
    // Even when the repeat comes from somewhere else.
    expect(
      lineageForNewSearch({
        searchId: "n",
        replaced: [earlier],
        parent: search("x", "X", { lineage: rootLineage("x") }),
        origin: { parentSearchId: "x", via: [1] },
      }),
    ).toBe(earlier.lineage);
  });
});

describe("detachedLineage", () => {
  it("is a root with a stack id of its own, even for a stack's root", () => {
    const lineage = detachedLineage("A-Unmap-1700000000001", 42);
    expect(lineage).toEqual({
      stackId: "A-Unmap-1700000000001~42",
      depth: 0,
      path: [],
      via: [],
    });
  });
});
