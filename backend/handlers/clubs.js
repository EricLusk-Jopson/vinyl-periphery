import { newClubId, CLUB_ID } from "../clubs/ids.js";
import { clubRoute, fail, valid } from "../clubs/route.js";
import { createClub, getClubRow, readClub, toClub, updateClub, bearer, memberForToken } from "../clubs/store.js";
import { cleanFormat, cleanLine, LIMITS } from "../clubs/validate.js";
import { queryString } from "./http.js";

/**
 * /api/clubs
 *
 * GET ?id=…: the club with its members, picks and reactions. The id is the
 * invite secret, so anyone with the link can read (the honour system). With
 * a valid token for this club, `you` is the caller's member id.
 *
 * POST { name, format, memberName }: a new club, its first member (the
 * admin) and that member's token. Limited per address.
 *
 * PATCH { id, name?, format? }: rename or change format; admin only.
 */
export const createClubsHandler = (deps) =>
  clubRoute(
    ["GET", "POST", "PATCH"],
    async (ctx) => {
      const { req, res, db, body, now } = ctx;
      if (req.method === "GET") {
        const id = queryString(req.query?.id);
        if (!CLUB_ID.test(id)) fail(404, "No such club");
        const club = await readClub(db, id);
        if (!club) fail(404, "No such club");
        const you = await memberForToken(db, bearer(req.headers));
        res.status(200).json({ ...club, ...(you?.clubId === id ? { you: you.id } : {}) });
        return;
      }

      if (req.method === "POST") {
        const name = valid(cleanLine(body.name, LIMITS.clubName, "Club name"));
        const format = valid(cleanFormat(body.format ?? "handoff"));
        const memberName = valid(cleanLine(body.memberName, LIMITS.memberName, "Your name"));
        await ctx.addressWrite();
        const id = newClubId();
        const { token, memberId } = await createClub(db, { id, name, format, memberName }, now);
        res.status(201).json({
          club: { id, name, format, adminId: memberId, createdAt: now },
          member: { id: memberId, clubId: id, name: memberName, joinedAt: now },
          token,
        });
        return;
      }

      const member = await ctx.member();
      if (body.id !== member.clubId) fail(403, "Not your club");
      const row = await getClubRow(db, member.clubId);
      if (String(row.admin_id) !== member.id) fail(403, "Only the club's admin can change it");
      const name = body.name === undefined ? null : valid(cleanLine(body.name, LIMITS.clubName, "Club name"));
      const format = body.format === undefined ? null : valid(cleanFormat(body.format));
      await ctx.clubWrite(member.clubId);
      await updateClub(db, member.clubId, { name, format });
      res.status(200).json({ club: toClub(await getClubRow(db, member.clubId)) });
    },
    deps,
  );

export default createClubsHandler();
