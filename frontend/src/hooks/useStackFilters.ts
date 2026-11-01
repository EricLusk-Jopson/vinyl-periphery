import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/services/db";
import {
  defaultStackFilters,
  StackFilterState,
  withStackDefaults,
} from "@/lib/stackFilters";

const SAVE_DELAY_MS = 400;

export interface StackFilters {
  filters: StackFilterState;
  /** Read from IndexedDB (or found missing). */
  loaded: boolean;
  update: (updates: Partial<StackFilterState>) => void;
  replace: (filters: StackFilterState) => void;
}

/**
 * A stack's Results tab filters, kept per stack id in IndexedDB and
 * written as they settle. A stack with nothing stored starts with
 * everything on. The cache deletes them once the stack is fewer than two
 * searches.
 */
export const useStackFilters = (stackId: string): StackFilters => {
  const [filters, setFilters] = useState<StackFilterState>(defaultStackFilters);
  const [loaded, setLoaded] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(filters);
  const dirty = useRef(false);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    db.getStackFilters<Partial<StackFilterState>>(stackId)
      .then((stored) => {
        if (!live) return;
        const next = withStackDefaults(stored);
        latest.current = next;
        setFilters(next);
      })
      .catch(() => {
        // Storage blocked: start fresh, and changes last for the visit.
      })
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [stackId]);

  // Write any change still waiting when the stack changes or the page goes.
  useEffect(
    () => () => {
      clearTimeout(pending.current);
      if (dirty.current) {
        dirty.current = false;
        db.saveStackFilters(stackId, latest.current).catch(() => {});
      }
    },
    [stackId],
  );

  const save = useCallback(
    (next: StackFilterState) => {
      latest.current = next;
      dirty.current = true;
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        dirty.current = false;
        db.saveStackFilters(stackId, next).catch(() => {});
      }, SAVE_DELAY_MS);
    },
    [stackId],
  );

  const replace = useCallback(
    (next: StackFilterState) => {
      setFilters(next);
      save(next);
    },
    [save],
  );

  const update = useCallback(
    (updates: Partial<StackFilterState>) =>
      replace({ ...latest.current, ...updates }),
    [replace],
  );

  return { filters, loaded, update, replace };
};
