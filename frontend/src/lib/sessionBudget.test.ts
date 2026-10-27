import { CacheState, SearchCache } from "@/contexts/cache/types";
import {
  DEFAULT_SEARCH_CHARS,
  estimateNextSearch,
  hasRoomForSearch,
  SESSION_BUDGET_CHARS,
  searchChars,
  sessionSnapshot,
  writeSession,
} from "./sessionBudget";

const search = (searchId: string, padding = 0) =>
  ({
    searchId,
    searchParams: { artist: "a", album: "b" },
    thumb: "x".repeat(padding),
  }) as unknown as SearchCache;

describe("sessionSnapshot", () => {
  it("keeps unsaved searches only", () => {
    const state: CacheState = {
      searches: { s1: search("s1"), s2: search("s2") },
      activeSearchId: "s2",
      savedSearchIds: new Set(["s2"]),
    };
    expect(sessionSnapshot(state)).toEqual({
      searches: { s1: search("s1") },
      activeSearchId: "s2",
      savedSearchIds: ["s2"],
    });
  });
});

describe("estimateNextSearch", () => {
  it("defaults before anything is measured", () => {
    expect(estimateNextSearch([])).toBe(DEFAULT_SEARCH_CHARS);
  });

  it("averages the most recent searches", () => {
    const old = search("a-b-1", 10_000);
    const recent = [search("a-b-5", 100), search("a-b-4", 300)];
    const expected = Math.round(
      (searchChars(recent[0]) + searchChars(recent[1])) / 2,
    );
    expect(estimateNextSearch([old, ...recent], 2)).toBe(expected);
  });
});

describe("hasRoomForSearch", () => {
  it("compares the session plus the next search with the budget", () => {
    expect(hasRoomForSearch(4_000_000, 400_000)).toBe(true);
    expect(hasRoomForSearch(4_200_000, 400_000)).toBe(false);
    expect(hasRoomForSearch(SESSION_BUDGET_CHARS, 0)).toBe(true);
  });
});

describe("writeSession", () => {
  it("stores and reports the length", () => {
    const store: Record<string, string> = {};
    const result = writeSession({ setItem: (k, v) => (store[k] = v) }, "key", {
      a: 1,
    });
    expect(result).toEqual({ chars: 7, stored: true });
    expect(store.key).toBe('{"a":1}');
  });

  it("survives the browser refusing (quota exceeded)", () => {
    const full = {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    expect(writeSession(full, "key", { a: 1 })).toEqual({
      chars: 7,
      stored: false,
    });
  });
});
