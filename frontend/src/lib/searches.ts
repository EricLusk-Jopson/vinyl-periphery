import { SearchCache } from "@/contexts/cache/types";

/**
 * When a search ran. Search ids end in `-<Date.now()>`; anything without a
 * parsable suffix sorts as oldest.
 */
export const searchStartedAt = (searchId: string): number => {
  const timestamp = Number(searchId.slice(searchId.lastIndexOf("-") + 1));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

/** Searches newest first, at most `limit` of them. */
export const recentSearches = (
  searches: Record<string, SearchCache>,
  limit: number
): SearchCache[] =>
  Object.values(searches)
    .sort((a, b) => searchStartedAt(b.searchId) - searchStartedAt(a.searchId))
    .slice(0, limit);

/**
 * A cover URL worth showing, or "" when there is none. Discogs sends an empty
 * string or a 1px `spacer.gif` when a release has no image.
 */
export const usableImageUrl = (url: string | null | undefined): string => {
  const trimmed = url?.trim() ?? "";
  if (!/^https?:\/\//i.test(trimmed)) return "";
  if (/\/spacer\.gif(?:[?#]|$)/i.test(trimmed)) return "";
  return trimmed;
};

/** The thumbnail for a search result, falling back to the full cover. */
export const coverUrl = (
  result: { thumb?: string; cover_image?: string } | undefined
): string =>
  usableImageUrl(result?.thumb) || usableImageUrl(result?.cover_image);

/** Up to two initials for a cover placeholder: "Spirit of Eden" -> "SE". */
export const titleInitials = (title: string): string => {
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const significant = words.filter(
    (word) => !STOP_WORDS.has(word.toLowerCase())
  );
  const picked = significant.length > 0 ? significant : words;
  return picked
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
};

const STOP_WORDS = new Set(["a", "an", "and", "of", "the"]);
