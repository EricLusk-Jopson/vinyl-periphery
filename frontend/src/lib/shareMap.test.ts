import { MAP_SIZES, relax } from "./shareMap";

describe("relax", () => {
  const overlaps = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    side: number,
  ) => Math.abs(a.x - b.x) < side && Math.abs(a.y - b.y) < side;

  it("pushes covers off each other and the centre, inside the circle", () => {
    const side = MAP_SIZES[1];
    // Five covers wanting the same spot.
    const ideal = Array.from({ length: 5 }, () => ({ x: 0.5, y: 0, side }));
    const placed = relax(ideal, MAP_SIZES.centre);
    for (let i = 0; i < placed.length; i++) {
      expect(Math.hypot(placed[i].x, placed[i].y)).toBeLessThanOrEqual(
        1 - side / 2 + 1e-9,
      );
      expect(
        overlaps(placed[i], { x: 0, y: 0 }, (side + MAP_SIZES.centre) / 2),
      ).toBe(false);
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlaps(placed[i], placed[j], side)).toBe(false);
      }
    }
    // The same input lands the same way every time.
    expect(relax(ideal, MAP_SIZES.centre)).toEqual(placed);
  });
});
