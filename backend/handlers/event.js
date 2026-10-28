import { allowMethods } from "./http.js";

/**
 * POST /api/event
 *
 * Takes one analytics event from the browser, checks it against an
 * allowlist, adds the server-side fields and forwards it to the Google Sheet
 * through the Apps Script web app. The browser never sees the script URL or
 * token. Always answers 204 for a valid event, even if forwarding fails:
 * analytics must never get in the way of the app.
 *
 * Env: ANALYTICS_URL (Apps Script /exec URL) and ANALYTICS_TOKEN, which the
 * script matches to the "VP Events" sheet. Without ANALYTICS_URL events are
 * accepted and dropped, which keeps local dev and preview deployments out of
 * the sheet.
 */

/** Keep in sync with AnalyticsEvent in frontend/src/lib/analytics.ts. */
export const EVENTS = new Set([
  "page_view",
  "search_started",
  "search_completed",
  "search_not_found",
  "search_failed",
  "search_cancelled",
  "example_filled",
  "result_opened",
  "discogs_opened",
  "filter_changed",
  "result_credits",
  "cover_lookup",
  "stack_saved",
  "stack_opened",
  "stack_deleted",
  "search_unstacked",
  "stack_disbanded",
  "result_liked",
  "search_jumped",
  "library_view_toggled",
  "library_searched",
  "share_created",
  "share_completed",
  "chip_details",
]);

const MAX_PROPERTIES = 20;
const MAX_STRING = 200;
const MAX_URL = 300;
const FORWARD_TIMEOUT_MS = 5000;

const clip = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

/** Origin and path only: query strings and fragments can carry anything. */
const cleanReferrer = (value) => {
  if (typeof value !== "string" || value === "") return "";
  try {
    const url = new URL(value);
    return clip(`${url.origin}${url.pathname}`, MAX_URL);
  } catch {
    return "";
  }
};

const cleanProperties = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (Object.keys(out).length >= MAX_PROPERTIES) break;
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) continue;
    if (typeof raw === "string") out[key] = raw.trim().slice(0, MAX_STRING);
    else if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
    else if (typeof raw === "boolean") out[key] = raw;
  }
  return out;
};

/**
 * The fields we accept from the browser, cleaned, or null if the event is
 * malformed or not on the allowlist.
 */
export function sanitizeEvent(body) {
  let data = body;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || !EVENTS.has(data.event)) return null;

  const width = Number(data.screenWidth);
  return {
    event: data.event,
    properties: cleanProperties(data.properties),
    url:
      typeof data.path === "string" && data.path.startsWith("/")
        ? clip(data.path, MAX_URL)
        : "",
    referrer: cleanReferrer(data.referrer),
    screenWidth:
      Number.isInteger(width) && width > 0 && width < 10000 ? width : "",
    sessionId:
      typeof data.sessionId === "string" && /^[A-Za-z0-9]{8,40}$/.test(data.sessionId)
        ? data.sessionId
        : "",
  };
}

/**
 * Rejects posts from other sites. Browsers send Origin on POST; anything
 * without one (curl, bots) gets through, so this stops casual embedding,
 * not determined abuse.
 */
export function sameSite(headers) {
  const origin = headers?.origin;
  if (!origin) return true;
  try {
    const host = String(headers.host || "").split(":")[0];
    return new URL(origin).hostname === host;
  } catch {
    return false;
  }
}

/** Posts the row to the Apps Script web app. */
export async function forwardToSheet(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // Apps Script answers with a redirect to the script's output.
    redirect: "follow",
    signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok || !text.startsWith("OK")) {
    throw new Error(`Sheet answered ${response.status}: ${text.slice(0, 120)}`);
  }
}

export const createEventHandler =
  ({ forward = forwardToSheet, config = () => process.env, now = () => new Date() } = {}) =>
  async (req, res) => {
    if (!allowMethods(req, res, ["POST"])) return;
    if (!sameSite(req.headers)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let body;
    try {
      // On Vercel req.body is a getter that throws on malformed JSON.
      body = req.body;
    } catch {
      body = null;
    }
    const event = sanitizeEvent(body);
    if (!event) {
      res.status(400).json({ error: "Invalid event" });
      return;
    }

    const { ANALYTICS_URL: url, ANALYTICS_TOKEN: token } = config();
    if (url) {
      try {
        await forward(url, {
          token: token || "",
          timestamp: now().toISOString(),
          ...event,
          userAgent: clip(req.headers?.["user-agent"], MAX_URL),
        });
      } catch (error) {
        console.error("Analytics forward failed:", error.message);
      }
    }

    res.status(204).end();
  };

export default createEventHandler();
