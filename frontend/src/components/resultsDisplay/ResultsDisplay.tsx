import { ContributorList } from "./ContributorList";
import { ReleaseList } from "./ReleaseList";
import { RoleList } from "./RoleList";
import { FiltersContainer, ResultsContainer } from "./styles";

export const ResultsDisplay: React.FC<{ searchId: string }> = ({
  searchId,
}) => {
  return (
    <ResultsContainer>
      <FiltersContainer>
        <RoleList searchId={searchId} />
        <ContributorList searchId={searchId} />
      </FiltersContainer>
      <ReleaseList searchId={searchId} />
    </ResultsContainer>
  );
};
