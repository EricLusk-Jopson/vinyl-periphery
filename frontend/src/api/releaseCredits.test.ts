import {
  creditsTarget,
  discographyAppearance,
  DiscogsError,
  fetchReleaseCredits,
  parseReleaseCredits,
  RawRelease,
  targetKey,
} from "./releaseCredits";
import { readFileSync } from "fs";
import { join } from "path";
import { EnrichedRelease } from "./types";

// Trimmed from a real response: The Lonesome Crowded West, 2014 reissue.
const lonesomeCrowdedWest: RawRelease = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__/release-6237894.json"), "utf8"),
);

const result = (
  resource_url: string,
  extra: Record<string, unknown> = {},
): EnrichedRelease =>
  ({
    id: 1,
    title: "T",
    year: "1977",
    artist: "A",
    thumb: "",
    resource_url,
    contributorIds: [],
    ...extra,
  }) as unknown as EnrichedRelease;

describe("discographyAppearance", () => {
  it("reads role and trackinfo from a discography entry", () => {
    // As in a real /artists/{id}/releases entry.
    expect(
      discographyAppearance({
        id: 51539,
        type: "master",
        main_release: 22460452,
        role: "Appearance",
      } as { role: string }),
    ).toEqual({ role: "Appearance" });
    expect(
      discographyAppearance({ role: "TrackAppearance", trackinfo: " Gas " }),
    ).toEqual({ role: "TrackAppearance", trackinfo: "Gas" });
  });

  it("is undefined without a role", () => {
    expect(discographyAppearance({})).toBeUndefined();
    expect(discographyAppearance({ role: " " })).toBeUndefined();
    expect(discographyAppearance({ role: 3 })).toBeUndefined();
  });
});

describe("creditsTarget", () => {
  it("reads releases and masters, with the main release when given", () => {
    expect(
      creditsTarget(result("https://api.discogs.com/releases/12")),
    ).toEqual({ kind: "release", id: 12 });
    expect(
      creditsTarget(
        result("https://api.discogs.com/masters/34", { main_release: 56 }),
      ),
    ).toEqual({ kind: "master", id: 34, mainRelease: 56 });
    expect(creditsTarget(result("https://api.discogs.com/masters/34"))).toEqual(
      { kind: "master", id: 34 },
    );
  });

  it("prefers the result's own type, id and main release", () => {
    expect(
      creditsTarget({
        id: 34,
        type: "master",
        key: "master:34",
        mainRelease: 56,
      } as EnrichedRelease),
    ).toEqual({ kind: "master", id: 34, mainRelease: 56 });
  });

  it("is null for anything else", () => {
    expect(creditsTarget(result(""))).toBeNull();
    expect(
      creditsTarget(result("https://api.discogs.com/artists/1")),
    ).toBeNull();
  });

  it("keys masters and releases apart", () => {
    expect(targetKey({ kind: "release", id: 5 })).toBe("release:5");
    expect(targetKey({ kind: "master", id: 5 })).toBe("master:5");
  });
});

const artist = (id: number, role?: string, tracks?: string) => ({
  id,
  name: `Artist ${id}`,
  resource_url: "",
  ...(role !== undefined ? { role } : {}),
  ...(tracks !== undefined ? { tracks } : {}),
});

