import React, { useState, useEffect } from "react";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReleaseCard } from "./ReleaseCard";

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

  return (
    <section className="w-full bg-bg-primary bg-opacity-40 p-4 sm:p-lg">
      <span className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-4 mb-6">
        <h2 className="font-primary text-base sm:text-xl tracking-normal text-text-primary w-9/12">
          <span className="line-clamp-1">{search.searchParams.album}</span>
        </h2>
        <h2 className="font-primary text-base sm:text-xl tracking-normal text-text-primary whitespace-nowrap">
          {count} Matches
        </h2>
      </span>
      <div className="flex flex-col p-2 sm:p-md gap-2">
        {currentReleases.length > 0 ? (
          currentReleases.map((release) => (
            <ReleaseCard release={release} search={search} key={release.id} />
          ))
        ) : (
          <p className="text-center text-text-secondary">No releases found</p>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={currentPage === 1}
            className="px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center">{renderPageButtons()}</div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Page info */}
      <div className="text-center text-text-secondary text-xs mt-2">
        {releases.length > 0 && (
          <>
            Showing {indexOfFirstItem + 1}-
            {Math.min(indexOfLastItem, releases.length)} of {releases.length}{" "}
            releases
          </>
        )}
      </div>
    </section>
  );
};
