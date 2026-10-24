/**
 * Pause after each Discogs call. Unauthenticated requests are limited to 25 a
 * minute, so 2.5s keeps the pipeline under that.
 */
export const REQUEST_DELAY_MS = 2500;

/** How many of the top search results we read credits from. */
export const MAX_RELEASES = 5;
