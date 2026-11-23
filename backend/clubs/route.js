// Shared plumbing for the club handlers: methods, same-site checks, the
// database, the caller's token and write limits, and errors as JSON.

import { allowMethods, sameSite } from "../handlers/http.js";
import { clubsDb } from "./db.js";
import { allowAddressWrite, allowClubWrite } from "./rateLimit.js";
import { bearer, memberForToken } from "./store.js";
import { readObject } from "./validate.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const fail = (status, message) => {
  throw new HttpError(status, message);
};

/** Throws a 400 for a validation result with an error, else gives its value. */
export const valid = (result) => (result.error ? fail(400, result.error) : result.value);

/**
 * Wraps a handler `(ctx) => void`. ctx has req, res, db, now, body (for
 * writes), and helpers that throw an HttpError when they refuse.
 */
export const clubRoute =
  (methods, handle, { db: openDb = () => clubsDb(), now = Date.now } = {}) =>
  async (req, res) => {
    if (!allowMethods(req, res, methods)) return;
    res.setHeader("Cache-Control", "no-store");
    const write = req.method !== "GET";
    if (write && !sameSite(req.headers)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const ready = openDb();
    if (!ready) {
      res.status(503).json({ error: "Clubs are not set up" });
      return;
    }
    try {
      const db = await ready;
      const at = now();
      let body = null;
      if (write && req.method !== "DELETE") {
        try {
          // On Vercel req.body is a getter that throws on malformed JSON.
          body = readObject(req.body);
        } catch {
          body = null;
        }
        if (!body) fail(400, "Expected a JSON object");
      }
      const ctx = {
        req,
        res,
        db,
        now: at,
        body,
        /** The token's member, or a 401. */
        async member() {
          const member = await memberForToken(db, bearer(req.headers));
          return member ?? fail(401, "Join the club first");
        },
        /** Counts a write against the club; a 429 past the limit. */
        async clubWrite(clubId) {
          if (!(await allowClubWrite(db, clubId, at))) {
            fail(429, "Too many changes to this club. Try again in a minute");
          }
        },
        /** Counts a create or join against the caller's address. */
        async addressWrite() {
          if (!(await allowAddressWrite(db, req.headers, at))) {
            fail(429, "Too many requests. Try again later");
          }
        },
      };
      await handle(ctx);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 429) res.setHeader("Retry-After", "60");
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error("Clubs request failed:", error.message);
      res.status(500).json({ error: "Something went wrong" });
    }
  };
