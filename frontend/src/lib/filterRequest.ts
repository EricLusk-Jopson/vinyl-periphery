/**
 * "More filters" in the share sheet: a request, from outside the page's
 * filter frame, to open it. Pending until a frame takes it, so a frame
 * that mounts afterwards (a stack page switching to its Results tab) still
 * opens.
 */

const EVENT = "vinyl-periphery:open-filters";
let pending = false;

export const requestFilters = (): void => {
  pending = true;
  window.dispatchEvent(new Event(EVENT));
};

/** Whether a request is waiting, without taking it. */
export const filtersRequested = (): boolean => pending;

/** Takes a waiting request: true once per request. */
export const takeFilterRequest = (): boolean => {
  const was = pending;
  pending = false;
  return was;
};

/** Calls `listener` on each request; returns the unsubscribe. */
export const onFilterRequest = (listener: () => void): (() => void) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
