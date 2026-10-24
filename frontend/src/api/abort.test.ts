import { isAbortError, sleep, throwIfAborted } from "./abort";

describe("sleep", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("resolves after the delay", async () => {
    const done = jest.fn();
    const p = sleep(1000).then(done);
    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await p;
    expect(done).toHaveBeenCalled();
  });

  it("rejects with an AbortError when aborted mid-wait", async () => {
    const controller = new AbortController();
    const p = sleep(1000, controller.signal);
    controller.abort();
    await p.catch((e) => expect(isAbortError(e)).toBe(true));
  });

  it("rejects straight away when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await sleep(1000, controller.signal).then(
      () => {
        throw new Error("should not resolve");
      },
      (e) => expect(isAbortError(e)).toBe(true),
    );
  });
});

describe("throwIfAborted", () => {
  it("does nothing without a signal or before abort", () => {
    expect(() => throwIfAborted()).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });

  it("throws an AbortError after abort", () => {
    const controller = new AbortController();
    controller.abort();
    try {
      throwIfAborted(controller.signal);
      throw new Error("did not throw");
    } catch (e) {
      expect(isAbortError(e)).toBe(true);
    }
  });
});

describe("isAbortError", () => {
  it("is false for other errors", () => {
    expect(isAbortError(new Error("nope"))).toBe(false);
    expect(isAbortError(new DOMException("x", "NetworkError"))).toBe(false);
  });
});
