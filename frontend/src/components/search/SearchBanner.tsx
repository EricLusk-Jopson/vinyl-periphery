import React, { useEffect, useRef } from "react";
import { SearchRun } from "@/hooks/useSearchRun";
import { SearchProgress } from "./SearchProgress";
import { SearchStatusBar } from "./SearchStatusBar";

interface SearchBannerProps {
  run: SearchRun;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onCancel: () => void;
}

/**
 * A running search above the history and results pages: minimised to a
 * status bar, or expanded to the full progress view with "Hide progress".
 * The page stays underneath either way.
 */
export const SearchBanner: React.FC<SearchBannerProps> = ({
  run,
  expanded,
  onExpandedChange,
  onCancel,
}) => {
  const viewRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(expanded);

  // After "Hide progress", put focus back on "View progress". Expanding moves
  // focus to the album title (SearchProgress does that when it mounts).
  useEffect(() => {
    if (wasExpanded.current && !expanded) viewRef.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);

  if (!expanded) {
    return (
      <SearchStatusBar
        ref={viewRef}
        run={run}
        onView={() => onExpandedChange(true)}
        onCancel={onCancel}
      />
    );
  }
  return (
    <section
      aria-label="Search in progress"
      className="border-b duration-200 animate-in fade-in slide-in-from-top-2"
    >
      <SearchProgress
        key={run.id}
        run={run}
        onCancel={onCancel}
        onHide={() => onExpandedChange(false)}
        className="pb-10 md:pb-12 md:pt-10"
      />
    </section>
  );
};
