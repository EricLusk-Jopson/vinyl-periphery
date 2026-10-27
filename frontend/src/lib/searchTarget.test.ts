import { SearchCache } from "@/contexts/cache/types";
import {
  matchingSearchIds,
  searchTarget,
  targetFromKey,
  targetFromSearchResult,
} from "./searchTarget";

describe("searchTarget and targetFromKey", () => {
  it("builds and parses keys", () => {
    expect(searchTarget("master", 51539)).toEqual({
      type: "master",
      id: 51539,
      key: "master:51539",
    });
    expect(targetFromKey("release:22460452")).toEqual(
      searchTarget("release", 22460452),
    );
  });

  it("rejects anything else", () => {
    expect(targetFromKey("label:1")).toBeNull();
    expect(targetFromKey("master:0")).toBeNull();
    expect(targetFromKey("master:12a")).toBeNull();
    expect(targetFromKey(undefined)).toBeNull();
  });
});

describe("targetFromSearchResult", () => {
  it("prefers the first result's master", () => {
    expect(targetFromSearchResult({ id: 6237894, master_id: 51539 })).toEqual(
      searchTarget("master", 51539),
    );
  });

  it("falls back to the release when there's no master", () => {
    expect(targetFromSearchResult({ id: 3450086, master_id: 0 })).toEqual(
      searchTarget("release", 3450086),
    );
    expect(targetFromSearchResult({ id: 3450086 })).toEqual(
      searchTarget("release", 3450086),
    );
    expect(targetFromSearchResult(undefined)).toBeNull();
  });
});

describe("matchingSearchIds", () => {
  const search = (
    searchId: string,
    artist: string,
    album: string,
    targetKey?: string,
  ) =>
    ({
      searchId,
      searchParams: { artist, album },
      ...(targetKey ? { target: targetFromKey(targetKey) } : {}),
    }) as SearchCache;
  const searches = {
    a: search("a", "Elliott Smith", "Either / Or"),
    b: search("b", "elliott  smith ", " either / or"),
    c: search("c", "Elliott Smith", "XO"),
    // Same title, different albums: only the target tells them apart.
    d: search("d", "Bon Iver", "Bon Iver", "master:1"),
    e: search("e", "Bon Iver", "Bon Iver", "release:2"),
  };

  it("matches on the target key when both have one", () => {
    const params = { artist: "Bon Iver", album: "Bon Iver" };
    expect(
      matchingSearchIds(searches, params, searchTarget("master", 1)),
    ).toEqual(["d"]);
    expect(
      matchingSearchIds(searches, params, searchTarget("master", 9)),
    ).toEqual([]);
  });

  it("matches legacy searches on artist and album, ignoring case and spacing", () => {
    expect(
      matchingSearchIds(
        searches,
        { artist: "ELLIOTT SMITH", album: "Either / Or" },
        searchTarget("master", 5),
      ),
    ).toEqual(["a", "b"]);
  });

  it("falls back to the text when the link names no album id", () => {
    expect(
      matchingSearchIds(searches, { artist: "Bon Iver", album: "bon iver" }),
    ).toEqual(["d", "e"]);
    expect(
      matchingSearchIds(searches, {
        artist: "Elliott Smith",
        album: "Figure 8",
      }),
    ).toEqual([]);
  });
});
