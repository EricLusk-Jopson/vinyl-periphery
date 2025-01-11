import { ReleaseList } from "./ReleaseList";

export const ResultsDisplay: React.FC<{ searchId: string }> = ({
  searchId,
}) => {
  return (
    <div className="grid gap-lg mx-auto w-full max-w-xl">
      <ReleaseList searchId={searchId} />
    </div>
  );
};
