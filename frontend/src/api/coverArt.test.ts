import { createCoverResolver } from "./coverArt";
import { CoverMatch } from "./musicbrainz";
import { CoverEntry, MISS_RECHECK_MS } from "@/services/coverCache";

const NOW = 1_800_000_000_000;

const setup = (
  stored: CoverEntry[] = [],
  found: Record<string, CoverMatch> = {},
) => {
  const store = new Map(stored.map((e) => [e.key, e]));
  const lookups: string[][] = [];
  const resolver = createCoverResolver({
    lookup: async (resources) => {
      lookups.push(resources);
      return new Map(
        resources.filter((r) => found[r]).map((r) => [r, found[r]]),
      );
    },
    read: async (keys) =>
      new Map(keys.filter((k) => store.has(k)).map((k) => [k, store.get(k)!])),
    write: async (entries) => entries.forEach((e) => store.set(e.key, e)),
    now: () => NOW,
  });
  const settled = () =>
    new Promise<void>((resolve) => {
      if (resolver.idle()) return resolve();
      const stop = resolver.subscribe(() => {
        if (resolver.idle()) {
          stop();
          resolve();
        }
      });
    });
  return { resolver, store, lookups, settled };
};

describe("coverResolver", () => {
  it("looks up unknown keys and stores hits and misses", async () => {
    const { resolver, store, lookups, settled } = setup([], {
      "https://www.discogs.com/master/1": { kind: "release-group", mbid: "g1" },
    });
    resolver.request(["master:1", "release:2"]);
    await settled();
    expect(resolver.get("master:1")).toBe(
      "https://coverartarchive.org/release-group/g1/front-250",
    );
    expect(resolver.get("release:2")).toBeNull();
    expect(lookups).toEqual([
      ["https://www.discogs.com/master/1", "https://www.discogs.com/release/2"],
    ]);
    expect(store.get("release:2")).toMatchObject({
      mbid: null,
      checkedAt: NOW,
    });
  });

  it("uses stored mappings without a lookup, re-checking old misses", async () => {
    const { resolver, lookups, settled } = setup([
      { key: "master:1", mbid: "g1", kind: "release-group", checkedAt: 0 },
      { key: "release:2", mbid: null, kind: "release", checkedAt: NOW - 1000 },
      {
        key: "release:3",
        mbid: null,
        kind: "release",
        checkedAt: NOW - MISS_RECHECK_MS,
      },
    ]);
    resolver.request(["master:1", "release:2", "release:3"]);
    await settled();
    expect(resolver.get("master:1")).toContain("/release-group/g1/");
    expect(resolver.get("release:2")).toBeNull();
    expect(lookups).toEqual([["https://www.discogs.com/release/3"]]);
  });

  it("puts the latest request first", async () => {
    const { resolver, lookups, settled } = setup();
    resolver.request(["release:1"]);
    resolver.request(["release:2"]);
    await settled();
    // The first request started at once; the second jumped ahead of nothing.
    expect(lookups.flat()).toEqual([
      "https://www.discogs.com/release/1",
      "https://www.discogs.com/release/2",
    ]);
  });

  it("treats a failed lookup as no art for this session", async () => {
    const resolver = createCoverResolver({
      lookup: async () => {
        throw new Error("503");
      },
      read: async () => new Map(),
      write: async () => {},
      now: () => NOW,
    });
    resolver.request(["master:1"]);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(resolver.get("master:1")).toBeNull();
    expect(resolver.idle()).toBe(true);
  });

  describe("Discogs covers", () => {
    const thumb = "https://i.discogs.com/t/150.jpeg";
    const full = "https://i.discogs.com/f/600.jpeg";

    it("counts misses and broken images as missing, until Discogs answers", async () => {
      const { resolver, store, settled } = setup([], {
        "https://www.discogs.com/master/1": { kind: "release-group", mbid: "g1" },
      });
      resolver.request(["master:1", "release:2", "master:3"]);
      await settled();
      // Unknown keys and keys with art aren't missing.
      expect(resolver.missing("master:9")).toBe(false);
      expect(resolver.missing("master:1")).toBe(false);
      expect(resolver.missing("release:2")).toBe(true);
      // A Cover Art Archive image that didn't load.
      resolver.reportBroken(resolver.get("master:1")!);
      expect(resolver.get("master:1")).toBeNull();
      expect(resolver.missing("master:1")).toBe(true);

      await resolver.setDiscogs("release:2", full, thumb);
      expect(resolver.get("release:2")).toBe(thumb);
      expect(resolver.large("release:2")).toBe(full);
      expect(resolver.missing("release:2")).toBe(false);
      expect(store.get("release:2")?.discogs).toMatchObject({
        source: "discogs",
        url: full,
        thumb,
        checkedAt: NOW,
      });
      // None on Discogs either: not missing (until the miss goes stale).
      await resolver.setDiscogs("master:3", null, null);
      expect(resolver.get("master:3")).toBeNull();
      expect(resolver.missing("master:3")).toBe(false);
    });

    it("prefers the Cover Art Archive, and reads stored Discogs covers", async () => {
      const { resolver, settled } = setup(
        [
          {
            key: "master:1",
            mbid: "g1",
            kind: "release-group",
            checkedAt: NOW,
            discogs: { source: "discogs", url: full, thumb, checkedAt: NOW },
          },
          {
            key: "master:2",
            mbid: null,
            kind: "release-group",
            checkedAt: NOW,
            discogs: { source: "discogs", url: full, thumb, checkedAt: NOW },
          },
          {
            key: "master:3",
            mbid: null,
            kind: "release-group",
            checkedAt: NOW,
            discogs: {
              source: "discogs",
              url: null,
              thumb: null,
              checkedAt: NOW - MISS_RECHECK_MS,
            },
          },
        ],
      );
      resolver.request(["master:1", "master:2", "master:3"]);
      await settled();
      expect(resolver.get("master:1")).toMatch(/coverartarchive/);
      expect(resolver.get("master:2")).toBe(thumb);
      expect(resolver.large("master:2")).toBe(full);
      // An old Discogs miss can be asked again.
      expect(resolver.missing("master:3")).toBe(true);
    });

    it("ignores reports for images that aren't the archive's", async () => {
      const { resolver, settled } = setup([
        {
          key: "master:2",
          mbid: null,
          kind: "release-group",
          checkedAt: NOW,
          discogs: { source: "discogs", url: full, thumb, checkedAt: NOW },
        },
      ]);
      resolver.request(["master:2"]);
      await settled();
      resolver.reportBroken(thumb);
      expect(resolver.get("master:2")).toBe(thumb);
    });
  });
});
