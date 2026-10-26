import {
  backLink,
  fromLocation,
  libraryPath,
  legacyResultParams,
  libraryTab,
  resultParams,
  resultPath,
} from "./routes";

describe("resultPath", () => {
  it("names the album in the query", () => {
    expect(resultPath({ artist: " AC/DC ", album: "Back in Black & Blue" })).toBe(
      "/results?artist=AC%2FDC&album=Back+in+Black+%26+Blue",
    );
  });

  it("round-trips through resultParams", () => {
    const params = { artist: "Sigur Rós", album: "( )" };
    expect(resultParams(resultPath(params).split("?")[1])).toEqual(params);
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
    expect(legacyResultParams("Talk Talk-Spirit of Eden-1700000000000")).toEqual(
      { artist: "Talk Talk", album: "Spirit of Eden" },
    );
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
    expect(fromLocation("/results", "?artist=a&album=b")).toEqual({ from: "home" });
  });
});
