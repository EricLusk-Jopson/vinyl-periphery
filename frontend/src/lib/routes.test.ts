import {
  backLink,
  fromLocation,
  libraryPath,
  legacyResultParams,
  resultParams,
  resultPath,
  resultTarget,
  stackPath,
  stackView,
} from "./routes";
import { searchTarget } from "./searchTarget";

describe("resultPath", () => {
  it("names the album in the query", () => {
    expect(
      resultPath({ artist: " AC/DC ", album: "Back in Black & Blue" }),
    ).toBe("/results?artist=AC%2FDC&album=Back+in+Black+%26+Blue");
  });

  it("round-trips through resultParams", () => {
    const params = { artist: "Sigur Rós", album: "( )" };
    expect(resultParams(resultPath(params).split("?")[1])).toEqual(params);
  });
});

describe("resultTarget", () => {
  const params = { artist: "Bon Iver", album: "Bon Iver" };

  it("adds the album id and round-trips it", () => {
    const master = searchTarget("master", 51539);
    const path = resultPath(params, master);
    expect(path).toBe("/results?artist=Bon+Iver&album=Bon+Iver&master=51539");
    const query = path.split("?")[1];
    expect(resultTarget(query)).toEqual(master);
    expect(resultParams(query)).toEqual(params);
    expect(
      resultTarget(
        resultPath(params, searchTarget("release", 7)).split("?")[1],
      ),
    ).toEqual(searchTarget("release", 7));
  });

  it("is null for text-only and malformed links", () => {
    expect(resultTarget(resultPath(params).split("?")[1])).toBeNull();
    expect(resultTarget("?artist=a&album=b&master=abc")).toBeNull();
    expect(resultTarget("?master=-3")).toBeNull();
  });
});

describe("resultParams", () => {
  it("needs both an artist and an album", () => {
    expect(resultParams("?artist=Talk+Talk&album=Spirit+of+Eden")).toEqual({
      artist: "Talk Talk",
      album: "Spirit of Eden",
    });
    expect(resultParams("?artist=Talk+Talk")).toBeNull();
    expect(resultParams("?artist=+&album=Spirit")).toBeNull();
    expect(resultParams("")).toBeNull();
  });
});

describe("legacyResultParams", () => {
  it("reads old ids that split one way", () => {
    expect(
      legacyResultParams("Talk Talk-Spirit of Eden-1700000000000"),
    ).toEqual({ artist: "Talk Talk", album: "Spirit of Eden" });
  });

  it("gives up on hyphenated names and odd ids", () => {
    expect(legacyResultParams("Jay-Z-The Blueprint-1700000000000")).toBeNull();
    expect(legacyResultParams("Talk Talk-Spirit of Eden")).toBeNull();
    expect(legacyResultParams("junk")).toBeNull();
  });
});

describe("libraryPath", () => {
  it("is one page", () => {
    expect(libraryPath()).toBe("/library");
  });
});

describe("backLink", () => {
  it("goes back to the library, whatever tab older state names", () => {
    expect(backLink({ from: "library" })).toEqual({
      to: "/library",
      label: "Back to library",
    });
    expect(backLink({ from: "library", tab: "saved" }).to).toBe("/library");
  });

  it("goes to the library otherwise, including with no or odd state", () => {
    const library = { to: "/library", label: "Back to library" };
    expect(backLink({ from: "home" })).toEqual(library);
    expect(backLink(null)).toEqual(library);
    expect(backLink(undefined)).toEqual(library);
    expect(backLink("junk")).toEqual(library);
  });

  it("goes to the search's stack when it wasn't opened from one", () => {
    const stack = { to: "/library/stack/s%201", label: "Back to stack" };
    expect(backLink({ from: "home" }, "s 1")).toEqual(stack);
    expect(backLink(null, "s 1")).toEqual(stack);
    // Opened from the library or another stack: back there.
    expect(backLink({ from: "library" }, "s 1").to).toBe("/library");
    expect(backLink({ from: "stack", stackId: "s 2" }, "s 1").to).toBe(
      "/library/stack/s%202",
    );
  });
});

describe("fromLocation", () => {
  it("names the library, and anything else as home", () => {
    expect(fromLocation("/library")).toEqual({ from: "library" });
    expect(fromLocation("/")).toEqual({ from: "home" });
    expect(fromLocation("/results")).toEqual({
      from: "home",
    });
  });
});

describe("stack routes", () => {
  const stackId = "Volcano Choir-Unmap-1700000000000";

  it("encodes the stack id and round-trips through fromLocation", () => {
    const path = stackPath(stackId);
    expect(path).toBe("/library/stack/Volcano%20Choir-Unmap-1700000000000");
    expect(fromLocation(path)).toEqual({ from: "stack", stackId });
  });

  it("sends results opened from a stack back to it", () => {
    expect(backLink({ from: "stack", stackId })).toEqual({
      to: stackPath(stackId),
      label: "Back to stack",
    });
  });

  it("puts the Results tab in the query and leaves Albums bare", () => {
    expect(stackPath(stackId, "albums")).toBe(stackPath(stackId));
    const results = stackPath(stackId, "results");
    expect(results).toBe(
      "/library/stack/Volcano%20Choir-Unmap-1700000000000?view=results",
    );
    expect(fromLocation(results)).toEqual({ from: "stack", stackId });
  });

  it("reads the tab from the query, defaulting to Albums", () => {
    expect(stackView("?view=results")).toBe("results");
    expect(stackView("")).toBe("albums");
    expect(stackView("?view=other")).toBe("albums");
  });
});
