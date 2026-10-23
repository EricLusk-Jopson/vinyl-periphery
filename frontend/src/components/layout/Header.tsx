import React, { useState, useEffect } from "react";
import { History, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";
import { ContributorList } from "../resultsDisplay/ContributorList";
import { RoleList } from "../resultsDisplay/RoleList";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "../../contexts/cache/CacheContext";
import { cn } from "@/lib/utils";
import { FilterActions } from "../resultsDisplay/FilterActions";
import HistoryPanel from "../resultsDisplay/HistoryPanel";

export const Header: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { getActiveSearch } = useCache();
  const activeSearch = getActiveSearch();
  const { count } = useFilteredAndScoredReleases(activeSearch?.searchId || "");

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 50) {
        setIsVisible(true);
      } else {
        setIsVisible(currentScrollY < lastScrollY);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 bg-bg-primary border-b border-primary-main",
        "transition-transform duration-300",
        "z-header",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="flex justify-between items-center px-[15px] py-[15px] mx-auto w-full">
        <Sheet>
          <SheetTrigger asChild>
            <button className="bg-transparent border-none text-text-primary p-2 hover:text-primary-main transition-colors flex items-center gap-2">
              <span className="hidden md:inline text-base font-medium">
                History
              </span>{" "}
              <History className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="bg-bg-primary border-r border-primary-main z-modal overflow-y-auto overflow-x-hidden pl-[15px] md:p-[50px] w-screen md:w-fit max-w-full "
          >
            <SheetHeader>
              <SheetTitle className="m-[26px]">History</SheetTitle>
              <SheetClose className="absolute right-[15px] top-[15px] bg-transparent border-none text-text-primary p-[10px] hover:text-primary-main">
                <X size={24} />
              </SheetClose>
            </SheetHeader>
            <HistoryPanel />
          </SheetContent>
        </Sheet>

        {/* <h1 className="font-primary text-[1.5rem] tracking-[4px] text-primary-main m-0">
          Vinyl Periphery
        </h1> */}

        <Sheet>
          <SheetTrigger asChild>
            <button className="bg-transparent border-none text-text-primary p-2 hover:text-primary-main transition-colors flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 md:w-6 md:h-6" />{" "}
              <span className="hidden md:inline text-base font-medium">
                Filters ({count})
              </span>{" "}
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={cn(
              "bg-bg-primary border-l border-primary-main z-modal",
              "p-[50px] fixed top-0 right-0 h-full",
              "w-full",
              "overflow-y-auto overflow-x-hidden"
            )}
          >
            <SheetHeader>
              <SheetTitle>Filters ({count})</SheetTitle>
              <SheetClose className="absolute right-[15px] top-[15px] bg-transparent border-none text-text-primary p-[10px] hover:text-primary-main">
                <X size={24} />
              </SheetClose>
            </SheetHeader>
            {activeSearch && (
              <div className="flex flex-col gap-[20px] mt-[50px] w-full">
                <FilterActions searchId={activeSearch.searchId} />
                <ContributorList searchId={activeSearch.searchId} />
                <RoleList searchId={activeSearch.searchId} />
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
