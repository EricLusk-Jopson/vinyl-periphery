import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "../clubs/db.js";
import { allowWrite, WRITE_LIMITS } from "../clubs/rateLimit.js";
import { cleanDate, cleanPick, cleanText, nameKey } from "../clubs/validate.js";
import { createClubsHandler } from "./clubs.js";
import { createClubMembersHandler } from "./club-members.js";
import { createClubPicksHandler } from "./club-picks.js";
import { createClubReactionsHandler } from "./club-reactions.js";
import { mockRequest, mockResponse } from "./testing.js";

const quiet = async (fn) => {
  const error = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
  }
};

/** Handlers over one fresh in-memory database, with a clock tests can move. */
async function setup() {
  const db = await memoryDb();
  const clock = { now: Date.UTC(2026, 10, 22, 12) };
  const deps = { db: () => Promise.resolve(db), now: () => clock.now };
  const handlers = {
    clubs: createClubsHandler(deps),
    members: createClubMembersHandler(deps),
    picks: createClubPicksHandler(deps),
    reactions: createClubReactionsHandler(deps),
  };
  const call = async (name, method, { body, query = {}, token, headers = {} } = {}) => {
    const res = mockResponse();
    const allHeaders = { host: "vinylperiphery.com", ...headers };
    if (token) allHeaders.authorization = `Bearer ${token}`;
    await quiet(() => handlers[name](mockRequest({ method, body, query, headers: allHeaders }), res));
    return res;
  };
  return { db, clock, call };
}

/** A club with Eric (admin) and Sam. */
async function club(call) {
  const created = await call("clubs", "POST", {
    body: { name: "Album game", format: "handoff", memberName: "Eric" },
  });
  assert.equal(created.statusCode, 201);
  const { club: info, token: eric, member } = created.body;
  const joined = await call("members", "POST", { body: { clubId: info.id, name: "Sam" } });
  assert.equal(joined.statusCode, 201);
  return { id: info.id, eric, ericId: member.id, sam: joined.body.token, samId: joined.body.member.id };
}

const album = (artist, title, key) => ({ artist, title, ...(key ? { key } : {}) });

