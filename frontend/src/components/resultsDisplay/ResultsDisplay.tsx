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
        <ContributorList searchId={searchId} />
        <RoleList searchId={searchId} />
      </FiltersContainer>
      <ReleaseList searchId={searchId} />
    </ResultsContainer>
  );
};
