import React, { useId, useState } from "react";
import { X } from "lucide-react";
import {
  axisYears,
  Lane,
  LANES_SHOWN,
  laneSpan,
  LaneTick,
  nearestResultTick,
  Swimlanes as SwimlaneData,
  topLanes,
} from "@/lib/swimlanes";
import { ROLE_GROUPS } from "@/lib/roleGroups";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface SwimlanesProps {
  lanes: SwimlaneData;
  /** A result's title, artist and year, for the picked tick's list. */
  describe: (key: string) => { title: string; artist: string } | undefined;
  /** "Must include" is on for this person. */
  required: (id: number) => boolean;
  /** Tap a name: filter to that person (or back). */
  onName: (lane: Lane) => void;
  /** Tap a result in a picked tick: show it in the list. */
  onResult: (key: string, lane: Lane) => void;
}

/** A year's place across a lane, in percent, a little in from each end. */
const placeOf = (lanes: SwimlaneData) => (year: number) =>
  2 + (96 * (year - lanes.from)) / Math.max(1, lanes.to - lanes.from);

const groupLabel = (id: string) =>
  ROLE_GROUPS.find((g) => g.id === id)?.label ?? "";

/**
 * The swimlanes: a lane per person, ticks by year (solid: current results
 * they link; faint: their other items), and the searched album's year (a
 * line per stack album) across them all. Tapping a lane picks the
 * nearest solid tick and lists its results; arrow keys step between them.
 */
