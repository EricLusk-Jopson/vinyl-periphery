import { listContributorReleases } from "./mutations";
import { ContributorSet } from "./types";

const contributorSet = (ids: number[]): ContributorSet => ({
  contributors: Object.fromEntries(
    ids.map((id) => [
      id,
      {
        id,
        name: `Person ${id}`,
        roles: [],
        sources: ["credits"],
        resourceUrl: "",
      },
    ]),
  ),
});

const item = (id: number) => ({
  id,
  type: "master",
  title: `Album ${id}`,
  artist: "A",
  year: 2000,
  resource_url: `https://api.discogs.com/masters/${id}`,
});

/** A fake discography: `items` albums, served `per_page` at a time. */
const serve = (pagesById: Record<number, number>, failPage?: number) =>
  jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const u = new URL(url);
    const id = Number(u.pathname.split("/")[2]);
    const page = Number(u.searchParams.get("page"));
    if (page === failPage) return { ok: false, status: 500 } as Response;
    const pages = pagesById[id];
    return {
      ok: true,
      json: async () => ({
        pagination: { pages, items: pages * 500 },
        releases: [item(id * 100 + page)],
      }),
    } as unknown as Response;
  });

describe("listContributorReleases", () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

  const run = async (
    ids: number[],
    onChecked = jest.fn(),
    onProgress = jest.fn(),
  ) => {
    const result = listContributorReleases(
      { contributorSet: contributorSet(ids) },
      { onContributorChecked: onChecked, onProgress },
    );
    await jest.advanceTimersByTimeAsync(60_000);
    return result;
  };

  it("reads every page, 500 at a time", async () => {
    const fetchMock = serve({ 1: 3, 2: 1 });
    global.fetch = fetchMock;
    const checked = jest.fn();
    const releases = await run([1, 2], checked);
    expect(
      fetchMock.mock.calls.map((c) => new URL(String(c[0])).search),
    ).toEqual([
      "?per_page=500&page=1",
      "?per_page=500&page=2",
      "?per_page=500&page=3",
      "?per_page=500&page=1",
    ]);
    expect([...releases.keys()]).toEqual([
      "master:101",
      "master:102",
      "master:103",
      "master:201",
    ]);
    expect(checked).toHaveBeenCalledWith("Person 1", 1500, {
      pages: 3,
      capped: false,
    });
  });

  it("stops at the page cap and says so", async () => {
    global.fetch = serve({ 1: 9 });
    const checked = jest.fn();
    const progress = jest.fn();
    await run([1], checked, progress);
    expect(checked).toHaveBeenCalledWith("Person 1", 4500, {
      pages: 4,
      capped: true,
    });
    // After the first page, progress knows 3 more calls are coming.
    expect(progress.mock.calls.map((c) => c[0].extraCalls)).toEqual([
      0, 3, 2, 1, 0,
    ]);
  });

  it("keeps the pages read when a later one fails", async () => {
    global.fetch = serve({ 1: 3 }, 2);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const checked = jest.fn();
    const releases = await run([1], checked);
    expect([...releases.keys()]).toEqual(["master:101"]);
    expect(checked).toHaveBeenCalledWith("Person 1", 1500, {
      pages: 1,
      capped: false,
    });
  });
});
