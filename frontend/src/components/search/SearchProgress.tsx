import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { REQUEST_DELAY_MS } from "@/api/limits";
import { SearchRun } from "@/hooks/useSearchRun";
import {
  STAGE_ORDER,
  STAGE_TITLES,
  currentStageTitle,
  StageId,
  StageStatus,
  plural,
  progressDetail,
  overallProgress,
  stageStatus,
} from "@/lib/searchProgress";
import { cn } from "@/lib/utils";
import { AlbumCover } from "./AlbumCover";

interface SearchProgressProps {
  run: SearchRun;
  onCancel: () => void;
}

const stageDetail = (id: StageId, status: StageStatus, run: SearchRun) => {
  if (status === "pending") return "Waiting";
  const { stage } = run;
  switch (id) {
    case "initial":
      return run.matches === null
        ? "Searching Discogs"
        : plural(run.matches, "matching release");
    case "contributors":
      if (run.contributors !== null)
        return plural(run.contributors, "contributor");
      return stage?.id === "contributors"
        ? `${stage.current} of ${plural(stage.total, "release")}`
        : "";
    case "releases":
      return stage?.id === "releases"
        ? `${stage.current} of ${stage.total}`
        : "";
  }
};

const stageItem: Record<StageStatus, string> = {
  done: "border-border",
  active: "border-primary bg-secondary",
  pending: "border-border",
};
const stageMark: Record<StageStatus, string> = {
  done: "bg-border text-foreground",
  active: "bg-primary text-primary-foreground",
  pending: "border border-border-strong text-faint",
};
const stageTitle: Record<StageStatus, string> = {
  done: "text-muted-foreground",
  active: "text-foreground",
  pending: "text-faint",
};
const checkedTone = ["text-foreground", "text-muted-foreground"];

/**
 * The page shown while a search runs: the album, a stage list, a progress
 * bar with an estimate, the last contributors read, and a way to cancel.
 */
export const SearchProgress: React.FC<SearchProgressProps> = ({
  run,
  onCancel,
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { params, stage } = run;
  const activeId = stage?.id ?? null;
  const activeTitle = currentStageTitle(stage);
  const detail = progressDetail(stage, REQUEST_DELAY_MS);
  const target = overallProgress(stage);
  const percent = Math.round(target * 100);

  // Start the bar at 0 and glide to each new target at the pace of the
  // request under way, so it moves steadily instead of jumping per update.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);
  // One request per discography; a release in the credits stage is about
  // two (the release, then its artists' members).
  const glideMs =
    !stage || stage.id === "initial"
      ? 800
      : stage.id === "contributors"
        ? 2 * REQUEST_DELAY_MS
        : REQUEST_DELAY_MS;

  // The form that started the search is gone; give focus a sensible home.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-16 pt-8 md:gap-8 md:px-6 md:pb-24 md:pt-[72px]">
      <div className="flex flex-wrap items-center gap-4 md:gap-5">
        <AlbumCover
          src={run.thumb}
          title={params.album}
          className="h-16 w-16 rounded-[3px] text-sm md:h-[88px] md:w-[88px] md:rounded md:text-base"
        />
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
          <p className="font-mono text-xs uppercase tracking-[2px] text-primary-text md:text-[13px]">
            Tracing connections
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="break-words font-display text-[30px] font-normal leading-none tracking-[0.5px] focus:outline-none md:text-[56px]"
          >
            {params.album}
          </h1>
          <p className="text-[15px] text-muted-foreground md:text-base">
            {params.artist}
            {run.year && run.year !== "0" ? ` · ${run.year}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 w-full rounded-lg border border-border-strong px-[18px] text-[15px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:w-auto"
        >
          Cancel search
        </button>
      </div>

      <section
        aria-label="Progress"
        className="flex flex-col gap-6 rounded-xl border bg-surface p-5 md:gap-7 md:p-7"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-lg font-semibold">{activeTitle}</span>
            {detail && (
              <span className="font-mono text-sm text-muted-foreground">
                {detail}
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Search progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={detail ? `${activeTitle}, ${detail}` : activeTitle}
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform ease-linear"
              style={{
                transform: `scaleX(${shown})`,
                transitionDuration: `${glideMs}ms`,
              }}
            />
          </div>
          <p className="sr-only" aria-live="polite">
            {activeTitle}
          </p>
        </div>

        <ol className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {STAGE_ORDER.map((id, i) => {
            const status = stageStatus(id, activeId);
            return (
              <li
                key={id}
                aria-current={status === "active" ? "step" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3.5",
                  stageItem[status],
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs",
                    stageMark[status],
                  )}
                  aria-hidden="true"
                >
                  {status === "done" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-[15px] font-semibold",
                      stageTitle[status],
                    )}
                  >
                    {STAGE_TITLES[id]}
                    <span className="sr-only">
                      {status === "done"
                        ? ", done"
                        : status === "active"
                          ? ", in progress"
                          : ", not started"}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {stageDetail(id, status, run)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {run.checked.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t pt-5">
            <h2 className="text-[13px] font-medium text-muted-foreground">
              Just checked
            </h2>
            <ul className="flex flex-col gap-2 font-mono text-[13px]">
              {run.checked.map((c, i) => (
                <li
                  key={`${c.name}-${i}`}
                  className={cn(
                    "flex justify-between gap-4",
                    checkedTone[i] ?? "text-faint",
                  )}
                >
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="shrink-0">
                    {plural(c.releases, "release")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-sm leading-relaxed text-faint">
        You can keep browsing your history while this runs. We'll let you know
        when the results are ready. Discogs allows a limited number of requests
        per minute, which is why this takes a while.
      </p>
    </div>
  );
};