test("creates a club with its admin, and reads it back", async () => {
  const { call } = await setup();
  const res = await call("clubs", "POST", {
    body: { name: "  Album   game ", memberName: "Eric" },
  });
  assert.equal(res.statusCode, 201);
  assert.match(res.body.club.id, /^[A-Za-z0-9_-]{24}$/);
  assert.match(res.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(res.body.club.name, "Album game");
  assert.equal(res.body.club.format, "handoff");
  assert.equal(res.body.club.adminId, res.body.member.id);

  const read = await call("clubs", "GET", { query: { id: res.body.club.id }, token: res.body.token });
  assert.equal(read.statusCode, 200);
  assert.equal(read.headers["cache-control"], "no-store");
  assert.deepEqual(read.body.members.map((m) => m.name), ["Eric"]);
  assert.deepEqual(read.body.picks, []);
  assert.equal(read.body.you, res.body.member.id);
  // The token is never read back.
  assert.equal(JSON.stringify(read.body).includes(res.body.token), false);

  const anonymous = await call("clubs", "GET", { query: { id: res.body.club.id } });
  assert.equal(anonymous.body.you, undefined);
});

test("refuses bad clubs and unknown ids", async () => {
  const { call } = await setup();
  assert.equal((await call("clubs", "POST", { body: { name: "", memberName: "Eric" } })).statusCode, 400);
  assert.equal((await call("clubs", "POST", { body: { name: "x".repeat(81), memberName: "Eric" } })).statusCode, 400);
  assert.equal((await call("clubs", "POST", { body: { name: "A", memberName: "E", format: "league" } })).statusCode, 400);
  assert.equal((await call("clubs", "POST", { body: "not json" })).statusCode, 400);
  assert.equal((await call("clubs", "GET", { query: { id: "nope" } })).statusCode, 404);
  assert.equal((await call("clubs", "GET", { query: { id: "a".repeat(24) } })).statusCode, 404);
  assert.equal((await call("clubs", "DELETE")).statusCode, 405);
  const foreign = await call("clubs", "POST", {
    body: { name: "A", memberName: "E" },
    headers: { origin: "https://elsewhere.example" },
  });
  assert.equal(foreign.statusCode, 403);
});

test("answers 503 when clubs aren't configured", async () => {
  const handler = createClubsHandler({ db: () => null });
  const res = mockResponse();
  await handler(mockRequest({ method: "GET", query: { id: "a".repeat(24) } }), res);
  assert.equal(res.statusCode, 503);
});

test("joining: a new name, a taken name, and choosing your name on a new phone", async () => {
  const { call } = await setup();
  const { id, ericId } = await club(call);

  const taken = await call("members", "POST", { body: { clubId: id, name: " eric" } });
  assert.equal(taken.statusCode, 409);
  assert.equal(taken.body.member.id, ericId);

  const phone = await call("members", "POST", { body: { clubId: id, memberId: ericId } });
  assert.equal(phone.statusCode, 200);
  assert.equal(phone.body.member.name, "Eric");
  const read = await call("clubs", "GET", { query: { id }, token: phone.body.token });
  assert.equal(read.body.you, ericId);

  assert.equal((await call("members", "POST", { body: { clubId: id, memberId: "x".repeat(12) } })).statusCode, 404);
  assert.equal((await call("members", "POST", { body: { clubId: "b".repeat(24), name: "Jo" } })).statusCode, 404);
});

test("renaming: yourself, or anyone as admin", async () => {
  const { call } = await setup();
  const { eric, sam, ericId, samId } = await club(call);
  assert.equal((await call("members", "PATCH", { token: sam, body: { name: "Samuel" } })).statusCode, 200);
  assert.equal((await call("members", "PATCH", { token: sam, body: { memberId: ericId, name: "E" } })).statusCode, 403);
  assert.equal((await call("members", "PATCH", { token: eric, body: { memberId: samId, name: "Sam" } })).statusCode, 200);
  assert.equal((await call("members", "PATCH", { token: eric, body: { name: "sam" } })).statusCode, 409);
  assert.equal((await call("members", "PATCH", { body: { name: "Nobody" } })).statusCode, 401);
});

test("only the admin changes the club", async () => {
  const { call } = await setup();
  const { id, eric, sam } = await club(call);
  assert.equal((await call("clubs", "PATCH", { token: sam, body: { id, name: "Mine" } })).statusCode, 403);
  const res = await call("clubs", "PATCH", { token: eric, body: { id, format: "chain" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.club.format, "chain");
  assert.equal(res.body.club.name, "Album game");
});

test("a handoff round: two picks, the similar one answering the last round", async () => {
  const { call } = await setup();
  const { id, eric, sam, ericId, samId } = await club(call);

  const first = await call("picks", "POST", {
    token: eric,
    body: {
      picks: [
        { kind: "similar", listenerId: samId, album: album("Quasimoto", "The Unseen", "master:2385") },
        { kind: "wild", listenerId: samId, album: album("Arthur Russell", "World of Echo") },
      ],
    },
  });
  assert.equal(first.statusCode, 201);
  const [quasimoto, russell] = first.body.picks;
  assert.equal(quasimoto.round, 1);
  assert.equal(russell.round, 1);
  assert.equal(quasimoto.pickerId, ericId);
  assert.equal(quasimoto.date, "2026-11-22");
  assert.equal(quasimoto.album.key, "master:2385");
  assert.equal(russell.album.key, undefined);
  assert.equal(russell.answers, undefined);

  const second = await call("picks", "POST", {
    token: sam,
    body: {
      picks: [
        {
          kind: "similar",
          listenerId: ericId,
          answers: quasimoto.id,
          reason: "Madlib again, \r\n\n\n\nwith Doom.",
          album: album("Madvillain", "Madvillainy", "master:20488"),
        },
        { kind: "wild", listenerId: ericId, album: album("Hiroshi Yoshimura", "Music for Nine Postcards") },
      ],
    },
  });
  assert.equal(second.statusCode, 201);
  assert.equal(second.body.picks[0].round, 2);
  assert.equal(second.body.picks[0].answers, quasimoto.id);
  assert.equal(second.body.picks[0].reason, "Madlib again,\n\nwith Doom.");

  const read = await call("clubs", "GET", { query: { id } });
  assert.deepEqual(read.body.picks.map((p) => [p.round, p.album.title]), [
    [1, "The Unseen"],
    [1, "World of Echo"],
    [2, "Madvillainy"],
    [2, "Music for Nine Postcards"],
  ]);
});

test("picks: answers must be earlier, ids must be the club's, and posting needs a token", async () => {
  const { call } = await setup();
  const { eric, sam, ericId } = await club(call);
  const other = await club(call);
  const [theirs] = (
    await call("picks", "POST", { token: other.eric, body: { picks: [{ album: album("A", "B") }] } })
  ).body.picks;

  assert.equal((await call("picks", "POST", { body: { picks: [{ album: album("A", "B") }] } })).statusCode, 401);
  assert.equal((await call("picks", "POST", { token: "x".repeat(43), body: { picks: [{ album: album("A", "B") }] } })).statusCode, 401);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: Array(5).fill({ album: album("A", "B") }) } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "") }] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [{ album: { ...album("A", "B"), key: "label:1" } }] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B"), kind: "rated" }] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B"), date: "2026-02-30" }] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B"), answers: theirs.id }] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B"), listenerId: other.ericId }] } })).statusCode, 400);
  assert.equal((await call("picks", "POST", { token: eric, body: { round: 2, picks: [{ album: album("A", "B") }] } })).statusCode, 400);

  const [mine] = (await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B") }] } })).body.picks;
  // An answer in the same round isn't earlier.
  const same = await call("picks", "POST", { token: sam, body: { round: 1, picks: [{ album: album("C", "D"), answers: mine.id }] } });
  assert.equal(same.statusCode, 400);
  // Joining round 1 is fine.
  const join = await call("picks", "POST", { token: sam, body: { round: 1, picks: [{ album: album("C", "D") }] } });
  assert.equal(join.statusCode, 201);
  assert.equal(join.body.picks[0].round, 1);

  // Only the admin adds picks for someone else.
  assert.equal((await call("picks", "POST", { token: sam, body: { picks: [{ album: album("E", "F"), pickerId: ericId }] } })).statusCode, 403);
  const backfill = await call("picks", "POST", {
    token: eric,
    body: { picks: [{ album: album("E", "F"), pickerId: join.body.picks[0].pickerId, date: "2014-03-02" }] },
  });
  assert.equal(backfill.statusCode, 201);
  assert.equal(backfill.body.picks[0].date, "2014-03-02");
});

