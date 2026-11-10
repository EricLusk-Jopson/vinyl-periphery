import { useMemo } from "react";
import { useCache } from "@/contexts/cache/CacheContext";
import { LibraryStack, libraryStacks } from "@/lib/stacks";

/** Every stack, with its albums found in the library (newest first). */
export const useLibraryStacks = (): LibraryStack[] => {
  const { stacks, searches, savedSearchIds } = useCache();
  return useMemo(
    () => libraryStacks(stacks, searches, savedSearchIds),
    [stacks, searches, savedSearchIds],
  );
};
