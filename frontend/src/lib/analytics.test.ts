import {
  buildPayload,
  isOptedOut,
  hasNoTrackCookie,
  noTrackCookie,
  joinWithin,
  pageName,
  secondsSince,
  track,
} from "./analytics";

describe("pageName", () => {
  it("groups paths into pages", () => {
    expect(pageName("/")).toBe("home");
    expect(pageName("/library")).toBe("library");
    expect(pageName("/results")).toBe("results");
    expect(pageName("/results/Talk%20Talk-Spirit-1")).toBe("results");
    expect(pageName("/elsewhere")).toBe("other");
  });
});

describe("secondsSince", () => {
  it("rounds to whole seconds and never goes negative", () => {
    expect(secondsSince(1000, 62_600)).toBe(62);
    expect(secondsSince(5000, 1000)).toBe(0);
  });
});

describe("joinWithin", () => {
  it("joins with | and keeps only whole values that fit", () => {
    expect(joinWithin([])).toBe("");
    expect(joinWithin(["Other", "Compiled By"])).toBe("Other|Compiled By");
    expect(joinWithin(["abc", "def", "ghi"], 8)).toBe("abc|def");
    expect(joinWithin(["toolongvalue", "ab"], 5)).toBe("");
  });
});

describe("isOptedOut", () => {
  it("respects Global Privacy Control and Do Not Track", () => {
    expect(isOptedOut({ globalPrivacyControl: true })).toBe(true);
    expect(isOptedOut({ doNotTrack: "1" })).toBe(true);
    expect(isOptedOut({ doNotTrack: "0" })).toBe(false);
    expect(isOptedOut({})).toBe(false);
  });
});

describe("buildPayload", () => {
  it("puts the event, properties and context together", () => {
    expect(
      buildPayload(
        "search_started",
        { artist: "Talk Talk" },
        { path: "/", referrer: "", screenWidth: 390, sessionId: "abc" },
      ),
    ).toEqual({
      event: "search_started",
      properties: { artist: "Talk Talk" },
      path: "/",
      referrer: "",
      screenWidth: 390,
      sessionId: "abc",
    });
  });
});

describe("track", () => {
  const nav = navigator as Navigator & { sendBeacon?: unknown };
  const original = nav.sendBeacon;

  afterEach(() => {
    Object.defineProperty(nav, "sendBeacon", { value: original, configurable: true });
  });

  it("sends a JSON beacon to /api/event", async () => {
    const calls: [string, Blob][] = [];
    Object.defineProperty(nav, "sendBeacon", {
      value: (url: string, data: Blob) => {
        calls.push([url, data]);
        return true;
      },
      configurable: true,
    });

    track("result_opened", { rank: 3 });

    expect(calls).toHaveLength(1);
    const [url, blob] = calls[0];
    expect(url).toBe("/api/event");
    expect(blob.type).toBe("application/json");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const payload = JSON.parse(text);
    expect(payload.event).toBe("result_opened");
    expect(payload.properties).toEqual({ rank: 3 });
    expect(payload.path).toBe("/");
    expect(typeof payload.sessionId).toBe("string");
  });

  it("never throws, even when sending fails", () => {
    Object.defineProperty(nav, "sendBeacon", {
      value: () => {
        throw new Error("blocked");
      },
      configurable: true,
    });
    expect(() => track("page_view")).not.toThrow();
  });
});

describe("the no-tracking cookie", () => {
  it("is found among other cookies, only when set to 1", () => {
    expect(hasNoTrackCookie("a=b; vp_no_track=1; c=d")).toBe(true);
    expect(hasNoTrackCookie("vp_no_track=1")).toBe(true);
    expect(hasNoTrackCookie("vp_no_track=")).toBe(false);
    expect(hasNoTrackCookie("xvp_no_track=1")).toBe(false);
    expect(hasNoTrackCookie("")).toBe(false);
  });

  it("stops every event while set", () => {
    const beacon = jest.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    document.cookie = noTrackCookie(true, false);
    track("page_view");
    expect(beacon).not.toHaveBeenCalled();
    document.cookie = noTrackCookie(false, false);
    track("page_view");
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("is set for 400 days on the whole site, and cleared at once", () => {
    expect(noTrackCookie(true, true)).toBe(
      "vp_no_track=1; Path=/; Max-Age=34560000; SameSite=Lax; Secure",
    );
    expect(noTrackCookie(false, false)).toBe(
      "vp_no_track=; Path=/; Max-Age=0; SameSite=Lax",
    );
  });
});
