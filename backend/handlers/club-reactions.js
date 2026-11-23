import { ID } from "../clubs/ids.js";
import { clubRoute, fail, valid } from "../clubs/route.js";
import {
  addReaction,
  deleteReaction,
  getClubRow,
  getPick,
  getReaction,
  updateReaction,
} from "../clubs/store.js";
import { cleanText, LIMITS } from "../clubs/validate.js";
import { queryString } from "./http.js";

/**
 * /api/club-reactions (writes carry the member token)
 *
 * POST { pickId, text }: a reaction from you. It's official when you are
 * the pick's assigned listener. Any pick takes reactions, imported or not.
 * No ratings: text only.
 *
 * PATCH { id, text }: edits your own. DELETE ?id=…: yours, or any as admin.
 */
const readId = (raw) => (typeof raw === "string" && ID.test(raw) ? raw : null);

export const createClubReactionsHandler = (deps) =>
  clubRoute(
    ["POST", "PATCH", "DELETE"],
    async (ctx) => {
      const { req, res, db, body, now } = ctx;
      const me = await ctx.member();

      if (req.method === "POST") {
        const id = readId(body.pickId);
        const pick = id ? await getPick(db, id) : null;
        if (!pick || pick.clubId !== me.clubId) fail(404, "No such pick");
        const text = valid(cleanText(body.text, LIMITS.reaction, "Reaction", { required: true }));
        await ctx.clubWrite(me.clubId);
        res.status(201).json({ reaction: await addReaction(db, { ...pick, clubId: me.clubId }, me.id, text, now) });
        return;
      }

      const id = readId(req.method === "PATCH" ? body.id : queryString(req.query?.id));
      const reaction = id ? await getReaction(db, id) : null;
      if (!reaction || reaction.clubId !== me.clubId) fail(404, "No such reaction");

      if (req.method === "PATCH") {
        if (reaction.memberId !== me.id) fail(403, "You can only edit your own reactions");
        const text = valid(cleanText(body.text, LIMITS.reaction, "Reaction", { required: true }));
        await ctx.clubWrite(me.clubId);
        res.status(200).json({ reaction: await updateReaction(db, id, text, now) });
        return;
      }

      if (reaction.memberId !== me.id) {
        const club = await getClubRow(db, me.clubId);
        if (String(club.admin_id) !== me.id) fail(403, "Only its author or the admin can delete a reaction");
      }
      await ctx.clubWrite(me.clubId);
      await deleteReaction(db, id);
      res.status(204).end();
    },
    deps,
  );

export default createClubReactionsHandler();
