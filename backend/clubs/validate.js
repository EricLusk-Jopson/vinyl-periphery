// Cleans and checks what clients send. Pure: each function returns
// { value } or { error }, and never touches the database.

export const FORMATS = ["handoff", "chain"];
export const KINDS = ["similar", "wild", "plain"];

export const LIMITS = {
  clubName: 80,
  memberName: 40,
  artist: 200,
  title: 200,
  reason: 2000,
  reaction: 2000,
  picksPerRound: 4,
};

export const ALBUM_KEY = /^(master|release):[1-9][0-9]{0,9}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;

// Control characters other than tab and newline.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

const fail = (error) => ({ error });

/** A one-line name: control characters dropped, spaces collapsed. */
export function cleanLine(raw, max, label) {
  if (typeof raw !== "string") return fail(`${label} is required`);
  const value = raw.replace(CONTROL, "").replace(/\s+/g, " ").trim();
  if (!value) return fail(`${label} is required`);
  if (value.length > max) return fail(`${label} is longer than ${max} characters`);
  return { value };
}

/** Free text (reasons, reactions): newlines kept, at most two in a row. */
export function cleanText(raw, max, label, { required = false } = {}) {
  if (raw === undefined || raw === null || raw === "") {
    return required ? fail(`${label} is required`) : { value: null };
  }
  if (typeof raw !== "string") return fail(`${label} must be text`);
  const value = raw
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!value) return required ? fail(`${label} is required`) : { value: null };
  if (value.length > max) return fail(`${label} is longer than ${max} characters`);
  return { value };
}

/** Case and spacing ignored, so "eric " and "Eric" are one member. */
export const nameKey = (name) => name.toLowerCase().replace(/\s+/g, " ").trim();

export function cleanFormat(raw) {
  return FORMATS.includes(raw) ? { value: raw } : fail(`Format must be one of ${FORMATS.join(", ")}`);
}

export function cleanKind(raw) {
  return KINDS.includes(raw) ? { value: raw } : fail(`Kind must be one of ${KINDS.join(", ")}`);
}

/** A calendar date, YYYY-MM-DD. Backdated imports go back to 1900. */
export function cleanDate(raw) {
  const match = typeof raw === "string" ? DATE.exec(raw.trim()) : null;
  if (!match) return fail("Date must be YYYY-MM-DD");
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < FIRST_YEAR ||
    year > LAST_YEAR ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return fail("Date is not a real date");
  }
  return { value: match[0] };
}

export const today = (now) => new Date(now).toISOString().slice(0, 10);

/** { key?, artist, title }: a key only when it's a Discogs master or release. */
export function cleanAlbum(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Album is required");
  const artist = cleanLine(raw.artist, LIMITS.artist, "Artist");
  if (artist.error) return artist;
  const title = cleanLine(raw.title, LIMITS.title, "Title");
  if (title.error) return title;
  let key = null;
  if (raw.key !== undefined && raw.key !== null && raw.key !== "") {
    if (typeof raw.key !== "string" || !ALBUM_KEY.test(raw.key)) {
      return fail("Album key must be master:N or release:N");
    }
    key = raw.key;
  }
  return { value: { key, artist: artist.value, title: title.value } };
}

/** A body that is a JSON object, or null. */
export function readObject(body) {
  let raw = body;
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

const optionalId = (raw, label) => {
  if (raw === undefined) return { value: undefined };
  if (raw === null || raw === "") return { value: null };
  return typeof raw === "string" && /^[A-Za-z0-9_-]{12}$/.test(raw) ? { value: raw } : fail(`${label} is not an id`);
};

/**
 * The fields of a pick as sent. With `partial` (an edit), absent fields stay
 * absent and null clears an optional one; otherwise defaults fill in.
 * Whether ids belong to the club is checked against the database later.
 */
export function cleanPick(raw, { partial = false, now = Date.now() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Each pick must be an object");
  const out = {};
  const take = (field, result) => {
    if (result.error) throw result;
    if (result.value !== undefined) out[field] = result.value;
  };
  try {
    if (raw.date !== undefined || !partial) take("date", raw.date === undefined ? { value: today(now) } : cleanDate(raw.date));
    if (raw.kind !== undefined || !partial) take("kind", cleanKind(raw.kind ?? "plain"));
    if (raw.album !== undefined || !partial) take("album", cleanAlbum(raw.album));
    if (!partial) take("pickerId", optionalId(raw.pickerId, "Picker"));
    take("listenerId", optionalId(raw.listenerId, "Listener"));
    take("answers", optionalId(raw.answers, "Answers"));
    if (raw.reason !== undefined) take("reason", cleanText(raw.reason, LIMITS.reason, "Reason"));
  } catch (error) {
    return error;
  }
  if (!partial) {
    out.listenerId ??= null;
    out.answers ??= null;
    out.reason ??= null;
  }
  return { value: out };
}
