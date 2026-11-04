import { useEffect, useState } from "react";

/** A result to bring into view: `at` changes on each request. */
export interface ResultFocus {
  key: string;
  at: number;
}

/**
 * Shows a result asked for from elsewhere (the People view): makes sure
 * enough rows are shown to include it, opens it, scrolls it to the middle
 * of the screen and outlines it for a moment. Returns the key outlined.
 */
export const useFocusResult = (
  focus: ResultFocus | undefined,
  keys: string[],
  pageSize: number,
  show: (visible: (current: number) => number) => void,
  open: (key: string) => void,
): string | null => {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  useEffect(() => {
    if (!focus) return;
    const index = keys.indexOf(focus.key);
    if (index < 0) return;
    show((current) =>
      Math.max(current, Math.ceil((index + 1) / pageSize) * pageSize),
    );
    open(focus.key);
    setHighlighted(focus.key);
    // After the rows render.
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(
          `[data-result-key="${CSS.escape(focus.key)}"]`,
        );
        row?.scrollIntoView({ block: "center", behavior: "smooth" });
        row?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      }),
    );
    const clear = setTimeout(() => setHighlighted(null), 2400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(clear);
    };
    // Only a new request moves the list; `keys` follows the filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, focus?.at]);
  return highlighted;
};
