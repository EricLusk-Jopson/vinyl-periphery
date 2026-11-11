import {
  allSelected,
  deletedToast,
  selectionLabel,
  stackedNote,
  toggleAll,
  toggled,
} from "./librarySelection";

describe("library selection", () => {
  it("toggles one album in and out", () => {
    const one = toggled(new Set(), "a");
    expect([...one]).toEqual(["a"]);
    expect([...toggled(one, "a")]).toEqual([]);
  });

  it("selects every shown album, or none once all are", () => {
    const shown = ["a", "b"];
    const all = toggleAll(new Set(["z"]), shown);
    expect([...all].sort()).toEqual(["a", "b", "z"]);
    expect(allSelected(all, shown)).toBe(true);
    // Albums filtered out of view stay selected.
    expect([...toggleAll(all, shown)]).toEqual(["z"]);
    expect(allSelected(new Set(), [])).toBe(false);
  });

  it("says how many are selected", () => {
    expect(selectionLabel(0)).toBe("Choose albums to delete");
    expect(selectionLabel(3)).toBe("3 selected");
  });

  it("notes albums in stacks", () => {
    expect(stackedNote(0)).toBeNull();
    expect(stackedNote(1)).toBe(
      "1 is in a stack. Deleted, it stays there greyed out, with Search to run it again.",
    );
    expect(stackedNote(2)).toBe(
      "2 are in stacks. Deleted, they stay there greyed out, with Search to run them again.",
    );
  });

  it("names what was deleted", () => {
    expect(deletedToast(["Cowards"])).toEqual({
      title: "Album deleted",
      description: "Cowards",
    });
    expect(deletedToast(["Cowards", "Hellfire"])).toEqual({
      title: "2 albums deleted",
      description: "Cowards and Hellfire",
    });
    expect(deletedToast(["A", "B", "C"]).description).toBe("A, B and 1 other");
    expect(deletedToast(["A", "B", "C", "D"]).description).toBe(
      "A, B and 2 others",
    );
  });
});
