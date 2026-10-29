/**
 * Buckets for Discogs credit roles, so whole groups (management, artwork and
 * packaging) can be switched off at once.
 *
 * Loosely follows the groups on Discogs's credits list
 * (https://www.discogs.com/help/creditslist): Instruments, Vocals and
 * Conducting are "musicians"; Production, Technical and Remix are "audio",
 * except lacquer cutting, which makes the record and so is "physical";
 * Visual is "physical"; Management, Companies and Crew are "management".
 * Roles nothing here matches fall into "other", and those are reported with
 * `search_completed` (`roles_uncategorized`) so the patterns can grow.
 */

export type RoleCategory =
  | "musicians"
  | "writing"
  | "audio"
  | "physical"
  | "management"
  | "other";

/** Display order. */
export const ROLE_CATEGORIES: { id: RoleCategory; label: string }[] = [
  { id: "musicians", label: "Musicians" },
  { id: "writing", label: "Writing" },
  { id: "audio", label: "Audio" },
  { id: "physical", label: "Physical media" },
  { id: "management", label: "Management" },
  { id: "other", label: "Other" },
];

const words = (list: string[]) =>
  new RegExp(`\\b(?:${list.join("|")})\\b`, "i");

/**
 * Checked in this order, first match wins. Management comes first so
 * "Executive Producer" and "Guitar Technician" aren't read as audio or
 * musicians; writing before audio and musicians so "Strings Arranged By" is
 * writing; audio before physical so "Sound Design" is audio.
 */
const PATTERNS: [RoleCategory, RegExp][] = [
  [
    "management",
    words([
      "management",
      "manager",
      "managed",
      "executive",
      "a&r",
      "a & r",
      "coordinator",
      "coordination",
      "co ordinator",
      "booking",
      "legal",
      "lawyer",
      "promotion",
      "publicity",
      "marketing",
      "copyright",
      "licensed",
      "administration",
      "contractor",
      "tour",
      "crew",
      "technician",
      "tech",
      "roadie",
      "road crew",
      "stylist",
      "hair",
      "make up",
      "makeup",
      "wardrobe",
      "catering",
      "security",
      "liaison",
      "sponsor",
      "thanks",
    ]),
  ],
  [
    "writing",
    words([
      "written",
      "writer",
      "writers",
      "songwriter",
      "composed",
      "composer",
      "composition",
      "lyrics",
      "lyricist",
      "words",
      "music by",
      "arranged",
      "arranger",
      "arrangement",
      "arrangements",
      "orchestrated",
      "orchestration",
      "libretto",
      "score",
      "adapted",
      "songs by",
    ]),
  ],
  [
    "audio",
    words([
      "producer",
      "produced",
      "production",
      "co producer",
      "engineer",
      "engineered",
      "engineering",
      "mixed",
      "mix",
      "mixing",
      "mastered",
      "mastering",
      "remastered",
      "remastering",
      "recorded",
      "recording",
      "remix",
      "remixed",
      "edited",
      "edit",
      "editing",
      "programmed",
      "programming",
      "sound",
      "overdub",
      "overdubbed",
      "transfer",
      "restoration",
      "tape op",
      "tape",
      "audio",
      "dj",
      "sequenced",
      "sampled",
      "samples",
    ]),
  ],
  [
    "physical",
    words([
      // Cutting the lacquer (or DMM copper) makes the physical record.
      "lacquer",
      "cut",
      "cutting",
      "dmm",
      "photography",
      "photographer",
      "photo",
      "photos",
      "design",
      "designed",
      "designer",
      "art",
      "artwork",
      "cover",
      "sleeve",
      "illustration",
      "illustrations",
      "illustrated",
      "layout",
      "painting",
      "paintings",
      "drawing",
      "drawings",
      "typography",
      "lettering",
      "calligraphy",
      "graphics",
      "graphic",
      "logo",
      "liner notes",
      "notes",
      "booklet",
      "packaging",
      "image",
      "images",
      "text",
      "translated",
      "concept",
    ]),
  ],
  [
    "musicians",
    words([
      "vocals?",
      "voice",
      "vocalist",
      "singer",
      "choir",
      "chorus",
      "backing",
      "rap",
      "rapper",
      "mc",
      "beatbox",
      "whistl\\w*",
      "guitars?",
      "bass",
      "drums?",
      "drummer",
      "percussion",
      "piano",
      "keyboards?",
      "keys",
      "synth\\w*",
      "organ",
      "hammond",
      "rhodes",
      "wurlitzer",
      "clavinet",
      "mellotron",
      "moog",
      "harpsichord",
      "celesta",
      "sax\\w*",
      "trumpet",
      "trombone",
      "horns?",
      "flugelhorn",
      "cornet",
      "tuba",
      "brass",
      "woodwinds?",
      "flute",
      "clarinet",
      "oboe",
      "bassoon",
      "recorder",
      "harmonica",
      "violin",
      "viola",
      "cello",
      "fiddle",
      "strings",
      "double bass",
      "contrabass",
      "harp",
      "banjo",
      "mandolin",
      "ukulele",
      "dobro",
      "steel",
      "sitar",
      "tabla",
      "congas",
      "bongos",
      "timpani",
      "vibraphone",
      "vibes",
      "marimba",
      "xylophone",
      "glockenspiel",
      "tambourine",
      "cymbals?",
      "shaker",
      "handclaps",
      "accordion",
      "bandoneon",
      "concertina",
      "melodica",
      "kalimba",
      "didgeridoo",
      "bagpipes",
      "theremin",
      "electronics",
      "sampler",
      "turntables",
      "scratches",
      "instruments?",
      "musician",
      "performer",
      "soloist",
      "featuring",
      "conductor",
      "conducted",
      "leader",
      "concertmaster",
      "orchestra",
      "ensemble",
      "band",
    ]),
  ],
];

/** The bucket a role belongs to. Expects a role after `defaultRolePipeline`. */
export const roleCategory = (role: string): RoleCategory => {
  const text = role.replace(/[-–—]/g, " ");
  for (const [category, pattern] of PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return "other";
};

/** Roles grouped by bucket, in display order, empty buckets left out. */
export const groupRoles = <T>(
  items: T[],
  roleOf: (item: T) => string,
): { id: RoleCategory; label: string; items: T[] }[] =>
  ROLE_CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((item) => roleCategory(roleOf(item)) === c.id),
  })).filter((group) => group.items.length > 0);

/** Roles no pattern matches, sorted, for `roles_uncategorized`. */
export const uncategorizedRoles = (roles: Iterable<string>): string[] =>
  Array.from(new Set(roles))
    .filter((role) => roleCategory(role) === "other")
    .sort((a, b) => a.localeCompare(b));
