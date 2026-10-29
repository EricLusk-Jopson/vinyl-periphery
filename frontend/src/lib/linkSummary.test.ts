import { linkGroups, linkSummary } from "./linkSummary";

const person = (id: number, ...roles: string[]) => ({ id, roles });

describe("linkSummary", () => {
  it("names the roles when every link is in one category", () => {
    // The Yo La Tengo case: one person, who cut the lacquer.
    expect(linkSummary([person(1, "Lacquer Cut By")])).toBe(
      "via Lacquer Cut By",
    );
    expect(linkSummary([person(1, "Drums"), person(2, "Bass", "Drums")])).toBe(
      "via Drums, Bass",
    );
  });

  it("counts people per category, in filter order, Other by its roles", () => {
    expect(
      linkSummary([
        person(1, "Mixed By"),
        person(2, "Guitar", "Producer"),
        person(3, "Vocals"),
        person(4, "Presenter"),
        person(5, "Liner Notes"),
      ]),
    ).toBe("via Musicians (2) · Audio (2) · Physical media (1) · Presenter");
  });

  it("cuts long role lists short", () => {
    expect(
      linkSummary([person(1, "Drums", "Bass", "Guitar", "Piano", "Organ")]),
    ).toBe("via Drums, Bass, Guitar +2");
  });

  it("falls back to a count with no roles known", () => {
    expect(linkSummary([person(1)])).toBe("via 1 contributor");
    expect(linkSummary([person(1), person(2)])).toBe("via 2 contributors");
  });

  it("groups by category with people counted once each", () => {
    expect(
      linkGroups([person(1, "Guitar", "Bass"), person(2, "Guitar")]),
    ).toEqual([
      {
        category: "musicians",
        label: "Musicians",
        people: 2,
        roles: ["Guitar", "Bass"],
      },
    ]);
  });
});
