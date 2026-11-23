// Reads and writes for clubs, members, picks and reactions. Callers have
// already validated their input (validate.js) and checked who may write.

import { hashToken, newId, newToken, TOKEN } from "./ids.js";
import { nameKey } from "./validate.js";

const num = (value) => (value === null || value === undefined ? undefined : Number(value));
const str = (value) => (value === null || value === undefined ? undefined : String(value));

/** Drops undefined fields, so absent optional fields are absent in JSON. */
const compact = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

export const toClub = (row) =>
  compact({
    id: str(row.id),
    name: str(row.name),
    format: str(row.format),
    adminId: str(row.admin_id),
    createdAt: num(row.created_at),
  });

export const toMember = (row) => ({
  id: str(row.id),
  clubId: str(row.club_id),
  name: str(row.name),
  joinedAt: num(row.joined_at),
});

export const toPick = (row) =>
  compact({
    id: str(row.id),
    clubId: str(row.club_id),
    round: num(row.round),
    date: str(row.date),
    pickerId: str(row.picker_id),
    listenerId: str(row.listener_id),
    kind: str(row.kind),
    album: compact({ key: str(row.album_key), artist: str(row.artist), title: str(row.title) }),
    answers: str(row.answers),
    reason: str(row.reason),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  });

export const toReaction = (row) =>
  compact({
    id: str(row.id),
    pickId: str(row.pick_id),
    memberId: str(row.member_id),
    text: str(row.text),
    official: Boolean(Number(row.official)),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  });

const one = async (db, sql, args) => (await db.execute({ sql, args })).rows[0] ?? null;

export async function getClubRow(db, clubId) {
  return one(db, "SELECT * FROM clubs WHERE id = ?", [clubId]);
}

/** Everything a club page shows. Clubs are small: one read, no paging. */
export async function readClub(db, clubId) {
  const [clubs, members, picks, reactions] = await db.batch(
    [
      { sql: "SELECT * FROM clubs WHERE id = ?", args: [clubId] },
      { sql: "SELECT * FROM members WHERE club_id = ? ORDER BY joined_at, rowid", args: [clubId] },
      {
        sql: "SELECT * FROM picks WHERE club_id = ? ORDER BY round, created_at, seq, rowid",
        args: [clubId],
      },
      {
        sql: "SELECT * FROM reactions WHERE club_id = ? ORDER BY created_at, rowid",
        args: [clubId],
      },
    ],
    "read",
  );
  if (!clubs.rows[0]) return null;
  return {
    club: toClub(clubs.rows[0]),
    members: members.rows.map(toMember),
    picks: picks.rows.map(toPick),
    reactions: reactions.rows.map(toReaction),
  };
}

/** The member a token belongs to, with their club, or null. */
export async function memberForToken(db, token) {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  const row = await one(
    db,
    `SELECT m.* FROM member_tokens t JOIN members m ON m.id = t.member_id
     WHERE t.hash = ? AND m.club_id = t.club_id`,
    [hashToken(token)],
  );
  return row ? toMember(row) : null;
}

/** The token from `Authorization: Bearer …`. */
export function bearer(headers = {}) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(headers.authorization || ""));
  return match ? match[1] : null;
}

const tokenInsert = (token, memberId, clubId, now) => ({
  sql: "INSERT INTO member_tokens (hash, member_id, club_id, created_at) VALUES (?, ?, ?, ?)",
  args: [hashToken(token), memberId, clubId, now],
});

export async function createClub(db, { id, name, format, memberName }, now) {
  const memberId = newId();
  const token = newToken();
  await db.batch(
    [
      {
        sql: "INSERT INTO clubs (id, name, format, admin_id, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, name, format, memberId, now],
      },
      {
        sql: "INSERT INTO members (id, club_id, name, name_key, joined_at) VALUES (?, ?, ?, ?, ?)",
        args: [memberId, id, memberName, nameKey(memberName), now],
      },
      tokenInsert(token, memberId, id, now),
    ],
    "write",
  );
  return { token, memberId };
}

export async function updateClub(db, clubId, { name, format }) {
  await db.execute({
    sql: "UPDATE clubs SET name = COALESCE(?, name), format = COALESCE(?, format) WHERE id = ?",
    args: [name ?? null, format ?? null, clubId],
  });
}

export async function findMemberByName(db, clubId, name) {
  const row = await one(db, "SELECT * FROM members WHERE club_id = ? AND name_key = ?", [
    clubId,
    nameKey(name),
  ]);
  return row ? toMember(row) : null;
}

export async function getMember(db, memberId) {
  const row = await one(db, "SELECT * FROM members WHERE id = ?", [memberId]);
  return row ? toMember(row) : null;
}

/** Adds a member and gives the caller a token for them. */
export async function addMember(db, clubId, name, now) {
  const id = newId();
  const token = newToken();
  await db.batch(
    [
      {
        sql: "INSERT INTO members (id, club_id, name, name_key, joined_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, clubId, name, nameKey(name), now],
      },
      tokenInsert(token, id, clubId, now),
    ],
    "write",
  );
  return { member: { id, clubId, name, joinedAt: now }, token };
}

/** A new token for an existing member: choosing your name on a new phone. */
export async function issueToken(db, member, now) {
  const token = newToken();
  await db.execute(tokenInsert(token, member.id, member.clubId, now));
  return token;
}

