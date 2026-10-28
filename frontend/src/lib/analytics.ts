/**
 * Anonymous usage events, sent to /api/event and on to a Google Sheet.
 *
 * No cookies or storage: the session id lives in memory and changes on every
 * page load. Nothing is sent when the browser signals Global Privacy Control
 * or Do Not Track. Sending never throws and never blocks the UI.
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
  | "stack_deleted"
  | "search_unstacked"
  | "stack_disbanded"
  | "result_liked"
  | "search_jumped"
  | "library_view_toggled"
  | "library_searched"
  | "share_created"
  | "share_completed"
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

export const buildPayload = (
  event: AnalyticsEvent,
  properties: EventProperties,
  context: { path: string; referrer: string; screenWidth: number; sessionId: string },
): EventPayload => ({ event, properties, ...context });

export function track(event: AnalyticsEvent, properties: EventProperties = {}): void {
  try {
    if (typeof window === "undefined") return;
    if (isOptedOut(navigator as Navigator & PrivacySignals)) return;

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