export const Swimlanes: React.FC<SwimlanesProps> = ({
  lanes,
  describe,
  required,
  onName,
  onResult,
}) => {
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<{ lane: number; year: number } | null>(
    null,
  );
  const id = useId();
  const shown = all ? lanes : topLanes(lanes, LANES_SHOWN);
  const at = placeOf(lanes);
  const span = Math.max(1, lanes.to - lanes.from);

  if (lanes.lanes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        No one counts under these filters.
      </p>
    );
  }

  const pick = (lane: Lane, tick: LaneTick | null) =>
    setPicked(tick ? { lane: lane.id, year: tick.year } : null);

  const onTrackClick = (lane: Lane, e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - box.left) / box.width) * 100;
    const year = lanes.from + ((percent - 2) / 96) * span;
    // A fingertip's width either side: about 4% of the lane.
    pick(lane, nearestResultTick(lane, year, Math.max(1, span * 0.04)));
  };

  const onTrackKey = (lane: Lane, e: React.KeyboardEvent<HTMLDivElement>) => {
    const solid = lane.ticks.filter((t) => t.results.length > 0);
    if (solid.length === 0) return;
    const current = picked?.lane === lane.id ? picked.year : null;
    const index = solid.findIndex((t) => t.year === current);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      pick(lane, solid[index < 0 ? 0 : Math.min(solid.length - 1, index + 1)]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      pick(lane, solid[index < 0 ? solid.length - 1 : Math.max(0, index - 1)]);
    } else if (e.key === "Escape") {
      setPicked(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* The searched album (a stack's start) labelled over its line. */}
      <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden md:block" />
        <div className="relative h-5" aria-hidden="true">
          {lanes.albums
            .filter((album) => album.accent)
            .map((album) => (
              <span
                key={album.key}
                className={cn(
                  "absolute whitespace-nowrap font-mono text-xs text-primary-text",
                  at(album.year) > 60 ? "-translate-x-full pr-1" : "pl-1",
                )}
                style={{ left: `${at(album.year)}%` }}
              >
                {album.title} · {album.year}
              </span>
            ))}
        </div>
      </div>
      <div className="relative">
        <ul className="relative flex flex-col" aria-label="People by year">
          {shown.lanes.map((lane) => {
            const on = required(lane.id);
            const pickedTick =
              picked?.lane === lane.id
                ? lane.ticks.find((t) => t.year === picked.year)
                : undefined;
            const panelId = `${id}-${lane.id}`;
            return (
              <li
                key={lane.id}
                className="flex flex-col border-b md:grid md:grid-cols-[200px_minmax(0,1fr)] md:items-center"
              >
                <button
                  type="button"
                  onClick={() => onName(lane)}
                  aria-pressed={on}
                  aria-label={`${lane.name}, ${groupLabel(lane.group)}: ${lane.results} ${lane.results === 1 ? "result" : "results"}. ${on ? "Showing only albums with them; press to undo." : "Press to show only albums with them."}`}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-col items-start justify-center rounded-md px-1 py-1 text-left md:pr-3",
                    focusRing,
                  )}
                >
                  <span
                    className={cn(
                      "w-full truncate text-sm font-medium",
                      on ? "text-primary-text" : "text-foreground",
                    )}
                  >
                    {lane.name}
                  </span>
                  <span className="w-full truncate font-mono text-xs text-faint">
                    {laneSpan(lane)} · {lane.results}{" "}
                    {lane.results === 1 ? "result" : "results"}
                    {lane.partial && " · oldest not read"}
                  </span>
                </button>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label={`${lane.name}'s releases by year. Arrow keys move between years with results.`}
                  aria-controls={pickedTick ? panelId : undefined}
                  onClick={(e) => onTrackClick(lane, e)}
                  onKeyDown={(e) => onTrackKey(lane, e)}
                  className={cn(
                    "relative h-11 cursor-pointer rounded-sm",
                    focusRing,
                  )}
                >
                  <svg
                    className="absolute inset-0 h-full w-full overflow-visible"
                    viewBox="0 0 100 44"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <pattern
                        id={`${id}-hatch`}
                        width="2"
                        height="6"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(30)"
                      >
                        <line
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="6"
                          className="stroke-border-strong"
                          strokeWidth="1"
                          vectorEffect="non-scaling-stroke"
                        />
                      </pattern>
                    </defs>
                    {/* Before a cut-short lane's first year: not read. */}
                    {lane.partial && lane.first !== null && (
                      <rect
                        x="0"
                        y="14"
                        width={at(lane.first)}
                        height="16"
                        fill={`url(#${id}-hatch)`}
                      />
                    )}
                    {lanes.albums.map((album) => (
                      <line
                        key={album.key}
                        x1={at(album.year)}
                        x2={at(album.year)}
                        y1="0"
                        y2="44"
                        className={
                          album.accent
                            ? "stroke-primary"
                            : "stroke-border-emphasis"
                        }
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    <line
                      x1={lane.first !== null ? at(lane.first) : 0}
                      x2={
                        lane.ticks.length
                          ? at(lane.ticks[lane.ticks.length - 1].year)
                          : 0
                      }
                      y1="22"
                      y2="22"
                      className="stroke-border"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    {lane.ticks.map((tick) =>
                      tick.results.length === 0 ? (
                        <line
                          key={tick.year}
                          x1={at(tick.year)}
                          x2={at(tick.year)}
                          y1="15"
                          y2="29"
                          className="stroke-faint"
                          strokeOpacity="0.45"
                          strokeWidth="1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : (
                        <line
                          key={tick.year}
                          x1={at(tick.year)}
                          x2={at(tick.year)}
                          y1={Math.max(4, 10 - 2 * tick.results.length)}
                          y2={Math.min(40, 34 + 2 * tick.results.length)}
                          className={
                            pickedTick?.year === tick.year
                              ? "stroke-primary-text"
                              : "stroke-foreground"
                          }
                          strokeWidth={pickedTick?.year === tick.year ? 3 : 2}
                          vectorEffect="non-scaling-stroke"
                        />
                      ),
                    )}
                  </svg>
                </div>
                {pickedTick && (
                  <div
                    id={panelId}
                    role="region"
                    aria-label={`${lane.name}, ${pickedTick.year}`}
                    className="mb-2 flex flex-col gap-1 rounded-lg border bg-surface p-2 md:col-start-2"
                  >
                    <div className="flex items-center justify-between gap-2 pl-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {lane.name} · {pickedTick.year}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPicked(null)}
                        aria-label="Close"
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary",
                          focusRing,
                        )}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    {pickedTick.results.map((key) => {
                      const album = describe(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onResult(key, lane)}
                          className={cn(
                            "flex min-h-11 flex-col items-start justify-center rounded-md px-2 text-left hover:bg-secondary",
                            focusRing,
                          )}
                        >
                          <span className="text-sm text-foreground">
                            {album?.title ?? key}
                          </span>
                          {album && (
                            <span className="text-xs text-muted-foreground">
                              {album.artist} · show in the list
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* The axis: years under the tracks, and the album labels. */}
      <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden md:block" />
        <div className="relative h-5" aria-hidden="true">
          {axisYears(lanes.from, lanes.to).map((year) => (
            <span
              key={year}
              className="absolute -translate-x-1/2 font-mono text-xs text-faint"
              style={{ left: `${at(year)}%` }}
            >
              {year}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground md:pl-[200px]">
        {lanes.albums.map((album) => (
          <span key={album.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "inline-block h-3 w-0.5",
                album.accent ? "bg-primary" : "bg-border-emphasis",
              )}
            />
            {album.title} · {album.year}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground" />
          results
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-px bg-faint" />
          their other releases
        </span>
        {lanes.undated > 0 && (
          <span>{lanes.undated.toLocaleString("en-US")} undated, not shown</span>
        )}
      </div>

      {lanes.lanes.length > LANES_SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className={cn(
            "inline-flex min-h-11 items-center self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground",
            focusRing,
          )}
        >
          {all
            ? `Show the top ${LANES_SHOWN}`
            : `Show all ${lanes.lanes.length.toLocaleString("en-US")}`}
        </button>
      )}
    </div>
  );
};
