import React from "react";
import { Hero } from "./Hero";
import { RecentSearches } from "./RecentSearches";
import { HowItWorks } from "./HowItWorks";
import { SearchFormProps } from "../search/SearchForm";
import { cn } from "@/lib/utils";

interface HomeProps {
  form: Omit<SearchFormProps, "variant">;
  onOpenSearch: (searchId: string) => void;
  onViewHistory: () => void;
  /** Search progress, shown in place of the hero while a search runs. */
  progress: React.ReactNode;
  showProgress: boolean;
}

const layer = "[grid-area:1/1] min-w-0";
// Visibility flips at once when a layer appears (so focus can move into it)
// and only after the 200ms fade when it hides.
const shown =
  "visible opacity-100 [transition:opacity_200ms,transform_200ms,visibility_0s]";
const hidden =
  "invisible opacity-0 [transition:opacity_200ms,transform_200ms,visibility_0s_200ms]";

export const Home: React.FC<HomeProps> = ({
  form,
  onOpenSearch,
  onViewHistory,
  progress,
  showProgress,
}) => (
  <>
    {/* Hero and progress share one grid cell: the hero fades out and the
        progress slides in from the right, and the sections below stay put.
        `invisible` keeps the hidden layer out of the tab order and the
        accessibility tree once its fade ends. */}
    <div className="grid overflow-hidden">
      <div className={cn(layer, showProgress ? hidden : shown)}>
        <Hero {...form} />
      </div>
      <div
        className={cn(
          layer,
          "md:border-b",
          showProgress
            ? cn(shown, "translate-x-0")
            : cn(hidden, "translate-x-8"),
        )}
      >
        {progress}
      </div>
    </div>
    <RecentSearches onOpen={onOpenSearch} onViewHistory={onViewHistory} />
    <HowItWorks />
  </>
);
