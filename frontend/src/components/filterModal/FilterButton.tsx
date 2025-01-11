import { SlidersHorizontal } from "lucide-react";
import { StyledFilterButton } from "./styles";

export const FilterButton: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => (
  <StyledFilterButton onClick={onClick}>
    <SlidersHorizontal size={20} />
    <span>Filters</span>
  </StyledFilterButton>
);
