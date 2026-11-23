import { useMemo } from "react";
import { useCache } from "@/contexts/cache/CacheContext";
import { LibraryArtist, libraryArtists } from "@/lib/stacks";

/** Every artist with an album in the library (latest searched first). */
export const useLibraryArtists = (): LibraryArtist[] => {
  const { searches, savedSearchIds } = useCache();
  return useMemo(
    () => libraryArtists(searches, savedSearchIds),
    [searches, savedSearchIds],
  );
};
