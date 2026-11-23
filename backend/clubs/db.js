import { createClient } from "@libsql/client";
import { SCHEMA } from "./schema.js";

/**
 * The clubs database, opened once per instance with the schema applied.
 *
 * Env: CLUBS_DATABASE_URL (a Turso `libsql://` URL, or `file:clubs.db` for
 * local development) and CLUBS_DATABASE_TOKEN (Turso's auth token). Without
 * a URL clubs are off: the handlers answer 503 and the rest of the app is
 * unaffected.
 */
let opened = null;

export async function applySchema(client) {
  await client.batch(SCHEMA, "write");
  return client;
}

export function clubsDb(env = process.env) {
  const url = env.CLUBS_DATABASE_URL;
  if (!url) return null;
  if (!opened || opened.url !== url) {
    const ready = applySchema(
      createClient({ url, authToken: env.CLUBS_DATABASE_TOKEN || undefined }),
    );
    // A failed open is retried on the next request instead of cached.
    ready.catch(() => {
      if (opened?.ready === ready) opened = null;
    });
    opened = { url, ready };
  }
  return opened.ready;
}

/** A fresh in-memory database with the schema, for tests. */
export const memoryDb = () => applySchema(createClient({ url: ":memory:" }));
