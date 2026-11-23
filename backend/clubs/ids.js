import { createHash, randomBytes } from "node:crypto";

/** Club ids double as the invite secret: 144 random bits. */
export const newClubId = () => randomBytes(18).toString("base64url");

/** Member, pick and reaction ids: only unique, not secret. */
export const newId = () => randomBytes(9).toString("base64url");

/** Member tokens: 256 random bits. Only their hash is stored. */
export const newToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export const CLUB_ID = /^[A-Za-z0-9_-]{24}$/;
export const ID = /^[A-Za-z0-9_-]{12}$/;
export const TOKEN = /^[A-Za-z0-9_-]{43}$/;
