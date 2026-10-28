import React from "react";
import { SearchCache } from "@/contexts/cache/types";
import { useCoverArt } from "@/hooks/useCoverArt";
import { usableImageUrl } from "@/lib/searches";
import { AlbumCover } from "./AlbumCover";

interface SearchCoverProps {
  search: SearchCache;
  className?: string;
}

/**
 * A search's own cover: the art from its Discogs search result, or, when
 * there is none (searches started from a result row), the Cover Art Archive
 * art for its target.
 */
export const SearchCover: React.FC<SearchCoverProps> = ({
  search,
  className,
}) => {
  const own = usableImageUrl(search.thumb);
  const key = !own && search.target ? search.target.key : "";
  const cover = useCoverArt(key ? [key] : []);
  return (
    <AlbumCover
      src={own || (key && cover(key)) || ""}
      title={search.searchParams.album}
      className={className}
    />
  );
};
