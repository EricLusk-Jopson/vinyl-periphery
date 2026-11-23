import { CLUB_ID, ID } from "../clubs/ids.js";
import { clubRoute, fail, valid } from "../clubs/route.js";
import {
  addMember,
  findMemberByName,
  getClubRow,
  getMember,
  issueToken,
  renameMember,
} from "../clubs/store.js";
import { cleanLine, LIMITS } from "../clubs/validate.js";

/**
 * /api/club-members
 *
 * POST { clubId, name }: joins as a new member; 409 if the name is taken
 * (the client then offers to choose it). POST { clubId, memberId }: chooses
 * an existing member, as on a new phone. Either way the answer carries a
 * new token. Anyone with the club id may do either: the honour system.
 *
 * PATCH { memberId?, name }: renames yourself, or anyone if you're admin.
 */
export const createClubMembersHandler = (deps) =>
  clubRoute(
    ["POST", "PATCH"],
    async (ctx) => {
      const { req, res, db, body, now } = ctx;
      if (req.method === "POST") {
        const clubId = typeof body.clubId === "string" ? body.clubId : "";
        if (!CLUB_ID.test(clubId) || !(await getClubRow(db, clubId))) fail(404, "No such club");
        await ctx.addressWrite();

        if (body.memberId !== undefined) {
          const member = typeof body.memberId === "string" && ID.test(body.memberId)
            ? await getMember(db, body.memberId)
            : null;
          if (!member || member.clubId !== clubId) fail(404, "No such member");
          const token = await issueToken(db, member, now);
          res.status(200).json({ member, token });
          return;
        }

        const name = valid(cleanLine(body.name, LIMITS.memberName, "Name"));
        const existing = await findMemberByName(db, clubId, name);
        if (existing) {
          res.status(409).json({ error: "That name is taken. Choose it if it's you", member: existing });
          return;
        }
        await ctx.clubWrite(clubId);
        const joined = await addMember(db, clubId, name, now);
        res.status(201).json(joined);
        return;
      }

      const me = await ctx.member();
      const targetId = body.memberId ?? me.id;
      if (targetId !== me.id) {
        const club = await getClubRow(db, me.clubId);
        if (String(club.admin_id) !== me.id) fail(403, "You can only rename yourself");
      }
      const target = typeof targetId === "string" && ID.test(targetId) ? await getMember(db, targetId) : null;
      if (!target || target.clubId !== me.clubId) fail(404, "No such member");
      const name = valid(cleanLine(body.name, LIMITS.memberName, "Name"));
      const existing = await findMemberByName(db, me.clubId, name);
      if (existing && existing.id !== target.id) fail(409, "That name is taken");
      await ctx.clubWrite(me.clubId);
      await renameMember(db, target.id, name);
      res.status(200).json({ member: { ...target, name } });
    },
    deps,
  );

export default createClubMembersHandler();