export async function renameMember(db, memberId, name) {
  await db.execute({
    sql: "UPDATE members SET name = ?, name_key = ? WHERE id = ?",
    args: [name, nameKey(name), memberId],
  });
}

export async function getPick(db, pickId) {
  const row = await one(db, "SELECT * FROM picks WHERE id = ?", [pickId]);
  return row ? toPick(row) : null;
}

export async function maxRound(db, clubId) {
  const row = await one(db, "SELECT COALESCE(MAX(round), 0) AS round FROM picks WHERE club_id = ?", [
    clubId,
  ]);
  return Number(row.round);
}

/** Member ids of a club, for checking picker and listener ids. */
export async function memberIds(db, clubId) {
  const result = await db.execute({ sql: "SELECT id FROM members WHERE club_id = ?", args: [clubId] });
  return new Set(result.rows.map((row) => String(row.id)));
}

/** The rounds of picks by id within a club (for checking `answers`). */
export async function pickRounds(db, clubId, ids) {
  if (ids.length === 0) return new Map();
  const result = await db.execute({
    sql: `SELECT id, round FROM picks WHERE club_id = ? AND id IN (${ids.map(() => "?").join(", ")})`,
    args: [clubId, ...ids],
  });
  return new Map(result.rows.map((row) => [String(row.id), Number(row.round)]));
}

/**
 * Adds picks as one round. Without `round` they go into a new round after
 * the last, worked out in the same transaction so two players posting at
 * once can't both take the same number by reading it first.
 */
export async function addPicks(db, clubId, picks, round, now) {
  const ids = picks.map(() => newId());
  const statements = picks.map((pick, index) => {
    const roundSql =
      round !== null
        ? "?"
        : index === 0
          ? "(SELECT COALESCE(MAX(round), 0) + 1 FROM picks WHERE club_id = ?)"
          : "(SELECT round FROM picks WHERE id = ?)";
    const roundArg = round !== null ? round : index === 0 ? clubId : ids[0];
    return {
      sql: `INSERT INTO picks (id, club_id, round, seq, date, picker_id, listener_id, kind,
              album_key, artist, title, answers, reason, created_at)
            VALUES (?, ?, ${roundSql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ids[index],
        clubId,
        roundArg,
        index,
        pick.date,
        pick.pickerId,
        pick.listenerId,
        pick.kind,
        pick.album.key,
        pick.album.artist,
        pick.album.title,
        pick.answers,
        pick.reason,
        now,
      ],
    };
  });
  await db.batch(statements, "write");
  const result = await db.execute({
    sql: `SELECT * FROM picks WHERE id IN (${ids.map(() => "?").join(", ")}) ORDER BY seq`,
    args: ids,
  });
  const byId = new Map(result.rows.map((row) => [String(row.id), toPick(row)]));
  return ids.map((id) => byId.get(id));
}

/** Applies a cleaned patch; a listener change re-marks the official reactions. */
export async function updatePick(db, pick, patch, now) {
  const next = { ...pick, ...patch, album: patch.album ?? pick.album };
  const statements = [
    {
      sql: `UPDATE picks SET date = ?, listener_id = ?, kind = ?, album_key = ?, artist = ?,
              title = ?, answers = ?, reason = ?, updated_at = ? WHERE id = ?`,
      args: [
        next.date,
        next.listenerId ?? null,
        next.kind,
        next.album.key ?? null,
        next.album.artist,
        next.album.title,
        next.answers ?? null,
        next.reason ?? null,
        now,
        pick.id,
      ],
    },
  ];
  if ("listenerId" in patch) {
    statements.push({
      sql: "UPDATE reactions SET official = (member_id IS ?) WHERE pick_id = ?",
      args: [patch.listenerId ?? null, pick.id],
    });
  }
  await db.batch(statements, "write");
  return getPick(db, pick.id);
}

/** Deletes a pick and its reactions; picks that answered it answer nothing. */
export async function deletePick(db, pick) {
  await db.batch(
    [
      { sql: "UPDATE picks SET answers = NULL WHERE answers = ? AND club_id = ?", args: [pick.id, pick.clubId] },
      { sql: "DELETE FROM reactions WHERE pick_id = ?", args: [pick.id] },
      { sql: "DELETE FROM picks WHERE id = ?", args: [pick.id] },
    ],
    "write",
  );
}

export async function getReaction(db, reactionId) {
  const row = await one(db, "SELECT * FROM reactions WHERE id = ?", [reactionId]);
  return row ? { ...toReaction(row), clubId: String(row.club_id) } : null;
}

export async function addReaction(db, pick, memberId, text, now) {
  const id = newId();
  const official = pick.listenerId === memberId;
  await db.execute({
    sql: `INSERT INTO reactions (id, club_id, pick_id, member_id, text, official, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, pick.clubId, pick.id, memberId, text, official ? 1 : 0, now],
  });
  return { id, pickId: pick.id, memberId, text, official, createdAt: now };
}

export async function updateReaction(db, reactionId, text, now) {
  await db.execute({
    sql: "UPDATE reactions SET text = ?, updated_at = ? WHERE id = ?",
    args: [text, now, reactionId],
  });
  const { clubId: _clubId, ...reaction } = await getReaction(db, reactionId);
  return reaction;
}

export async function deleteReaction(db, reactionId) {
  await db.execute({ sql: "DELETE FROM reactions WHERE id = ?", args: [reactionId] });
}
