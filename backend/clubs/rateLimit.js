import { hashToken } from "./ids.js";

/**
 * Write limits. Per club, every write counts (adding a round of picks is
 * one write however many picks it holds). Per address, only creating clubs
 * and joining them, which come before any token.
 *
 * Fixed windows in the database, so they hold across serverless instances.
 */
export const WRITE_LIMITS = {
  clubMinute: { limit: 30, windowMs: 60_000 },
  clubDay: { limit: 600, windowMs: 86_400_000 },
  addressHour: { limit: 20, windowMs: 3_600_000 },
};

const SWEEP_EVERY = 50;
let writes = 0;

/** Counts one write in a bucket; true while under the limit. */
export async function allowWrite(db, bucket, { limit, windowMs }, now) {
  const expires = now + windowMs;
  const result = await db.execute({
    sql: `INSERT INTO write_counts (bucket, count, expires_at) VALUES (?, 1, ?)
          ON CONFLICT (bucket) DO UPDATE SET
            count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
            expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
          RETURNING count`,
    args: [bucket, expires, now, now],
  });
  if (++writes % SWEEP_EVERY === 0) {
    await db.execute({ sql: "DELETE FROM write_counts WHERE expires_at <= ?", args: [now] });
  }
  return Number(result.rows[0].count) <= limit;
}

export async function allowClubWrite(db, clubId, now) {
  return (
    (await allowWrite(db, `club:${clubId}:m`, WRITE_LIMITS.clubMinute, now)) &&
    (await allowWrite(db, `club:${clubId}:d`, WRITE_LIMITS.clubDay, now))
  );
}

/** The caller's address, hashed: no addresses are stored. */
export function addressOf(headers = {}) {
  const forwarded = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  return hashToken(forwarded || String(headers["x-real-ip"] || "unknown")).slice(0, 16);
}

export const allowAddressWrite = (db, headers, now) =>
  allowWrite(db, `addr:${addressOf(headers)}`, WRITE_LIMITS.addressHour, now);
