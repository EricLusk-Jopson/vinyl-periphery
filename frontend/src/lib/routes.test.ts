import {
  backLink,
  fromLocation,
  libraryPath,
  legacyResultParams,
  resultParams,
  resultPath,
  resultTarget,
  stackPath,
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

  it("goes home otherwise, including with no or odd state", () => {
    const home = { to: "/", label: "Back to home" };
    expect(backLink({ from: "home" })).toEqual(home);
    expect(backLink(null)).toEqual(home);
    expect(backLink(undefined)).toEqual(home);
    expect(backLink("junk")).toEqual(home);
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
});
