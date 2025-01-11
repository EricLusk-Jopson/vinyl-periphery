import React, { useState, useEffect } from "react";
import { Menu, SlidersHorizontal, X } from "lucide-react";
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
        "transition-transform duration-normal",
        "z-header",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="flex justify-between items-center px-md py-md max-w-lg mx-auto w-full">
        <Sheet>
          <SheetTrigger asChild>
            <button className="bg-transparent border-none text-text-primary p-sm hover:text-primary-main">
              <Menu size={24} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="bg-bg-primary border-r border-primary-main z-modal overflow-y-auto overflow-x-hidden p-xl"
          >
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetClose className="absolute right-md top-md bg-transparent border-none text-text-primary p-sm hover:text-primary-main">
                <X size={24} />
              </SheetClose>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <h1 className="font-primary text-lg tracking-wide text-primary-main m-0">
          Vinyl Periphery
        </h1>

        <Sheet>
          <SheetTrigger asChild>
            <button className="bg-transparent border-none text-text-primary p-sm hover:text-primary-main">
              <SlidersHorizontal size={24} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="bg-bg-primary border-l border-primary-main z-modal overflow-y-auto overflow-x-hidden p-xl"
          >
            <SheetHeader>
              <SheetTitle>Filters ({count} matches)</SheetTitle>
              <SheetClose className="absolute right-md top-md bg-transparent border-none text-text-primary p-sm hover:text-primary-main">
                <X size={24} />
              </SheetClose>
            </SheetHeader>
            {activeSearch && (
              <div className="flex flex-col gap-lg mt-xl w-full">
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
