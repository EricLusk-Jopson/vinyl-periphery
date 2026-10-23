import React from "react";
import { History, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCache } from "@/contexts/cache/CacheContext";
import { ContributorList } from "../resultsDisplay/ContributorList";
import { RoleList } from "../resultsDisplay/RoleList";
import { FilterActions } from "../resultsDisplay/FilterActions";
import HistoryPanel from "../resultsDisplay/HistoryPanel";
import { Wordmark } from "./Wordmark";

const navButton =
  "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const closeButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const DrawerHeader: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="flex items-center justify-between gap-4 border-b px-4 py-2 md:px-6">
    <div>
      <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
      <SheetDescription className="sr-only">{description}</SheetDescription>
    </div>
    <SheetClose className={closeButton} aria-label={`Close ${title.toLowerCase()}`}>
      <X className="h-5 w-5" aria-hidden="true" />
    </SheetClose>
  </div>
);

export const Header: React.FC = () => {
  const { getActiveSearch } = useCache();
  const activeSearch = getActiveSearch();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-2 pl-4 md:h-16 md:px-6">
        <Wordmark />

        <nav aria-label="Main" className="flex items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className={navButton}>
                <History className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only md:not-sr-only">History</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-full flex-col gap-0 overflow-y-auto border-r bg-background p-0 sm:max-w-sm"
            >
              <DrawerHeader
                title="History"
                description="Your saved and recent searches"
              />
              <div className="px-2 pb-6 md:px-4">
                <HistoryPanel />
              </div>
            </SheetContent>
          </Sheet>

          {/* Moves into the results sidebar and a bottom sheet in phase 6. */}
          {activeSearch && (
            <Sheet>
              <SheetTrigger asChild>
                <button type="button" className={navButton}>
                  <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only">Filters</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 overflow-y-auto border-l bg-background p-0 sm:max-w-md"
              >
                <DrawerHeader
                  title="Filters"
                  description="Choose which contributors and roles count towards the results"
                />
                <div className="flex flex-col gap-4 p-4 md:p-6">
                  <FilterActions searchId={activeSearch.searchId} />
                  <ContributorList searchId={activeSearch.searchId} />
                  <RoleList searchId={activeSearch.searchId} />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </nav>
      </div>
    </header>
  );
};
