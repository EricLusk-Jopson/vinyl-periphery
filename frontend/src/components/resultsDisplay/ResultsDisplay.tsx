import { ContributorList } from "./ContributorList";
import { ReleaseList } from "./ReleaseList";
import { RoleList } from "./RoleList";
import { ResultsContainer } from "./styles";

export const ResultsDisplay: React.FC<{ searchId: string }> = ({
  searchId,
}) => {
  return (
    <ResultsContainer>
      <RoleList searchId={searchId} />
      <ContributorList searchId={searchId} />
      <ReleaseList searchId={searchId} />
    </ResultsContainer>
  );
};
