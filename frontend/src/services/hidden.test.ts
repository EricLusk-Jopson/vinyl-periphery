import {
  getHidden,
  HIDDEN_STORAGE_KEY,
  resetHiddenCache,
  setHidden,
  subscribeHidden,
} from "./hidden";

describe("hidden albums", () => {
  beforeEach(() => {
    localStorage.clear();
    resetHiddenCache();
  });

  it("keeps hidden albums by key, across reloads", () => {
    setHidden("master:1", true, { title: "Unmap", artist: "Volcano Choir" }, 5);
    expect(getHidden()).toEqual({
      "master:1": { title: "Unmap", artist: "Volcano Choir", hiddenAt: 5 },
    });
    resetHiddenCache();
    expect(getHidden()["master:1"].title).toBe("Unmap");
    setHidden("master:1", false, { title: "Unmap", artist: "" });
    expect(getHidden()).toEqual({});
    expect(localStorage.getItem(HIDDEN_STORAGE_KEY)).toBe("{}");
  });

  it("returns the same object until something changes, and tells subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeHidden(listener);
    const before = getHidden();
    expect(getHidden()).toBe(before);
    setHidden("release:2", true, { title: "B", artist: "C" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getHidden()).not.toBe(before);
    unsubscribe();
  });

  it("starts empty when storage holds nonsense", () => {
    localStorage.setItem(HIDDEN_STORAGE_KEY, "{oops");
    expect(getHidden()).toEqual({});
  });
});
