import React, { useState, useEffect } from "react";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReleaseCard } from "./ReleaseCard";
import { AlbumCover } from "../search/AlbumCover";

export const ReleaseList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { releases, count } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Reset to page 1 when searchId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchId]);

  if (!search) return null;

  // Calculate pagination indices
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentReleases = releases.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(releases.length / itemsPerPage);

  // Page change handlers
  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Generate page buttons
  const renderPageButtons = () => {
    // Only show a limited number of page buttons to avoid cluttering the UI
    const maxButtonsToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtonsToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxButtonsToShow - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxButtonsToShow) {
      startPage = Math.max(1, endPage - maxButtonsToShow + 1);
    }

    const pageButtons = [];

    // Add first page button if not visible
    if (startPage > 1) {
      pageButtons.push(
        <Button
          key="first"
          variant="ghost"
          size="sm"
          onClick={() => goToPage(1)}
          className="px-2 sm:px-3"
        >
          1
        </Button>
      );

      // Add ellipsis if there's a gap
      if (startPage > 2) {
        pageButtons.push(
          <span key="ellipsis1" className="px-1">
            ...
          </span>
        );
      }
    }

    // Add page number buttons
    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "ghost"}
          size="sm"
          onClick={() => goToPage(i)}
          className="px-2 sm:px-3"
        >
          {i}
        </Button>
      );
    }

    // Add last page button if not visible
    if (endPage < totalPages) {
      // Add ellipsis if there's a gap
      if (endPage < totalPages - 1) {
        pageButtons.push(
          <span key="ellipsis2" className="px-1">
            ...
          </span>
        );
      }

      pageButtons.push(
        <Button
          key="last"
          variant="ghost"
          size="sm"
          onClick={() => goToPage(totalPages)}
          className="px-2 sm:px-3"
        >
          {totalPages}
        </Button>
      );
    }

    return pageButtons;
  };

  const contributorCount = Object.keys(search.contributors).length;

  return (
    <section aria-labelledby="results-heading" className="w-full">
      <div className="flex flex-col gap-6 pb-8 pt-4 sm:flex-row sm:items-end md:pb-12 md:pt-10">
        <AlbumCover
          src={search.thumb}
          title={search.searchParams.album}
          className="glow-deep h-20 w-20 text-sm md:h-[120px] md:w-[120px]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="type-title type-album">
            <p>{search.searchParams.artist}</p>
            <h1 id="results-heading" className="text-muted-foreground">
              {search.searchParams.album}
            </h1>
          </div>
          <p className="text-[15px] font-semibold">
            <span className="mr-1.5 font-mono text-xs font-normal uppercase tracking-[0.5px] text-muted-foreground">
              Credits
            </span>
            {contributorCount}
            <span className="ml-4 mr-1.5 font-mono text-xs font-normal uppercase tracking-[0.5px] text-muted-foreground">
              Connected albums
            </span>
            {count}
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-4 border-t py-3">
        <h2 className="text-[15px] font-semibold">
          {count} {count === 1 ? "album" : "albums"}{" "}
          <span className="text-muted-foreground">sorted by shared credits</span>
        </h2>
      </div>

      {currentReleases.length > 0 ? (
        <ol className="border-b">
          {currentReleases.map((release, i) => (
            <ReleaseCard
              key={release.id}
              rank={indexOfFirstItem + i + 1}
              release={release}
              search={search}
            />
          ))}
        </ol>
      ) : (
        <p className="border-t py-12 text-[15px] font-semibold">
          No albums match.{" "}
          <span className="text-muted-foreground">
            Loosen the filters to see more.
          </span>
        </p>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Pages"
          className="mt-6 flex items-center justify-center gap-1"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="px-2"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="flex items-center">{renderPageButtons()}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="px-2"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}

      {releases.length > 0 && (
        <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
          {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, releases.length)}{" "}
          of {releases.length}
        </p>
      )}
    </section>
  );
};
