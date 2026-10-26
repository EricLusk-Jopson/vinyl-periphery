import { SearchCache } from "@/contexts/cache/types";
import { discogsWebUrl } from "./results";

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
  limit: number,
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
  result: { thumb?: string; cover_image?: string } | undefined,
): string =>
  usableImageUrl(result?.thumb) || usableImageUrl(result?.cover_image);

/**
 * The Discogs page for a searched album: its master when it has one, so the
 * link isn't tied to one pressing, else the top matching release.
 */
export const albumDiscogsUrl = (
  result: { master_url?: string | null; resource_url?: string } | undefined,
): string | null =>
  discogsWebUrl(result?.master_url ?? undefined) ??
  discogsWebUrl(result?.resource_url);

/**
 * Where a library card links on Discogs. Searches saved before the album's
 * page was stored link to a Discogs search for it instead.
 */
export const searchDiscogsUrl = (
  search: Pick<SearchCache, "discogsUrl" | "searchParams">,
): string => {
  if (search.discogsUrl) return search.discogsUrl;
  const { artist, album } = search.searchParams;
  const q = encodeURIComponent(`${artist} ${album}`.trim());
  return `https://www.discogs.com/search/?q=${q}&type=all`;
};

/** Up to two initials for a cover placeholder: "Spirit of Eden" -> "SE". */
export const titleInitials = (title: string): string => {
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const significant = words.filter(
    (word) => !STOP_WORDS.has(word.toLowerCase()),
  );
  const picked = significant.length > 0 ? significant : words;
  return picked
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
};

const STOP_WORDS = new Set(["a", "an", "and", "of", "the"]);

/**
 * "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a
 * date ("12 Mar", with the year once it isn't this year).
 */
export const timeAgo = (
  timestamp: number,
  now: number = Date.now(),
): string => {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

const normalise = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Ids of stored searches for the same artist and album, ignoring case and
 * extra spaces. A new run of the same search replaces these.
 */
export const sameSearchIds = (
  searches: Record<string, SearchCache>,
  params: { artist: string; album: string },
): string[] => {
  const artist = normalise(params.artist);
  const album = normalise(params.album);
  return Object.values(searches)
    .filter(
      (s) =>
        normalise(s.searchParams.artist) === artist &&
        normalise(s.searchParams.album) === album,
    )
    .map((s) => s.searchId);
};
