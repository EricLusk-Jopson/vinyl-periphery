import {
  CREDITS_STORAGE_KEY,
  MAX_ENTRIES,
  readCredits,
  writeCredits,
} from "./creditsCache";

const credits = (releaseId: number) => ({
  releaseId,
  fromMainRelease: false,
  credits: { 1: [{ role: "Producer" }] },
});

describe("creditsCache", () => {
  beforeEach(() => localStorage.clear());

  it("reads back what it wrote", () => {
    writeCredits("release:1", credits(1));
    expect(readCredits("release:1")).toEqual(credits(1));
    expect(readCredits("master:1")).toBeUndefined();
  });

  it("drops the oldest entries past the limit", () => {
    for (let i = 0; i <= MAX_ENTRIES; i++) {
      writeCredits(`release:${i}`, credits(i), localStorage, i);
    }
    expect(readCredits("release:0")).toBeUndefined();
    expect(readCredits("release:1")).toEqual(credits(1));
    expect(readCredits(`release:${MAX_ENTRIES}`)).toEqual(credits(MAX_ENTRIES));
  });

  it("survives bad or blocked storage", () => {
    localStorage.setItem(CREDITS_STORAGE_KEY, "not json");
    expect(readCredits("release:1")).toBeUndefined();
    writeCredits("release:1", credits(1));
    expect(readCredits("release:1")).toEqual(credits(1));

    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readCredits("release:1", blocked)).toBeUndefined();
    expect(() => writeCredits("release:1", credits(1), blocked)).not.toThrow();
  });
});