test("editing and deleting picks: the picker and the admin", async () => {
  const { call } = await setup();
  const { id, eric, sam, samId } = await club(call);
  const [first] = (await call("picks", "POST", { token: sam, body: { picks: [{ album: album("A", "B"), listenerId: samId }] } })).body.picks;
  const [second] = (await call("picks", "POST", { token: eric, body: { picks: [{ album: album("C", "D"), answers: first.id, reason: "Same drummer" }] } })).body.picks;

  assert.equal((await call("picks", "PATCH", { token: sam, body: { id: second.id, reason: "Mine now" } })).statusCode, 403);
  const edited = await call("picks", "PATCH", { token: eric, body: { id: second.id, reason: null, kind: "similar" } });
  assert.equal(edited.statusCode, 200);
  assert.equal(edited.body.pick.reason, undefined);
  assert.equal(edited.body.pick.kind, "similar");
  assert.equal(edited.body.pick.answers, first.id);
  assert.equal(edited.body.pick.album.title, "D");
  assert.equal((await call("picks", "PATCH", { token: eric, body: { id: first.id, answers: second.id } })).statusCode, 400);
  assert.equal((await call("picks", "PATCH", { token: eric, body: { id: first.id, answers: first.id } })).statusCode, 400);

  // The admin may delete Sam's pick; the pick answering it then answers nothing.
  await call("reactions", "POST", { token: sam, body: { pickId: first.id, text: "Note to self" } });
  assert.equal((await call("picks", "DELETE", { token: eric, query: { id: first.id } })).statusCode, 204);
  const read = await call("clubs", "GET", { query: { id } });
  assert.equal(read.body.picks.length, 1);
  assert.equal(read.body.picks[0].answers, undefined);
  assert.equal(read.body.reactions.length, 0);
  assert.equal((await call("picks", "DELETE", { token: eric, query: { id: first.id } })).statusCode, 404);
});

