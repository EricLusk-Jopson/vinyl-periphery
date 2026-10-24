import { useEffect, useState } from "react";

/**
 * Returns `value`, but keeps returning the last non-null value for `ms` after
 * it becomes null, so content can fade out instead of vanishing.
 */
export const useLingering = <T>(value: T | null, ms: number): T | null => {
  const [last, setLast] = useState(value);

  useEffect(() => {
    if (value !== null) {
      setLast(value);
      return;
    }
    const timer = setTimeout(() => setLast(null), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return value ?? last;
};
