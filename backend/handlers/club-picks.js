import { ID } from "../clubs/ids.js";
import { clubRoute, fail, valid } from "../clubs/route.js";
import {
  addPicks,
  deletePick,
  getClubRow,
  getPick,
  maxRound,
  memberIds,
  pickRounds,
  updatePick,
} from "../clubs/store.js";
import { cleanPick, LIMITS } from "../clubs/validate.js";
import { queryString } from "./http.js";

/**
 * /api/club-picks (writes carry `Authorization: Bearer <member token>`)
 *
 * POST { picks: [...], round? }: one round of picks. Without `round` they
 * start a new round after the last; with one (at most the next) they join
 * it. Each pick: date (default today), pickerId (default you; someone else
 * only if you're admin), listenerId, kind, album { key?, artist, title },
 * answers (any pick in an earlier round), reason.
 *
 * The club's format only decides what the form offers; the server takes any
 * pick of this shape, so history in any format imports as is.
 *
 * PATCH { id, ...fields }: edits a pick (not its round or picker). DELETE
 * ?id=…: removes it with its reactions; picks that answered it then answer
 * nothing. Both for the picker and the admin.
 */

const isAdmin = async (db, member) => String((await getClubRow(db, member.clubId)).admin_id) === member.id;

/** Checks picker, listener and answers against the club. */
async function checkLinks(db, clubId, picks, round) {
  const members = await memberIds(db, clubId);
  for (const pick of picks) {
    if (pick.pickerId && !members.has(pick.pickerId)) fail(400, "The picker isn't in this club");
    if (pick.listenerId && !members.has(pick.listenerId)) fail(400, "The listener isn't in this club");
  }
  const answered = [...new Set(picks.map((pick) => pick.answers).filter(Boolean))];
  const rounds = await pickRounds(db, clubId, answered);
  for (const id of answered) {
    if (!rounds.has(id)) fail(400, "A pick answers one that isn't in this club");
    if (rounds.get(id) >= round) fail(400, "A pick can only answer one from an earlier round");
  }
}

async function editable(ctx, id) {
  const me = await ctx.member();
  const pick = typeof id === "string" && ID.test(id) ? await getPick(ctx.db, id) : null;
  if (!pick || pick.clubId !== me.clubId) fail(404, "No such pick");
  if (pick.pickerId !== me.id && !(await isAdmin(ctx.db, me))) {
    fail(403, "Only the picker or the admin can change a pick");
  }
  return { me, pick };
}

export const createClubPicksHandler = (deps) =>
  clubRoute(
    ["POST", "PATCH", "DELETE"],
    async (ctx) => {
      const { req, res, db, body, now } = ctx;

      if (req.method === "POST") {
        const me = await ctx.member();
        if (!Array.isArray(body.picks) || body.picks.length === 0) fail(400, "A round needs at least one pick");
        if (body.picks.length > LIMITS.picksPerRound) fail(400, `A round has at most ${LIMITS.picksPerRound} picks`);
        const picks = body.picks.map((raw) => valid(cleanPick(raw, { now })));
        const admin = await isAdmin(db, me);
        for (const pick of picks) {
          pick.pickerId ??= me.id;
          if (pick.pickerId !== me.id && !admin) fail(403, "Only the admin can add picks for someone else");
        }
        const last = await maxRound(db, me.clubId);
        let round = null;
        if (body.round !== undefined) {
          if (!Number.isInteger(body.round) || body.round < 1 || body.round > last + 1) {
            fail(400, `Round must be between 1 and ${last + 1}`);
          }
          round = body.round;
        }
        await checkLinks(db, me.clubId, picks, round ?? last + 1);
        await ctx.clubWrite(me.clubId);
        res.status(201).json({ picks: await addPicks(db, me.clubId, picks, round, now) });
        return;
      }

      if (req.method === "PATCH") {
        const { pick } = await editable(ctx, body.id);
        const { id: _id, ...fields } = body;
        const patch = valid(cleanPick(fields, { partial: true, now }));
        if (patch.answers === pick.id) fail(400, "A pick can't answer itself");
        await checkLinks(db, pick.clubId, [patch], pick.round);
        await ctx.clubWrite(pick.clubId);
        res.status(200).json({ pick: await updatePick(db, pick, patch, now) });
        return;
      }

      const { pick } = await editable(ctx, queryString(req.query?.id));
      await ctx.clubWrite(pick.clubId);
      await deletePick(db, pick);
      res.status(204).end();
    },
    deps,
  );

export default createClubPicksHandler();
