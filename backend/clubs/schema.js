// The clubs database: the app's first server-side store of user content.
// Turso (libSQL, SQLite's dialect). Every statement is idempotent, so the
// schema is applied on each cold start (see db.js) instead of by a separate
// migration step. Add columns with new statements, never by editing these.

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    admin_id TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    club_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    UNIQUE (club_id, name_key)
  )`,
  // A member can hold several tokens: one per phone or browser they joined
  // from. Only the SHA-256 of a token is kept.
  `CREATE TABLE IF NOT EXISTS member_tokens (
    hash TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    club_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS picks (
    id TEXT PRIMARY KEY,
    club_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    date TEXT NOT NULL,
    picker_id TEXT NOT NULL,
    listener_id TEXT,
    kind TEXT NOT NULL,
    album_key TEXT,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    answers TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS picks_by_club ON picks (club_id, round)`,
  `CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    club_id TEXT NOT NULL,
    pick_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    text TEXT NOT NULL,
    official INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS reactions_by_club ON reactions (club_id)`,
  // Fixed-window write counters (rateLimit.js). Kept in the database so the
  // limits hold across serverless instances.
  `CREATE TABLE IF NOT EXISTS write_counts (
    bucket TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
];
