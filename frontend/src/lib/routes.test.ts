import {
  backLink,
  fromLocation,
  libraryPath,
  libraryTab,
  resultPath,
} from "./routes";

describe("resultPath", () => {
  it("encodes the search id", () => {
    expect(resultPath("AC/DC-Back in Black-1700000000000")).toBe(
      "/results/AC%2FDC-Back%20in%20Black-1700000000000",
    );
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
    expect(fromLocation("/results/x", "")).toEqual({ from: "home" });
  });
});
