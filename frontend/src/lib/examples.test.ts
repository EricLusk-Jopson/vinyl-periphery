import {
  charsThatFit,
  displayLength,
  exampleLabel,
  pickMobileExamples,
} from "./examples";

const layout = { rowWidth: 358, fontSize: 14, chipInset: 30, gap: 8 };

const albums = [
  { artist: "Can", album: "Tago Mago" }, // 15
  { artist: "Radiohead", album: "Kid A" }, // 17
  { artist: "Talk Talk", album: "Spirit of Eden" }, // 26
  { artist: "Pink Floyd", album: "The Dark Side of the Moon" }, // 38
  {
    artist: "David Bowie",
    album: "The Rise and Fall of Ziggy Stardust and The Spiders From Mars",
  },
];

describe("charsThatFit", () => {
  it("divides the text width by the average character width", () => {
    // (358 - 30) / (14 * 0.58) = 40.4
    expect(charsThatFit(358, layout)).toBe(40);
    // Half a 390px row: (175 - 30) / 8.12 = 17.9
    expect(charsThatFit(175, layout)).toBe(17);
  });

  it("scales with the font size and never goes negative", () => {
    expect(charsThatFit(358, { ...layout, fontSize: 21 })).toBe(26);
    expect(charsThatFit(20, layout)).toBe(0);
  });
});

describe("displayLength", () => {
  it("counts Chinese, Japanese and Korean characters as two", () => {
    expect(displayLength("Can · Tago Mago")).toBe(15);
    expect(displayLength("椎名林檎 · 勝訴")).toBe(15);
    expect(displayLength("Sigur Rós")).toBe(9);
  });
});

describe("pickMobileExamples", () => {
  const each = () => 0;

  it("picks one wide example and a pair that each fit half a row", () => {
    const { wide, pair } = pickMobileExamples(albums, layout, each);
    expect(wide && exampleLabel(wide).length).toBeGreaterThan(17);
    expect(wide && exampleLabel(wide).length).toBeLessThanOrEqual(40);
    expect(pair).toHaveLength(2);
    pair.forEach((a) => expect(exampleLabel(a).length).toBeLessThanOrEqual(17));
  });

  it("never offers a wide example longer than a row", () => {
    for (let i = 0; i < 20; i++) {
      const { wide } = pickMobileExamples(albums, layout);
      expect(wide?.artist).not.toBe("David Bowie");
    }
  });

  it("offers fewer when the screen is narrow", () => {
    const narrow = { ...layout, rowWidth: 288 }; // 320px phone
    const { wide, pair } = pickMobileExamples(albums, narrow, each);
    // Half a row fits 13 characters, shorter than any of these albums.
    expect(pair).toHaveLength(0);
    expect(wide).not.toBeNull();
  });
});
