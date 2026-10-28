import {
  getLikes,
  LIKES_STORAGE_KEY,
  resetLikesCache,
  setLiked,
  subscribeLikes,
} from "./likes";

describe("likes", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLikesCache();
  });

  it("keeps likes by album key, across reloads", () => {
    setLiked("master:1", true, { title: "Unmap", artist: "Volcano Choir" }, 5);
    expect(getLikes()).toEqual({
      "master:1": { title: "Unmap", artist: "Volcano Choir", likedAt: 5 },
    });
    resetLikesCache();
    expect(getLikes()["master:1"].title).toBe("Unmap");
    setLiked("master:1", false, { title: "Unmap", artist: "" });
    expect(getLikes()).toEqual({});
    expect(localStorage.getItem(LIKES_STORAGE_KEY)).toBe("{}");
  });

  it("returns the same object until something changes, and tells subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLikes(listener);
    const before = getLikes();
    expect(getLikes()).toBe(before);
    setLiked("release:2", true, { title: "B", artist: "C" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLikes()).not.toBe(before);
    unsubscribe();
  });

  it("starts empty when storage holds nonsense", () => {
    localStorage.setItem(LIKES_STORAGE_KEY, "{oops");
    expect(getLikes()).toEqual({});
  });
});
