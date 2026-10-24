/** URL paths and where the results page's back link goes. */

export type LibraryTab = "session" | "saved";

export const HOME_PATH = "/";
export const LIBRARY_PATH = "/library";

export const libraryPath = (tab: LibraryTab = "session"): string =>
  tab === "session" ? LIBRARY_PATH : `${LIBRARY_PATH}?tab=saved`;

/** The tab named in a `?tab=` query, defaulting to this session. */
export const libraryTab = (search: string): LibraryTab =>
  new URLSearchParams(search).get("tab") === "saved" ? "saved" : "session";

/** Search ids contain spaces and punctuation, so they are encoded. */
export const resultPath = (searchId: string): string =>
  `/results/${encodeURIComponent(searchId)}`;

/** Router state passed when opening a result, naming where it came from. */
export type ResultFrom =
  | { from: "home" }
  | { from: "library"; tab: LibraryTab };

/** The back link for a result, from the state it was opened with. */
export const backLink = (state: unknown): { to: string; label: string } => {
  const from = state as Partial<ResultFrom> | null;
  if (from?.from === "library") {
    return {
      to: libraryPath(from.tab === "saved" ? "saved" : "session"),
      label: "Back to library",
    };
  }
  return { to: HOME_PATH, label: "Back to home" };
};

/** Where the user is now, as the state for a result opened from here. */
export const fromLocation = (pathname: string, search: string): ResultFrom =>
  pathname === LIBRARY_PATH
    ? { from: "library", tab: libraryTab(search) }
    : { from: "home" };
