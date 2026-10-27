import {
  batches,
  coverArtUrl,
  discogsUrl,
  lookupBatch,
  lookupUrl,
  matchFor,
  MB_BATCH_SIZE,
  parseLookup,
} from "./musicbrainz";

describe("URLs", () => {
  it("builds Discogs, lookup and cover URLs", () => {
    expect(discogsUrl("master", 51539)).toBe(
      "https://www.discogs.com/master/51539",
    );
    expect(discogsUrl("release", 7)).toBe("https://www.discogs.com/release/7");
    expect(
      lookupUrl([
        "https://www.discogs.com/master/1",
        "https://www.discogs.com/release/2",
      ]),
    ).toBe(
      "https://musicbrainz.org/ws/2/url?resource=https%3A%2F%2Fwww.discogs.com%2Fmaster%2F1&resource=https%3A%2F%2Fwww.discogs.com%2Frelease%2F2&inc=release-group-rels+release-rels&fmt=json",
    );
    expect(coverArtUrl({ kind: "release-group", mbid: "g" })).toBe(
      "https://coverartarchive.org/release-group/g/front-250",
    );
    expect(coverArtUrl({ kind: "release", mbid: "r" })).toBe(
      "https://coverartarchive.org/release/r/front-250",
    );
  });

  it("splits into batches", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches(Array(MB_BATCH_SIZE + 1).fill(0))).toHaveLength(2);
  });
});

describe("parseLookup", () => {
  const master = "https://www.discogs.com/master/1";
  const release = "https://www.discogs.com/release/2";

  it("reads a single-URL response", () => {
    const matches = parseLookup({
      resource: master,
      relations: [
        { "target-type": "release_group", release_group: { id: "group-1" } },
      ],
    });
    expect(matchFor(matches, master)).toEqual({
      kind: "release-group",
      mbid: "group-1",
    });
  });

  it("reads a batch response, with either release-group spelling", () => {
    const matches = parseLookup({
      urls: [
        {
          resource: master,
          relations: [{ "release-group": { id: "group-1" } }],
        },
        {
          resource: `${release}/`,
          relations: [{ "target-type": "release", release: { id: "rel-2" } }],
        },
        { resource: "https://www.discogs.com/master/3", relations: [] },
      ],
    });
    expect(matchFor(matches, master)?.mbid).toBe("group-1");
    expect(matchFor(matches, release)).toEqual({
      kind: "release",
      mbid: "rel-2",
    });
    // Unlinked and absent URLs are misses.
    expect(matchFor(matches, "https://www.discogs.com/master/3")).toBeNull();
    expect(matchFor(matches, "https://www.discogs.com/master/4")).toBeNull();
  });

  it("copes with empty or odd responses", () => {
    expect(parseLookup(null).size).toBe(0);
    expect(parseLookup({ urls: "nope" }).size).toBe(0);
    expect(parseLookup({ error: "Not Found" }).size).toBe(0);
  });
});

describe("lookupBatch", () => {
  const respond = (body: unknown, status = 200) =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  let fetchMock: jest.Mock;
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it("treats a 404 as no matches", async () => {
    fetchMock.mockReturnValueOnce(respond({}, 404));
    const result = lookupBatch(["https://www.discogs.com/master/1"]);
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(result).resolves.toEqual(new Map());
  });

  it("backs off on 503, then succeeds", async () => {
    fetchMock.mockReturnValueOnce(respond({}, 503)).mockReturnValueOnce(
      respond({
        resource: "https://www.discogs.com/master/1",
        relations: [{ release_group: { id: "g" } }],
      }),
    );
    const result = lookupBatch(["https://www.discogs.com/master/1"]);
    await jest.advanceTimersByTimeAsync(20_000);
    expect((await result).size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated 503s", async () => {
    fetchMock.mockImplementation(() => respond({}, 503));
    const result = lookupBatch(["https://www.discogs.com/master/1"]);
    result.catch(() => {});
    await jest.advanceTimersByTimeAsync(60_000);
    await expect(result).rejects.toMatchObject({ status: 503 });
  });

  it("spaces lookups at least 1.1s apart", async () => {
    const times: number[] = [];
    fetchMock.mockImplementation(() => {
      times.push(Date.now());
      return respond({}, 404);
    });
    const a = lookupBatch(["a"]);
    const b = lookupBatch(["b"]);
    await jest.advanceTimersByTimeAsync(20_000);
    await Promise.all([a, b]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1100);
  });
});
