import { DISCOGS_ROLES } from "./discogsRoles";
import {
  groupRoles,
  ROLE_CATEGORIES,
  roleCategory,
  RoleCategory,
  uncategorizedRoles,
} from "./roleCategories";
import { defaultRolePipeline } from "./roleProcessor";

describe("roleCategory: Discogs's own names", () => {
  it("puts every role on Discogs's credits list under its heading", () => {
    for (const [category, names] of Object.entries(DISCOGS_ROLES)) {
      for (const name of names) {
        // As Discogs sends it, and as the role pipeline cleans it.
        expect([name, roleCategory(name)]).toEqual([name, category]);
        const cleaned = defaultRolePipeline([name])[0];
        if (cleaned)
          expect([cleaned, roleCategory(cleaned)]).toEqual([cleaned, category]);
      }
    }
  });

  it("has a heading for every category, each in display order once", () => {
    expect(ROLE_CATEGORIES.map((c) => c.id).sort()).toEqual(
      Object.keys(DISCOGS_ROLES).sort(),
    );
  });

  // A few by hand, from each heading.
  const cases: [string, RoleCategory][] = [
    ["Lead Vocals", "vocals"],
    ["Rap", "vocals"],
    ["Drums", "instruments"],
    ["Pedal Steel Guitar", "instruments"],
    ["Tenor Saxophone", "instruments"],
    ["Drum Programming", "instruments"],
    ["Turntables", "instruments"],
    ["Featuring", "featuring"],
    ["Conductor", "conducting"],
    ["Written-By", "writing"],
    ["Programmed By", "writing"],
    ["Co-producer", "production"],
    ["Executive Producer", "production"],
    ["Compiled By", "production"],
    ["Remix", "remix"],
    ["DJ Mix", "djmix"],
    ["Mixed By", "technical"],
    ["Lacquer Cut By", "technical"],
    ["Photography By", "visual"],
    ["Artwork By", "visual"],
    ["Liner Notes", "spoken"],
    ["A&R", "management"],
    ["Vocal Coach", "management"],
    ["Other", "other"],
  ];
  it.each(cases)("puts %s in %s", (role, category) => {
    expect(roleCategory(role)).toBe(category);
  });
});

describe("roleCategory: credits written other ways", () => {
  const cases: [string, RoleCategory][] = [
    // Bracketed notes and hyphens don't matter.
    ["Photography By [Cover]", "visual"],
    ["Executive-Producer", "production"],
    ["Co Producer", "production"],
    // The ending names the role.
    ["Strings Arranged By", "writing"],
    ["Guitar Technician", "technical"],
    ["Assistant Engineer", "technical"],
    ["Additional Vocals", "vocals"],
    ["Associate Producer", "production"],
    // Singular or plural.
    ["Guitars", "instruments"],
    ["Keyboard", "instruments"],
    // Common words.
    ["Tenor Sax", "instruments"],
    ["Keys", "instruments"],
    ["Mastering", "technical"],
    // A comma list: the first that matches.
    ["Producer, Engineer", "production"],
    // Parenthesised parts are optional, but never steal a name.
    ["Tar", "instruments"],
    ["Adapted By", "writing"],
    ["Adapted By (Text)", "spoken"],
    // Nothing matches.
    ["Party", "other"],
  ];
  it.each(cases)("puts %s in %s", (role, category) => {
    expect(roleCategory(role)).toBe(category);
  });
});

describe("groupRoles", () => {
  it("groups in display order and leaves out empty buckets", () => {
    const groups = groupRoles(
      ["Design", "Guitar", "Producer", "Vocals", "Drums"],
      (role) => role,
    );
    expect(groups.map((g) => [g.id, g.items])).toEqual([
      ["vocals", ["Vocals"]],
      ["instruments", ["Guitar", "Drums"]],
      ["production", ["Producer"]],
      ["visual", ["Design"]],
    ]);
  });
});

describe("uncategorizedRoles", () => {
  it("lists unmatched roles once each, sorted", () => {
    expect(uncategorizedRoles(["Other", "Guitar", "Party", "Other"])).toEqual([
      "Other",
      "Party",
    ]);
  });
});
