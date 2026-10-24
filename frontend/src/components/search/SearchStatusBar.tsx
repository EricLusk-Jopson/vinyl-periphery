import React from "react";
import { Loader2 } from "lucide-react";
import { REQUEST_DELAY_MS } from "@/api/limits";
import { SearchRun } from "@/hooks/useSearchRun";
import { currentStageTitle, progressDetail } from "@/lib/searchProgress";

interface SearchStatusBarProps {
  run: SearchRun;
  onView: () => void;
}

/** Shown above other pages while a search runs in the background. */
export const SearchStatusBar: React.FC<SearchStatusBarProps> = ({
  run,
  onView,
}) => {
  const detail = progressDetail(run.stage, REQUEST_DELAY_MS);
  const status =
    run.stage?.id === "releases" && detail
      ? `${currentStageTitle(run.stage)} · ${detail}`
      : currentStageTitle(run.stage);
  return (
    <div className="border-b bg-surface">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-1.5 md:px-6">
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 truncate text-sm">
          Searching for {run.params.album}
          <span className="font-mono text-xs text-faint"> · {status}</span>
        </p>
        <button
          type="button"
          onClick={onView}
          className="h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-primary-text transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          View progress
        </button>
      </div>
    </div>
  );
};
