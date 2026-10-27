import { masterReleases, targetReleases } from "./searchTarget";

describe("masterReleases", () => {
  it("puts the main release first, then other versions, without repeats", () => {
    expect(
      masterReleases(22460452, [
        { id: 379811 },
        { id: 22460452 },
        { id: 786757 },
      ]),
    ).toEqual([{ id: 22460452 }, { id: 379811 }, { id: 786757 }]);
  });

  it("stops at the limit and skips bad ids", () => {
    expect(
      masterReleases(1, [{ id: 2 }, {}, { id: 0 }, { id: 3 }, { id: 4 }], 3),
    ).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(masterReleases(undefined, [])).toEqual([]);
  });
});

describe("targetReleases", () => {
  const json = (body: unknown, status = 200) =>
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

  const settle = async <T>(promise: Promise<T>) => {
    await jest.advanceTimersByTimeAsync(10_000);
    return promise;
  };

  it("reads a release target directly, with no calls", async () => {
    await expect(
      targetReleases({ type: "release", id: 7, key: "release:7" }),
    ).resolves.toEqual([{ id: 7 }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a master's main release and versions", async () => {
    fetchMock
      .mockReturnValueOnce(json({ id: 51539, main_release: 22460452 }))
      .mockReturnValueOnce(json({ versions: [{ id: 379811 }] }));
    await expect(
      settle(
        targetReleases({ type: "master", id: 51539, key: "master:51539" }),
      ),
    ).resolves.toEqual([{ id: 22460452 }, { id: 379811 }]);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://api.discogs.com/masters/51539",
      "https://api.discogs.com/masters/51539/versions?per_page=5&sort=released&sort_order=asc",
    ]);
  });

  it("falls back to the main release when versions fail", async () => {
    fetchMock
      .mockReturnValueOnce(json({ main_release: 9 }))
      .mockReturnValueOnce(json({}, 500));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      settle(targetReleases({ type: "master", id: 1, key: "master:1" })),
    ).resolves.toEqual([{ id: 9 }]);
  });

  it("fails when the master can't be read", async () => {
    fetchMock.mockReturnValueOnce(json({}, 404));
    const result = targetReleases({ type: "master", id: 1, key: "master:1" });
    result.catch(() => {});
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(result).rejects.toThrow("404");
  });
});