test("reactions: official for the assigned listener, edited by their author", async () => {
  const { call } = await setup();
  const { id, eric, sam, samId } = await club(call);
  const [pick] = (await call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B"), listenerId: samId }] } })).body.picks;

  const official = await call("reactions", "POST", { token: sam, body: { pickId: pick.id, text: "  Loved the second side.  " } });
  assert.equal(official.statusCode, 201);
  assert.equal(official.body.reaction.official, true);
  assert.equal(official.body.reaction.text, "Loved the second side.");
  const along = await call("reactions", "POST", { token: eric, body: { pickId: pick.id, text: "Listened along" } });
  assert.equal(along.body.reaction.official, false);

  assert.equal((await call("reactions", "POST", { token: sam, body: { pickId: pick.id, text: "   " } })).statusCode, 400);
  assert.equal((await call("reactions", "POST", { token: sam, body: { pickId: pick.id, text: "x".repeat(2001) } })).statusCode, 400);
  assert.equal((await call("reactions", "PATCH", { token: eric, body: { id: official.body.reaction.id, text: "No" } })).statusCode, 403);
  const edited = await call("reactions", "PATCH", { token: sam, body: { id: official.body.reaction.id, text: "Loved all of it." } });
  assert.equal(edited.body.reaction.text, "Loved all of it.");
  assert.equal(edited.body.reaction.official, true);

  // Changing the listener moves the official mark.
  await call("picks", "PATCH", { token: eric, body: { id: pick.id, listenerId: null } });
  let read = await call("clubs", "GET", { query: { id } });
  assert.deepEqual(read.body.reactions.map((r) => r.official), [false, false]);
  await call("picks", "PATCH", { token: eric, body: { id: pick.id, listenerId: samId } });
  read = await call("clubs", "GET", { query: { id } });
  assert.deepEqual(read.body.reactions.map((r) => r.official), [true, false]);

  // Authors and the admin delete; others can't.
  assert.equal((await call("reactions", "DELETE", { token: sam, query: { id: along.body.reaction.id } })).statusCode, 403);
  assert.equal((await call("reactions", "DELETE", { token: eric, query: { id: official.body.reaction.id } })).statusCode, 204);
});

test("rate-limits writes per club", async () => {
  const { call, clock } = await setup();
  const { eric } = await club(call);
  const post = () => call("picks", "POST", { token: eric, body: { picks: [{ album: album("A", "B") }] } });
  // The join in club() counted once.
  for (let i = 1; i < WRITE_LIMITS.clubMinute.limit; i++) assert.equal((await post()).statusCode, 201);
  const limited = await post();
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers["retry-after"], "60");
  clock.now += 60_000;
  assert.equal((await post()).statusCode, 201);
});

test("rate-limits creating clubs per address", async () => {
  const { call } = await setup();
  const create = (ip) =>
    call("clubs", "POST", { body: { name: "A", memberName: "E" }, headers: { "x-forwarded-for": ip } });
  for (let i = 0; i < WRITE_LIMITS.addressHour.limit; i++) assert.equal((await create("1.2.3.4")).statusCode, 201);
  assert.equal((await create("1.2.3.4")).statusCode, 429);
  assert.equal((await create("5.6.7.8")).statusCode, 201);
});

test("write windows reset once expired", async () => {
  const db = await memoryDb();
  const rule = { limit: 2, windowMs: 1000 };
  assert.equal(await allowWrite(db, "b", rule, 0), true);
  assert.equal(await allowWrite(db, "b", rule, 500), true);
  assert.equal(await allowWrite(db, "b", rule, 999), false);
  assert.equal(await allowWrite(db, "b", rule, 1000), true);
});

test("validation helpers", () => {
  assert.equal(cleanDate("2014-01-05").value, "2014-01-05");
  assert.ok(cleanDate("2014-1-5").error);
  assert.ok(cleanDate("1899-12-31").error);
  assert.equal(cleanText("a\u0007b", 10, "T").value, "ab");
  assert.equal(cleanText("", 10, "T").value, null);
  assert.equal(nameKey("  Eric   Lusk "), "eric lusk");
  const pick = cleanPick({ album: { artist: "A", title: "B" } }, { now: Date.UTC(2020, 0, 2) }).value;
  assert.deepEqual(pick, {
    date: "2020-01-02",
    kind: "plain",
    album: { key: null, artist: "A", title: "B" },
    listenerId: null,
    answers: null,
    reason: null,
  });
  assert.deepEqual(cleanPick({ reason: "" }, { partial: true }).value, { reason: null });
});
