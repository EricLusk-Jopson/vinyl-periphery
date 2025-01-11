import React, { useState, useEffect } from "react";
import { Menu, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  HeaderWrapper,
  HeaderContent,
  HeaderButton,
  StyledSheetContent,
  CloseButton,
  StyledTitle,
  FilterContainer,
} from "./styles";
import { ContributorList } from "../resultsDisplay/ContributorList";
import { RoleList } from "../resultsDisplay/RoleList";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "../../contexts/cache/CacheContext";

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
    <HeaderWrapper $visible={isVisible}>
      <HeaderContent>
        <Sheet>
          <SheetTrigger asChild>
            <HeaderButton>
              <Menu size={24} />
            </HeaderButton>
          </SheetTrigger>
          <StyledSheetContent side="left">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <CloseButton>
              <X size={24} />
            </CloseButton>
          </StyledSheetContent>
        </Sheet>

        <StyledTitle>Vinyl Periphery</StyledTitle>

        <Sheet>
          <SheetTrigger asChild>
            <HeaderButton>
              <SlidersHorizontal size={24} />
            </HeaderButton>
          </SheetTrigger>
          <StyledSheetContent side="right">
            <SheetHeader>
              <SheetTitle>Filters ({count} matches)</SheetTitle>
            </SheetHeader>
            <CloseButton>
              <X size={24} />
            </CloseButton>
            {activeSearch && (
              <FilterContainer>
                <ContributorList searchId={activeSearch.searchId} />
                <RoleList searchId={activeSearch.searchId} />
              </FilterContainer>
            )}
          </StyledSheetContent>
        </Sheet>
      </HeaderContent>
    </HeaderWrapper>
  );
};
