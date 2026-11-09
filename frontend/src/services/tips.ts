/**
 * One-time tips, dismissed for good (per browser) with "Got it". Kept in
 * localStorage; blocked storage shows a tip until it's dismissed this
 * session.
 */

export const TIPS_STORAGE_KEY = "vinyl-periphery-tips";

export type TipId = "search-from-result";

const session = new Set<TipId>();
const listeners = new Set<() => void>();

const read = (): TipId[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TIPS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Whether the tip has been dismissed. */
export const tipDismissed = (id: TipId): boolean =>
  session.has(id) || read().includes(id);

/** Dismisses the tip for good. */
export const dismissTip = (id: TipId): void => {
  session.add(id);
  try {
    const seen = read();
    if (!seen.includes(id)) {
      localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify([...seen, id]));
    }
  } catch {
    // Blocked storage: dismissed until the page reloads.
  }
  listeners.forEach((l) => l());
};

export const subscribeTips = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
