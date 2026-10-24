import { preloadImage } from "./preloadImage";

describe("preloadImage", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("resolves straight away without a URL", async () => {
    await expect(preloadImage("", 1000)).resolves.toBeUndefined();
  });

  it("gives up after the timeout", async () => {
    const done = jest.fn();
    const p = preloadImage("https://example.com/cover.jpg", 1000).then(done);
    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await p;
    expect(done).toHaveBeenCalled();
  });

  it("resolves when the signal aborts", async () => {
    const controller = new AbortController();
    const p = preloadImage(
      "https://example.com/cover.jpg",
      10000,
      controller.signal,
    );
    controller.abort();
    await expect(p).resolves.toBeUndefined();
  });
});
