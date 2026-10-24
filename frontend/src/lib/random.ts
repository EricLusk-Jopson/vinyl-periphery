/**
 * `count` different items picked at random (a partial Fisher-Yates shuffle).
 * Returns every item, shuffled, when there are fewer than `count`.
 */
export const pickRandom = <T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] => {
  const pool = [...items];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
};
