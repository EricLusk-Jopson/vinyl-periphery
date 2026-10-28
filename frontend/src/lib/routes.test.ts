import {
  backLink,
  fromLocation,
  libraryPath,
  legacyResultParams,
  libraryTab,
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

describe("library tabs", () => {
  it("round-trips the tab through the query", () => {
    expect(libraryPath()).toBe("/library");
    expect(libraryPath("saved")).toBe("/library?tab=saved");
    expect(libraryTab("?tab=saved")).toBe("saved");
    expect(libraryTab("")).toBe("session");
    expect(libraryTab("?tab=nonsense")).toBe("session");
  });
});

describe("backLink", () => {
  it("goes back to the library tab the result came from", () => {
    expect(backLink({ from: "library", tab: "saved" })).toEqual({
      to: "/library?tab=saved",
      label: "Back to library",
    });
    expect(backLink({ from: "library", tab: "session" }).to).toBe("/library");
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
  it("names the library with its tab, and anything else as home", () => {
    expect(fromLocation("/library", "?tab=saved")).toEqual({
      from: "library",
      tab: "saved",
    });
    expect(fromLocation("/", "")).toEqual({ from: "home" });
    expect(fromLocation("/results", "?artist=a&album=b")).toEqual({
      from: "home",
    });
  });
});

describe("stack routes", () => {
  const stackId = "Volcano Choir-Unmap-1700000000000";

  it("encodes the stack id and round-trips through fromLocation", () => {
    const path = stackPath(stackId);
    expect(path).toBe("/library/stack/Volcano%20Choir-Unmap-1700000000000");
    expect(fromLocation(path, "")).toEqual({ from: "stack", stackId });
  });

  it("sends results opened from a stack back to it", () => {
    expect(backLink({ from: "stack", stackId })).toEqual({
      to: stackPath(stackId),
      label: "Back to stack",
    });
  });
});
