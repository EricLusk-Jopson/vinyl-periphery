import { ArtBusyError, DiscogsArt, runArtQueue } from "./discogsArt";

const art = (key: string, image: string | null = null): DiscogsArt => ({
  key,
  image,
  thumb: image,
});

describe("runArtQueue", () => {
  it("asks for each key in turn, waiting between them", async () => {
    const events: string[] = [];
    const result = await runArtQueue(["master:1", "master:2", "release:3"], {
      signal: new AbortController().signal,
      fetchArt: async (key) => {
        events.push(`fetch ${key}`);
        return art(key, key === "master:2" ? null : `https://i.discogs.com/${key}.jpeg`);
      },
      wait: async (ms) => {
        events.push(`wait ${ms}`);
      },
      onResult: (a) => {
        events.push(`got ${a.key}`);
      },
    });
    expect(events).toEqual([
      "fetch master:1",
      "got master:1",
      "wait 1500",
      "fetch master:2",
      "got master:2",
      "wait 1500",
      "fetch release:3",
      "got release:3",
    ]);
    expect(result).toEqual({
      found: 2,
      none: 1,
      busy: false,
      cancelled: false,
      failed: 0,
    });
  });

  it("stops on a 429 without retrying", async () => {
    const asked: string[] = [];
    const result = await runArtQueue(["master:1", "master:2", "master:3"], {
      signal: new AbortController().signal,
      fetchArt: async (key) => {
        asked.push(key);
        if (key === "master:2") throw new ArtBusyError();
        return art(key, "https://i.discogs.com/x.jpeg");
      },
      wait: async () => {},
      onResult: () => {},
    });
    expect(asked).toEqual(["master:1", "master:2"]);
    expect(result).toMatchObject({ found: 1, busy: true });
  });

  it("stops when cancelled, and counts other failures", async () => {
    const controller = new AbortController();
    const asked: string[] = [];
    const result = await runArtQueue(["master:1", "master:2", "master:3"], {
      signal: controller.signal,
      fetchArt: async (key) => {
        asked.push(key);
        if (key === "master:1") throw new Error("offline");
        return art(key);
      },
      wait: async () => {},
      onResult: () => controller.abort(),
    });
    expect(asked).toEqual(["master:1", "master:2"]);
    expect(result).toMatchObject({ failed: 1, none: 1, cancelled: true });
  });
});
