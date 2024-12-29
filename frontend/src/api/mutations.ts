import { useMutation } from "@tanstack/react-query";
import { DiscogsSearchResponse } from "./types";

interface SearchParams {
  artist: string;
  album: string;
}

async function releaseSearch({ artist, album }: SearchParams) {
  const response = await fetch(
    `/api/search?band=${encodeURIComponent(artist)}&album=${encodeURIComponent(
      album
    )}`
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data: DiscogsSearchResponse = await response.json();
  return data.results || null;
}

export function useReleaseSearch() {
  return useMutation({
    mutationFn: releaseSearch,
  });
}
