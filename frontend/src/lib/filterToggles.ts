import { SearchCache } from "@/contexts/cache/types";
import { StackFilterState } from "./stackFilters";

/**
 * The filter switches, one list per mode, shared by the filter panels and
 * the share sheet so their labels and meanings can't drift apart.
 */

type SearchFilterState = SearchCache["filterState"];

export type SearchToggleKey =
  | "excludeMainArtist"
  | "collaborationsOnly"
  | "excludeVarious"
  | "likedOnly"
  | "showHidden";

export type StackToggleKey =
  | "excludeMainArtist"
  | "collaborationsOnly"
  | "excludeVarious"
  | "likedOnly"
  | "linksTwoPlus"
  | "showHidden";

export interface FilterToggle<K extends string> {
  key: K;
  /** The label; `artist` is the searched album's artist. */
  label: (artist: string) => string;
  /** The `filter` name sent with filter_changed / stack filter events. */
  event: string;
  /**
   * In the share sheet too. "Show hidden albums" isn't: hidden albums
   * never go into an image.
   */
  inSheet: boolean;
}

export const SEARCH_TOGGLES: FilterToggle<SearchToggleKey>[] = [
  {
    key: "excludeMainArtist",
    label: (artist) => `Hide ${artist} releases`,
    event: "hide_main_artist",
    inSheet: true,
  },
  {
    key: "collaborationsOnly",
    label: () => "Only albums with 2+ shared contributors",
    event: "two_plus_shared",
    inSheet: true,
  },
  {
    key: "excludeVarious",
    label: () => "Hide Various Artists",
    event: "hide_various",
    inSheet: true,
  },
  {
    key: "likedOnly",
    label: () => "Only liked albums",
    event: "liked_only",
    inSheet: true,
  },
  {
    key: "showHidden",
    label: () => "Show hidden albums",
    event: "show_hidden",
    inSheet: false,
  },
];

export const STACK_TOGGLES: FilterToggle<StackToggleKey>[] = [
  {
    key: "excludeMainArtist",
    label: () => "Hide releases by stack artists",
    event: "hide_main_artist",
    inSheet: true,
  },
  {
    key: "collaborationsOnly",
    label: () => "Only albums with 2+ shared contributors",
    event: "two_plus_shared",
    inSheet: true,
  },
  {
    key: "excludeVarious",
    label: () => "Hide Various Artists",
    event: "hide_various",
    inSheet: true,
  },
  {
    key: "likedOnly",
    label: () => "Only liked albums",
    event: "liked_only",
    inSheet: true,
  },
  {
    key: "linksTwoPlus",
    label: () => "Only albums linking 2+ stack albums",
    event: "two_plus_links",
    inSheet: true,
  },
  {
    key: "showHidden",
    label: () => "Show hidden albums",
    event: "show_hidden",
    inSheet: false,
  },
];

/** A switch's state (missing on older searches: off). */
export const toggleOn = <K extends string>(
  state: Partial<Record<K, boolean | unknown>>,
  key: K,
): boolean => state[key] === true;

/** The update that sets a switch. */
export const setToggle = <K extends SearchToggleKey | StackToggleKey>(
  key: K,
  on: boolean,
): Partial<SearchFilterState & StackFilterState> =>
  ({ [key]: on }) as Partial<SearchFilterState & StackFilterState>;
