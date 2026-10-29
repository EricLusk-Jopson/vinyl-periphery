import {
  groupRoles,
  roleCategory,
  RoleCategory,
  uncategorizedRoles,
} from "./roleCategories";
import { defaultRolePipeline } from "./roleProcessor";

// Common Discogs credits, as they look after defaultRolePipeline.
const cases: [string, RoleCategory][] = [
  ["Guitar", "musicians"],
  ["Lead Vocals", "musicians"],
  ["Backing Vocals", "musicians"],
  ["Bass Guitar", "musicians"],
  ["Drums", "musicians"],
  ["Tenor Saxophone", "musicians"],
  ["Synthesizer", "musicians"],
  ["Keyboards", "musicians"],
  ["Pedal Steel Guitar", "musicians"],
  ["Conductor", "musicians"],
  ["Featuring", "musicians"],
  ["Written By", "writing"],
  ["Lyrics By", "writing"],
  ["Music By", "writing"],
  ["Composed By", "writing"],
  ["Arranged By", "writing"],
  ["Strings Arranged By", "writing"],
  ["Producer", "audio"],
  ["Co Producer", "audio"],
  ["Engineer", "audio"],
  ["Recorded By", "audio"],
  ["Mixed By", "audio"],
  ["Mastered By", "audio"],
  ["Lacquer Cut By", "physical"],
  ["DMM Cut By", "physical"],
  ["Remix", "audio"],
  ["Programmed By", "audio"],
  ["Sound Design", "audio"],
  ["Photography By", "physical"],
  ["Design", "physical"],
  ["Art Direction", "physical"],
  ["Artwork", "physical"],
  ["Cover", "physical"],
  ["Illustration", "physical"],
  ["Liner Notes", "physical"],
  ["Layout", "physical"],
  ["Management", "management"],
  ["Executive Producer", "management"],
  ["A&R", "management"],
  ["Coordinator", "management"],
  ["Guitar Technician", "management"],
  ["Product Manager", "management"],
  ["Legal", "management"],
  ["Other", "other"],
  ["Compiled By", "other"],
];

describe("roleCategory", () => {
  it.each(cases)("puts %s in %s", (role, category) => {
    expect(roleCategory(role)).toBe(category);
  });

  it("reads raw Discogs roles once they go through the pipeline", () => {
    const roles = defaultRolePipeline([
      "Written-By",
      "Photography By [Cover]",
      "Executive-Producer",
    ]);
    expect(roles.map(roleCategory)).toEqual([
      "writing",
      "physical",
      "management",
    ]);
  });

  it("matches whole words only", () => {
    // "Recorder" is an instrument; "Recorded By" is audio.
    expect(roleCategory("Recorder")).toBe("musicians");
    expect(roleCategory("Recorded By")).toBe("audio");
    // "art" is not inside "Party".
    expect(roleCategory("Party")).toBe("other");
  });
});

describe("groupRoles", () => {
  it("groups in display order and leaves out empty buckets", () => {
    const groups = groupRoles(
      ["Design", "Guitar", "Producer", "Drums"],
      (role) => role,
    );
    expect(groups.map((g) => [g.id, g.items])).toEqual([
      ["musicians", ["Guitar", "Drums"]],
      ["audio", ["Producer"]],
      ["physical", ["Design"]],
    ]);
  });
});

describe("uncategorizedRoles", () => {
  it("lists unmatched roles once each, sorted", () => {
    expect(
      uncategorizedRoles(["Other", "Guitar", "Compiled By", "Other"]),
    ).toEqual(["Compiled By", "Other"]);
  });
});
