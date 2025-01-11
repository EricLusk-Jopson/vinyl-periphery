import { Sheet, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { X } from "lucide-react";
import React from "react";
import { RoleList } from "../resultsDisplay/RoleList";
import { FiltersContainer } from "../resultsDisplay/styles";
import { FilterButton } from "./FilterButton";
import { ModalContent, HeaderContainer, CloseButton } from "./styles";
import { ContributorList } from "../resultsDisplay/ContributorList";

export const FilterModal: React.FC<{ searchId: string }> = ({ searchId }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <FilterButton onClick={() => setOpen(true)} />
      </SheetTrigger>

      <ModalContent side="right" className="w-[90vw] sm:w-[600px]">
        <HeaderContainer>
          <SheetTitle>Filters</SheetTitle>
          <CloseButton onClick={() => setOpen(false)}>
            <X size={24} />
          </CloseButton>
        </HeaderContainer>

        <FiltersContainer>
          <ContributorList searchId={searchId} />
          <RoleList searchId={searchId} />
        </FiltersContainer>
      </ModalContent>
    </Sheet>
  );
};
