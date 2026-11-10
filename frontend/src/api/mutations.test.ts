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

  it("reads everyone's first page, then the further pages", async () => {
    const fetchMock = serve({ 1: 3, 2: 1, 3: 2 });
    global.fetch = fetchMock;
    const checked = jest.fn();
    const releases = await run([1, 2, 3], checked);
    expect(
      fetchMock.mock.calls.map((c) => {
        const u = new URL(String(c[0]));
        return `${u.pathname.split("/")[2]}:${u.searchParams.get("page")}`;
      }),
    ).toEqual(["1:1", "2:1", "3:1", "1:2", "1:3", "3:2"]);
    expect(new URL(String(fetchMock.mock.calls[0][0])).search).toBe(
      "?sort=year&sort_order=desc&per_page=500&page=1",
    );
    expect([...releases.keys()]).toEqual([
      "master:101",
      "master:201",
      "master:301",
      "master:102",
      "master:103",
      "master:302",
    ]);
    // Person 2 is done after the first pass; the others after the second.
    expect(checked.mock.calls.map((c) => c[0])).toEqual([
      "Person 2",
      "Person 1",
      "Person 3",
    ]);
    expect(checked).toHaveBeenCalledWith("Person 1", 1500, {
      pages: 3,
      capped: false,
    });
  });

  it("counts calls, the total growing as first pages announce more", async () => {
    global.fetch = serve({ 1: 3, 2: 1, 3: 2 });
    const progress = jest.fn();
    await run([1, 2, 3], jest.fn(), progress);
    expect(
      progress.mock.calls.map((c) => `${c[0].current}/${c[0].total}`),
    ).toEqual(["1/3", "2/5", "3/5", "4/6", "5/6", "6/6"]);
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
    expect(progress.mock.calls.map((c) => c[0].total)).toEqual([
      1, 4, 4, 4,
    ]);
  });

  it("keeps each person's coverage on the contributor", async () => {
    global.fetch = serve({ 1: 9, 2: 1 });
    const set = contributorSet([1, 2]);
    const result = listContributorReleases({ contributorSet: set }, {});
    await jest.advanceTimersByTimeAsync(60_000);
    await result;
    expect(set.contributors[1].discography).toEqual({
      items: 4500,
      pages: 4,
      capped: true,
    });
    expect(set.contributors[2].discography).toEqual({
      items: 500,
      pages: 1,
      capped: false,
    });
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

  it("drops a person's remaining pages from the total when one fails", async () => {
    global.fetch = serve({ 1: 4, 2: 1 }, 2);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const progress = jest.fn();
    await run([1, 2], jest.fn(), progress);
    // 1:1, 2:1, then 1:2 fails and 1:3, 1:4 are never asked for.
    expect(
      progress.mock.calls.map((c) => `${c[0].current}/${c[0].total}`),
    ).toEqual(["1/2", "2/5", "3/5"]);
  });
});
