import { ReleaseList } from "./ReleaseList";
import { ResultsContainer } from "./styles";

export const ResultsDisplay: React.FC<{ searchId: string }> = ({
  searchId,
}) => {
  return (
    <ResultsContainer>
      <ReleaseList searchId={searchId} />
    </ResultsContainer>
  );
};
