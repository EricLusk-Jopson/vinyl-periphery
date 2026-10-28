/**
 * Pause after each Discogs call. Unauthenticated requests are limited to 25 a
 * minute, so 2.5s keeps the pipeline under that.
 */
export const REQUEST_DELAY_MS = 2500;

/** Discography items per call. Discogs allows up to 500. */
export const DISCOGRAPHY_PAGE_SIZE = 500;

/**
 * Most discography pages read per contributor (2,000 items). Almost everyone
 * fits in one page; the cap keeps a search of several very prolific people
 * within the session storage budget and a reasonable time.
 */
export const MAX_DISCOGRAPHY_PAGES = 4;

/** How many of the top search results we read credits from. */
export const MAX_RELEASES = 5;
