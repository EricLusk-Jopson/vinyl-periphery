import {
  defaultPipeline,
  createPipeline,
  createSingleRoleTransformer,
} from "./roleProcessor";

describe("Role Processing Pipeline", () => {
  // Individual transformer tests
  describe("removeBracketContent", () => {
    const pipeline = createPipeline([
      createSingleRoleTransformer((role) => role.replace(/\[.*?\]/g, "")),
    ]);

    it("removes content within square brackets", () => {
      expect(pipeline(["Vocals [lead]"])).toEqual(["Vocals "]);
    });

    it("removes multiple bracketed contents", () => {
      expect(pipeline(["Guitar [lead] [rhythm]"])).toEqual(["Guitar  "]);
    });

    it("handles nested brackets correctly", () => {
      expect(pipeline(["Bass [Session [Winter 1969]]"])).toEqual(["Bass "]);
    });

    it("preserves roles without brackets", () => {
      expect(pipeline(["Lead Guitar"])).toEqual(["Lead Guitar"]);
    });
  });

  describe("trimWhitespace", () => {
    const pipeline = createPipeline([
      createSingleRoleTransformer((role) => role.trim()),
    ]);

    it("trims leading and trailing whitespace", () => {
      expect(pipeline(["  Vocals  "])).toEqual(["Vocals"]);
    });

    it("handles multiple spaces", () => {
      expect(pipeline(["Lead    Guitar"])).toEqual(["Lead    Guitar"]);
    });

    it("handles tabs and newlines", () => {
      expect(pipeline(["\tDrums\n"])).toEqual(["Drums"]);
    });
  });

  describe("replaceHyphensWithSpaces", () => {
    const pipeline = createPipeline([
      createSingleRoleTransformer((role) => role.replace(/[-–—]/g, " ")),
    ]);

    it("replaces standard hyphens", () => {
      expect(pipeline(["Lead-Guitar"])).toEqual(["Lead Guitar"]);
    });

    it("replaces en dashes", () => {
      expect(pipeline(["Bass–Guitar"])).toEqual(["Bass Guitar"]);
    });

    it("replaces em dashes", () => {
      expect(pipeline(["Drums—Percussion"])).toEqual(["Drums Percussion"]);
    });

    it("handles multiple hyphens", () => {
      expect(pipeline(["Rock-and-Roll-Guitar"])).toEqual([
        "Rock and Roll Guitar",
      ]);
    });
  });

  describe("capitalizeAfterSpace", () => {
    const pipeline = createPipeline([
      createSingleRoleTransformer((role) =>
        role.replace(/\s+[a-z]/g, (match) => match.toUpperCase())
      ),
    ]);

    it("capitalizes words after spaces", () => {
      expect(pipeline(["lead guitar"])).toEqual(["lead Guitar"]);
    });

    it("handles multiple words", () => {
      expect(pipeline(["rhythm and bass guitar"])).toEqual([
        "rhythm And Bass Guitar",
      ]);
    });

    it("preserves existing capitalization", () => {
      expect(pipeline(["Lead Guitar"])).toEqual(["Lead Guitar"]);
    });

    it("handles multiple spaces", () => {
      expect(pipeline(["drums  and  percussion"])).toEqual([
        "drums  And  Percussion",
      ]);
    });
  });

  describe("splitCommaDelimited", () => {
    const pipeline = createPipeline([
      (roles) => roles.flatMap((role) => role.split(",").map((r) => r.trim())),
    ]);

    it("splits comma-separated roles", () => {
      expect(pipeline(["Guitar, Bass"])).toEqual(["Guitar", "Bass"]);
    });

    it("handles multiple commas", () => {
      expect(pipeline(["Guitar, Bass, Drums"])).toEqual([
        "Guitar",
        "Bass",
        "Drums",
      ]);
    });

    it("trims whitespace after splitting", () => {
      expect(pipeline(["Guitar,   Bass,  Drums"])).toEqual([
        "Guitar",
        "Bass",
        "Drums",
      ]);
    });

    it("handles single role correctly", () => {
      expect(pipeline(["Guitar"])).toEqual(["Guitar"]);
    });

    it("handles empty parts correctly", () => {
      expect(pipeline(["Guitar,,Bass"])).toEqual(["Guitar", "", "Bass"]);
    });
  });

  describe("removeEmptyRoles", () => {
    const pipeline = createPipeline([
      (roles) => roles.filter((role) => role.length > 0),
    ]);

    it("removes empty strings", () => {
      expect(pipeline(["", "Guitar", ""])).toEqual(["Guitar"]);
    });

    it("removes whitespace-only strings", () => {
      expect(pipeline([" ", "Guitar", "  "])).toEqual(["Guitar"]);
    });

    it("preserves valid roles", () => {
      expect(pipeline(["Guitar", "Bass"])).toEqual(["Guitar", "Bass"]);
    });
  });

  describe("removeDuplicates", () => {
    const pipeline = createPipeline([(roles) => Array.from(new Set(roles))]);

    it("removes duplicate roles", () => {
      expect(pipeline(["Guitar", "Bass", "Guitar"])).toEqual([
        "Guitar",
        "Bass",
      ]);
    });

    it("preserves order of first occurrence", () => {
      expect(pipeline(["Bass", "Guitar", "Bass", "Drums"])).toEqual([
        "Bass",
        "Guitar",
        "Drums",
      ]);
    });

    it("handles case-sensitive duplicates", () => {
      expect(pipeline(["guitar", "Guitar"])).toEqual(["guitar", "Guitar"]);
    });
  });

  // Full pipeline integration tests
  describe("defaultPipeline", () => {
    it("processes complex roles correctly", () => {
      const input = [
        "Lead Vocals [backing]",
        "Guitar-Bass, Drums",
        "  Synth [live], percussion  ",
        "backing vocals",
        "Guitar-Bass", // Duplicate after processing
      ];

      const expected = [
        "Lead Vocals",
        "Guitar Bass",
        "Drums",
        "Synth",
        "Percussion",
        "Backing Vocals",
      ];

      expect(defaultPipeline(input).sort()).toEqual(expected.sort());
    });

    it("handles edge cases", () => {
      const input = [
        "[unknown]",
        "",
        "  ",
        "guitar--bass",
        "drums,,,percussion",
      ];

      const expected = ["Guitar Bass", "Drums", "Percussion"];

      expect(defaultPipeline(input).sort()).toEqual(expected.sort());
    });
  });

  // Custom pipeline creation tests
  describe("createPipeline", () => {
    it("allows custom transformer combinations", () => {
      const customPipeline = createPipeline([
        createSingleRoleTransformer((role) => role.toLowerCase()),
        (roles) => Array.from(new Set(roles)),
      ]);

      const input = ["Guitar", "BASS", "Guitar"];
      expect(customPipeline(input)).toEqual(["guitar", "bass"]);
    });
  });
});
