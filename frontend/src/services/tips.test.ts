import { dismissTip, tipDismissed, TIPS_STORAGE_KEY } from "./tips";

describe("tips", () => {
  beforeEach(() => localStorage.clear());

  it("shows a tip until it's dismissed, then never again", () => {
    expect(tipDismissed("search-from-result")).toBe(false);
    dismissTip("search-from-result");
    expect(tipDismissed("search-from-result")).toBe(true);
    expect(JSON.parse(localStorage.getItem(TIPS_STORAGE_KEY) ?? "[]")).toEqual([
      "search-from-result",
    ]);
  });
});
