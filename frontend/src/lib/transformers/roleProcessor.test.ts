import { createSingleStringTransformer, createPipeline } from "./processor";
import { defaultRolePipeline } from "./roleProcessor";

describe("Role Processing Pipeline", () => {
  // Individual transformer tests
  describe("removeBracketContent", () => {
    const removeBracketContent = createSingleStringTransformer((role) => {
      let result = role;
      let previousResult;
      do {
        previousResult = result;
        result = result.replace(/\[[^[\]]*\]/g, "");
      } while (result !== previousResult);
      return result;
    });

    const pipeline = createPipeline([removeBracketContent]);

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
    const trimWhitespace = createSingleStringTransformer((role) => role.trim());
    const pipeline = createPipeline([trimWhitespace]);

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
    const replaceHyphensWithSpaces = createSingleStringTransformer((role) =>
      role.replace(/[-–—]/g, " ").replace(/\s+/g, " ")
    );
    const pipeline = createPipeline([replaceHyphensWithSpaces]);

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
    const capitalizeAfterSpace = createSingleStringTransformer((role) => {
      const result = role.charAt(0).toUpperCase() + role.slice(1);
      return result.replace(/\s+[a-z]/g, (match) => match.toUpperCase());
    });
    const pipeline = createPipeline([capitalizeAfterSpace]);

    it("capitalizes words after spaces", () => {
      expect(pipeline(["lead guitar"])).toEqual(["Lead Guitar"]);
    });

    it("handles multiple words", () => {
      expect(pipeline(["rhythm and bass guitar"])).toEqual([
        "Rhythm And Bass Guitar",
      ]);
    });

    it("preserves existing capitalization", () => {
      expect(pipeline(["Lead Guitar"])).toEqual(["Lead Guitar"]);
    });

    it("handles multiple spaces", () => {
      expect(pipeline(["drums  and  percussion"])).toEqual([
        "Drums  And  Percussion",
      ]);
    });
  });

  describe("splitCommaDelimited", () => {
    const splitCommaDelimited = (roles: string[]): string[] =>
      roles.flatMap((role) => role.split(",").map((r) => r.trim()));
    const pipeline = createPipeline([splitCommaDelimited]);

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
    const removeEmptyRoles = (roles: string[]): string[] =>
      roles.filter((role) => role.trim().length > 0);
    const pipeline = createPipeline([removeEmptyRoles]);

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
    const removeDuplicates = (roles: string[]): string[] =>
      Array.from(new Set(roles));
    const pipeline = createPipeline([removeDuplicates]);

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

  describe("defaultRolePipeline", () => {
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

      expect(defaultRolePipeline(input).sort()).toEqual(expected.sort());
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

      expect(defaultRolePipeline(input).sort()).toEqual(expected.sort());
    });
  });

  describe("createPipeline", () => {
    it("allows custom transformer combinations", () => {
      const customPipeline = createPipeline([
        createSingleStringTransformer((role) => role.toLowerCase()),
        (roles) => Array.from(new Set(roles)),
      ]);

      const input = ["Guitar", "BASS", "Guitar"];
      expect(customPipeline(input)).toEqual(["guitar", "bass"]);
    });
  });
});
