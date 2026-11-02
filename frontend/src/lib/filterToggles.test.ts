import {
  SEARCH_TOGGLES,
  setToggle,
  STACK_TOGGLES,
  toggleOn,
} from "./filterToggles";
import { defaultStackFilters } from "./stackFilters";

describe("filter toggles", () => {
  it("lists one search's and a stack's switches, the sheet's without Show hidden", () => {
    expect(SEARCH_TOGGLES.map((t) => t.label("Bon Iver"))).toEqual([
      "Hide Bon Iver releases",
      "Only albums with 2+ shared contributors",
      "Hide Various Artists",
      "Only liked albums",
      "Show hidden albums",
    ]);
    expect(STACK_TOGGLES.filter((t) => t.inSheet).map((t) => t.key)).toEqual(
      [
        "excludeMainArtist",
        "collaborationsOnly",
        "excludeVarious",
        "likedOnly",
        "linksTwoPlus",
      ],
    );
    expect(SEARCH_TOGGLES.some((t) => t.inSheet && t.key === "showHidden")).toBe(
      false,
    );
  });

  it("reads missing switches as off and sets them by key", () => {
    expect(toggleOn({}, "likedOnly")).toBe(false);
    const stack = defaultStackFilters();
    expect(toggleOn(stack, "excludeMainArtist")).toBe(true);
    expect({ ...stack, ...setToggle("linksTwoPlus", true) }.linksTwoPlus).toBe(
      true,
    );
  });
});
