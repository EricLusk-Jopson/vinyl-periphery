/**
 * Cover placement shared by the share maps: sizes on the unit circle, and
 * `relax`, which pushes overlapping covers apart while keeping them in (or
 * just outside) the circle. Used by the map of one search (`albumMap.ts`).
 */

/** Cover sides, as fractions of the circle's radius. */
export const MAP_SIZES = { centre: 0.46, 1: 0.28, 2: 0.36 } as const;
/** Room kept between covers, as a fraction of the radius. */
const GAP = 0.03;

/** Steps at the end of `relax` that only push covers apart. */
const SETTLE = 120;

/** Where a cover outside the circle sits: just past it. */
const outerRadius = (side: number) => 1 + GAP + side / 2;

/**
 * Pushes overlapping covers apart while each is pulled back toward its
 * place, keeping every cover inside the circle. The centre cover stays put.
 * The last SETTLE steps only push, so the pull can't leave covers
 * overlapping.
 * Deterministic: the same albums always land in the same places.
 */
export const relax = (
  ideal: Array<{ x: number; y: number; side: number; outer?: boolean }>,
  centreSide: number,
  iterations = 300,
): Array<{ x: number; y: number }> => {
  const points = ideal.map((p) => ({ ...p }));
  const all = [{ x: 0, y: 0, side: centreSide, fixed: true }, ...points];
  // Inside covers stay in the circle; outside ones stay on their ring
  // just past it, sliding around it.
  const inside = (p: {
    x: number;
    y: number;
    side: number;
    outer?: boolean;
  }) => {
    const length = Math.hypot(p.x, p.y) || 1;
    const limit = p.outer ? outerRadius(p.side) : 1 - p.side / 2;
    if (p.outer || length > limit) {
      p.x *= limit / length;
      p.y *= limit / length;
    }
  };
  for (let step = 0; step < iterations; step++) {
    const settling = step >= iterations - SETTLE;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const reach = (a.side + b.side) / 2 + GAP;
        const overlapX = reach - Math.abs(dx);
        const overlapY = reach - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (dx === 0 && dy === 0) {
          // Same spot: split them along a direction fixed by their order.
          dx = Math.cos(j * 2.399963);
          dy = Math.sin(j * 2.399963);
        }
        // Along the axis that needs the shorter move.
        const alongX = overlapX < overlapY;
        const move = (alongX ? overlapX : overlapY) / 2;
        const sign = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
        const aFixed = "fixed" in a;
        const shareA = aFixed ? 0 : 1;
        const shareB = aFixed ? 2 : 1;
        if (settling) {
          // Settling: apart along the line between them, so covers held
          // at the circle's edge can slide around it instead of jamming.
          const length = Math.hypot(dx, dy);
          const ux = dx / length;
          const uy = dy / length;
          const push = move + 0.002;
          a.x -= ux * push * shareA;
          a.y -= uy * push * shareA;
          b.x += ux * push * shareB;
          b.y += uy * push * shareB;
        } else if (alongX) {
          a.x -= sign * move * shareA;
          b.x += sign * move * shareB;
        } else {
          a.y -= sign * move * shareA;
          b.y += sign * move * shareB;
        }
      }
    }
    const pull = step < iterations - SETTLE ? 0.02 : 0;
    points.forEach((p, i) => {
      p.x += (ideal[i].x - p.x) * pull;
      p.y += (ideal[i].y - p.y) * pull;
      inside(p);
    });
  }
  return points.map(({ x, y }) => ({ x, y }));
};
