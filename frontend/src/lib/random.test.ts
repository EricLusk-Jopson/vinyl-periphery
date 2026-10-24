import { pickRandom } from "./random";
import { EXAMPLE_ALBUMS, HIDDEN_KEYS, TOP_ALBUMS } from "./topAlbums";

describe("pickRandom", () => {
  it("returns the requested number of different items", () => {
    for (let run = 0; run < 200; run++) {
      const picked = pickRandom(TOP_ALBUMS, 3);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
      picked.forEach((item) => expect(TOP_ALBUMS).toContain(item));
    }
  });

  it("uses the random source it is given", () => {
    const items = ["a", "b", "c", "d"];
    expect(pickRandom(items, 2, () => 0)).toEqual(["a", "b"]);
    expect(pickRandom(items, 2, () => 0.999)).toEqual(["d", "a"]);
  });

  it("can pick any item", () => {
    const seen = new Set<string>();
    const items = ["a", "b", "c", "d", "e"];
    for (let run = 0; run < 500; run++) {
      pickRandom(items, 1).forEach((item) => seen.add(item));
    }
    expect(seen.size).toBe(items.length);
  });

  it("does not change the input and copes with short lists", () => {
    const items = ["a", "b"];
    expect(pickRandom(items, 3).sort()).toEqual(["a", "b"]);
    expect(items).toEqual(["a", "b"]);
    expect(pickRandom([], 3)).toEqual([]);
  });
});

describe("TOP_ALBUMS", () => {
  it("has 639 different albums with an artist and a title", () => {
    expect(TOP_ALBUMS).toHaveLength(639);
    const keys = TOP_ALBUMS.map((a) => `${a.artist}\u0000${a.album}`);
    expect(new Set(keys).size).toBe(639);
    TOP_ALBUMS.forEach(({ artist, album }) => {
      expect(artist.trim()).not.toBe("");
      expect(album.trim()).not.toBe("");
    });
  });

  it("only hides albums that are in the list", () => {
    const keys = new Set(TOP_ALBUMS.map((a) => `${a.artist}\u0000${a.album}`));
    HIDDEN_KEYS.forEach((k) => expect(keys).toContain(k));
    expect(EXAMPLE_ALBUMS).toHaveLength(TOP_ALBUMS.length - HIDDEN_KEYS.size);
  });
});
