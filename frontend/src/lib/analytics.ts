/**
 * Anonymous usage events, sent to /api/event and on to a Google Sheet.
 *
 * No storage: the session id lives in memory and changes on every page
 * load. Nothing is sent when the browser signals Global Privacy Control or
 * Do Not Track, or carries the no-tracking cookie (`NO_TRACK_COOKIE`, set
 * and cleared at `/no-track`, for the site's own visits). Sending never
 * throws and never blocks the UI.
 */

/** Keep in sync with EVENTS in backend/handlers/event.js. */
export type AnalyticsEvent =
  | "page_view"
  | "search_started"
  | "search_completed"
  | "search_not_found"
  | "search_failed"
  | "search_cancelled"
  | "example_filled"
  | "result_opened"
  | "discogs_opened"
  | "filter_changed"
  | "result_credits"
  | "cover_lookup"
  | "stack_saved"
  | "stack_opened"
  | "stack_view_changed"
  | "stack_filters_applied"
  | "search_unstacked"
  | "stack_disbanded"
  | "stack_created"
  | "stack_edited"
  | "stack_deleted"
  | "albums_deleted"
  | "stack_album_added"
  | "stack_album_removed"
  | "result_liked"
  | "result_hidden"
  | "search_jumped"
  | "library_view_toggled"
  | "library_searched"
  | "share_created"
  | "share_completed"
  | "share_regenerated"
  | "share_reset"
  | "share_more_filters"
  | "covers_requested"
  | "covers_found"
  | "chip_details"
  | "results_searched"
  | "result_picked";

export type EventProperties = Record<string, string | number | boolean>;

export interface EventPayload {
  event: AnalyticsEvent;
  properties: EventProperties;
  path: string;
  referrer: string;
  screenWidth: number;
  sessionId: string;
}

const ENDPOINT = "/api/event";

const randomId = (): string => {
  const bytes = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
};

const sessionId = randomId();

/** The page name for a path, so results pages group together. */
export const pageName = (pathname: string): string => {
  if (pathname === "/") return "home";
  if (pathname === "/library") return "library";
  if (pathname === "/results" || pathname.startsWith("/results/")) return "results";
  return "other";
};

/** Whole seconds since a start time, for durations. */
export const secondsSince = (start: number, now = Date.now()): number =>
  Math.max(0, Math.round((now - start) / 1000));

/** The server's limit on string property values. */
export const MAX_PROPERTY_LENGTH = 200;

/**
 * Joins values with "|", keeping only whole values that fit in `max`
 * characters, so the server's clip never cuts one in half.
 */
export const joinWithin = (
  values: string[],
  max = MAX_PROPERTY_LENGTH,
): string => {
  let out = "";
  for (const value of values) {
    const next = out === "" ? value : `${out}|${value}`;
    if (next.length > max) break;
    out = next;
  }
  return out;
};

interface PrivacySignals {
  globalPrivacyControl?: boolean;
  doNotTrack?: string | null;
}

export const isOptedOut = (signals: PrivacySignals): boolean =>
  signals.globalPrivacyControl === true || signals.doNotTrack === "1";

/** The cookie that stops this browser's events: set at `/no-track`. */
export const NO_TRACK_COOKIE = "vp_no_track";
/** How long it lasts: 400 days, the most browsers keep a cookie. */
const NO_TRACK_DAYS = 400;

/** Whether a `document.cookie` string carries the no-tracking cookie. */
export const hasNoTrackCookie = (cookies: string): boolean =>
  cookies
    .split(";")
    .some((c) => c.trim() === `${NO_TRACK_COOKIE}=1`);

/** The `document.cookie` assignment that sets (or clears) it. */
export const noTrackCookie = (on: boolean, secure: boolean): string =>
  [
    `${NO_TRACK_COOKIE}=${on ? "1" : ""}`,
    "Path=/",
    `Max-Age=${on ? NO_TRACK_DAYS * 24 * 60 * 60 : 0}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");

/** Whether this browser has the no-tracking cookie. */
export const isTrackingOff = (): boolean => {
  try {
    return hasNoTrackCookie(document.cookie);
  } catch {
    return false;
  }
};

/** Sets or clears the no-tracking cookie for this browser. */
export const setTrackingOff = (off: boolean): void => {
  try {
    document.cookie = noTrackCookie(off, window.location.protocol === "https:");
  } catch {
    // Cookies blocked: there's nothing to set, and nothing to clear.
  }
};

export const buildPayload = (
  event: AnalyticsEvent,
  properties: EventProperties,
  context: { path: string; referrer: string; screenWidth: number; sessionId: string },
): EventPayload => ({ event, properties, ...context });

export function track(event: AnalyticsEvent, properties: EventProperties = {}): void {
  try {
    if (typeof window === "undefined") return;
    if (isOptedOut(navigator as Navigator & PrivacySignals)) return;
    if (isTrackingOff()) return;

    const body = JSON.stringify(
      buildPayload(event, properties, {
        path: window.location.pathname,
        referrer: document.referrer,
        screenWidth: window.innerWidth,
        sessionId,
      }),
    );

    // sendBeacon survives the page closing; fall back to a keepalive fetch.
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}

/** `filter_changed` from a stack's Results tab. */
export const trackStackFilter = (
  filter: string,
  on: boolean,
  extra: EventProperties = {},
) => track("filter_changed", { filter, on, scope: "stack", ...extra });