describe("parseReleaseCredits", () => {
  it("reads a real Discogs release", () => {
    const credits = parseReleaseCredits(lonesomeCrowdedWest);
    expect(credits[187919]).toEqual([
      { role: "Main Artist" },
      { role: "Written By" },
    ]);
    expect(credits[260715]).toEqual([
      { role: "Guitar" },
      { role: "Photography By" },
      { role: "Producer" },
      { role: "Vocals" },
    ]);
    expect(credits[281540]).toEqual([
      { role: "Engineer" },
      { role: "Producer" },
      { role: "Guitar", tracks: ["A3", "D3"] },
    ]);
    expect(credits[254426]).toEqual([
      { role: "Recorded By", tracks: ["A1", "B2", "B3"] },
    ]);
    expect(credits[173248]).toEqual([{ role: "Scratches", tracks: ["A2"] }]);
    // Credited without a Discogs artist page.
    expect(credits[0]).toBeUndefined();
  });

  it("reads main artists, release credits and track credits", () => {
    expect(
      parseReleaseCredits({
        id: 1,
        artists: [artist(1)],
        extraartists: [
          artist(2, "Producer"),
          artist(3, "Guitar [12-String], Vocals", "A1, B2"),
        ],
        tracklist: [
          { position: "A1", extraartists: [artist(4, "Saxophone")] },
          { position: "A2", artists: [artist(5)] },
        ],
      }),
    ).toEqual({
      1: [{ role: "Main Artist" }],
      2: [{ role: "Producer" }],
      3: [
        { role: "Guitar", tracks: ["A1", "B2"] },
        { role: "Vocals", tracks: ["A1", "B2"] },
      ],
      4: [{ role: "Saxophone", tracks: ["A1"] }],
      5: [{ role: "Track Artist", tracks: ["A2"] }],
    });
  });

  it("merges tracks for one role, and the whole release wins", () => {
    expect(
      parseReleaseCredits({
        id: 1,
        tracklist: [
          { position: "A1", extraartists: [artist(1, "Bass")] },
          { position: "B1", extraartists: [artist(1, "Bass")] },
          { position: "A1", extraartists: [artist(2, "Drums")] },
        ],
        extraartists: [artist(2, "Drums")],
      }),
    ).toEqual({
      1: [{ role: "Bass", tracks: ["A1", "B1"] }],
      2: [{ role: "Drums" }],
    });
  });

  it("keeps people credited with no role, and reads sub-tracks", () => {
    expect(
      parseReleaseCredits({
        id: 1,
        extraartists: [artist(1, "")],
        tracklist: [
          {
            position: "",
            type_: "index",
            sub_tracks: [
              { position: "3a", extraartists: [artist(2, "Piano")] },
            ],
          },
        ],
      }),
    ).toEqual({ 1: [], 2: [{ role: "Piano", tracks: ["3a"] }] });
  });

  it("ignores credits without an artist id", () => {
    expect(parseReleaseCredits({ id: 1, artists: [artist(0)] })).toEqual({});
  });
});

describe("fetchReleaseCredits", () => {
  const json = (body: unknown, status = 200) =>
    Promise.resolve({
      ok: status < 400,
      status,
      statusText: status === 429 ? "Too Many Requests" : "",
      json: () => Promise.resolve(body),
    } as Response);

  let fetchMock: jest.Mock;
  // One fake clock for the block: the request queue remembers its last call
  // across tests, so the clock mustn't jump back.
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    // Let the rate-limit waits run.
    await jest.advanceTimersByTimeAsync(10_000);
    return promise;
  };

  it("reads a release", async () => {
    fetchMock.mockReturnValueOnce(
      json({ id: 7, extraartists: [artist(1, "Producer")] }),
    );
    await expect(
      settle(fetchReleaseCredits({ kind: "release", id: 7 })),
    ).resolves.toEqual({
      releaseId: 7,
      fromMainRelease: false,
      credits: { 1: [{ role: "Producer" }] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.discogs.com/releases/7",
    );
  });

  it("looks up a master's main release when the result doesn't name it", async () => {
    fetchMock
      .mockReturnValueOnce(json({ id: 3, main_release: 9 }))
      .mockReturnValueOnce(json({ id: 9, artists: [artist(1)] }));
    const credits = await settle(
      fetchReleaseCredits({ kind: "master", id: 3 }),
    );
    expect(credits.releaseId).toBe(9);
    expect(credits.fromMainRelease).toBe(true);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://api.discogs.com/masters/3",
      "https://api.discogs.com/releases/9",
    ]);
  });

  it("goes straight to the main release when it's known", async () => {
    fetchMock.mockReturnValueOnce(json({ id: 9 }));
    await settle(
      fetchReleaseCredits({ kind: "master", id: 3, mainRelease: 9 }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.discogs.com/releases/9",
    );
  });

  it("fails with the HTTP status, or 0 offline", async () => {
    fetchMock.mockReturnValueOnce(json({}, 429));
    const limited = fetchReleaseCredits({ kind: "release", id: 1 });
    limited.catch(() => {});
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(limited).rejects.toMatchObject({
      name: "DiscogsError",
      status: 429,
    });

    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new TypeError("offline")),
    );
    const offline = fetchReleaseCredits({ kind: "release", id: 1 });
    offline.catch(() => {});
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(offline).rejects.toBeInstanceOf(DiscogsError);
    await expect(offline).rejects.toMatchObject({ status: 0 });
  });

  it("spaces calls by the request delay", async () => {
    const start = Date.now();
    const times: number[] = [];
    fetchMock.mockImplementation(() => {
      times.push(Date.now() - start);
      return json({ id: 1 });
    });
    const a = fetchReleaseCredits({ kind: "release", id: 1 });
    const b = fetchReleaseCredits({ kind: "release", id: 2 });
    await jest.advanceTimersByTimeAsync(10_000);
    await Promise.all([a, b]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(2500);
  });
});
