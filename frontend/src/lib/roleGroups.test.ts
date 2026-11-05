import { AWKWARD_ROLES } from "./__fixtures__/awkwardRoles";
import {
  creditGroups,
  otherShare,
  primaryGroup,
  roleGroup,
  splitRoles,
} from "./roleGroups";

describe("role groups", () => {
  it.each(AWKWARD_ROLES)("maps %s", (credit, groups) => {
    expect(creditGroups(credit)).toEqual(groups);
  });

  it("splits lists and drops brackets", () => {
    expect(splitRoles("Drums [Uncredited], Percussion ,  ")).toEqual([
      "Drums",
      "Percussion",
    ]);
    expect(roleGroup("Mixed By")).toBe("engineering");
  });

  it("picks a person's primary group by priority, band from sources", () => {
    const person = (roles: string[], sources = ["credits"]) =>
      ({ roles, sources }) as Parameters<typeof primaryGroup>[0];
    expect(primaryGroup(person(["Vocals"], ["artist"]))).toBe("band");
    expect(primaryGroup(person(["Guitar"], ["member", "credits"]))).toBe(
      "band",
    );
    expect(primaryGroup(person(["Guitar", "Producer"]))).toBe("production");
    expect(primaryGroup(person(["Mastered By", "Drums"]))).toBe("engineering");
    expect(primaryGroup(person(["Design", "Drums"]))).toBe("session");
    expect(primaryGroup(person(["Photography By"]))).toBe("art");
    expect(primaryGroup(person([]))).toBe("other");
  });

  it("measures how much lands in other (the mapping audit)", () => {
    const credits = AWKWARD_ROLES.map(([credit]) => credit);
    // 3 of the fixture's 28 roles are other on purpose.
    expect(otherShare(credits)).toBeCloseTo(3 / 28);
    expect(otherShare([])).toBe(0);
  });
});
