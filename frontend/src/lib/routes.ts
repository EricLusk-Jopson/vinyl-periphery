/** URL paths and where the results page's back link goes. */

import type { SearchParams, SearchTarget } from "@/api/types";
import { searchTarget } from "./searchTarget";

export const HOME_PATH = "/";
export const LIBRARY_PATH = "/library";

/** The library: every search, stacked or on its own. */
export const libraryPath = (): string => LIBRARY_PATH;

/** Route pattern for one saved stack. */
export const STACK_ROUTE = `${LIBRARY_PATH}/stack/:stackId`;

/** One saved stack's page. Stack ids contain spaces and hyphens. */
export const stackPath = (stackId: string): string =>
  `${LIBRARY_PATH}/stack/${encodeURIComponent(stackId)}`;

export const RESULTS_PATH = "/results";

/**
 * A search's results page. The URL names the album rather than a cached
 * search, so it works on any device: where the search isn't cached, the page
 * offers to run it. With a target it adds `&master=` or `&release=`, so the
 * link reproduces the exact album; artist and album stay for display and for
 * links shared before ids.
 */
export const resultPath = (
  { artist, album }: SearchParams,
  target?: SearchTarget | null,
): string =>
  `${RESULTS_PATH}?${new URLSearchParams({
    artist: artist.trim(),
    album: album.trim(),
    ...(target ? { [target.type]: String(target.id) } : {}),
  })}`;

/** The album a results URL names by id, or null for a text-only link. */
export const resultTarget = (search: string): SearchTarget | null => {
  const query = new URLSearchParams(search);
  for (const type of ["master", "release"] as const) {
    const id = Number(query.get(type));
    if (Number.isInteger(id) && id > 0) return searchTarget(type, id);
  }
  return null;
};

/** The search named in a results page's query, or null if incomplete. */
export const resultParams = (search: string): SearchParams | null => {
  const query = new URLSearchParams(search);
  const artist = query.get("artist")?.trim() ?? "";
  const album = query.get("album")?.trim() ?? "";
  return artist && album ? { artist, album } : null;
};

/**
 * The album in an old `/results/<artist>-<album>-<timestamp>` id, when it
 * splits only one way. Ids whose names contain a hyphen are ambiguous.
 */
export const legacyResultParams = (searchId: string): SearchParams | null => {
  const match = /^(.+)-\d+$/.exec(searchId);
  const parts = match?.[1].split("-") ?? [];
  if (parts.length !== 2) return null;
  const [artist, album] = parts.map((part) => part.trim());
  return artist && album ? { artist, album } : null;
};

/** Router state passed when opening a result, naming where it came from. */
export type ResultFrom =
  | { from: "home" }
  | { from: "library" }
  | { from: "stack"; stackId: string };

/** The back link for a result, from the state it was opened with. */
export const backLink = (state: unknown): { to: string; label: string } => {
  const from = state as (Partial<ResultFrom> & { stackId?: string }) | null;
  if (from?.from === "stack" && from.stackId) {
    return { to: stackPath(from.stackId), label: "Back to stack" };
  }
  if (from?.from === "library") {
    return { to: libraryPath(), label: "Back to library" };
  }
  return { to: HOME_PATH, label: "Back to home" };
};

/** Where the user is now, as the state for a result opened from here. */
export const fromLocation = (pathname: string): ResultFrom => {
  const stack = pathname.match(/^\/library\/stack\/([^/]+)$/);
  if (stack) return { from: "stack", stackId: decodeURIComponent(stack[1]) };
  return pathname === LIBRARY_PATH ? { from: "library" } : { from: "home" };
};
