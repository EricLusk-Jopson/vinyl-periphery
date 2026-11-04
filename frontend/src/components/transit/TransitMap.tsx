import React, { useEffect, useRef, useState } from "react";
import { TRANSIT, TransitMap as TransitMapData } from "@/lib/transitMap";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** Full class names, so Tailwind keeps them. */
export const LINE_STROKE = [
  "stroke-line-1",
  "stroke-line-2",
  "stroke-line-3",
  "stroke-line-4",
  "stroke-line-5",
  "stroke-line-6",
];
export const LINE_FILL = [
  "fill-line-1",
  "fill-line-2",
  "fill-line-3",
  "fill-line-4",
  "fill-line-5",
  "fill-line-6",
];
const LINE_BG = [
  "bg-line-1",
  "bg-line-2",
  "bg-line-3",
  "bg-line-4",
  "bg-line-5",
  "bg-line-6",
];

const path = (points: Array<{ x: number; y: number }>) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

interface TransitMapProps {
  /** The map both ways: left to right where it fits, else top to bottom. */
  maps: { horizontal: TransitMapData; vertical: TransitMapData };
  /** Open a station's album (its results). */
  onStation: (searchId: string) => void;
}

/**
 * A stack as a transit map (see `transitMap.ts`): drawn at its own size,
 * never smaller than its 12px text allows. Stations open their results;
 * the legend's lines highlight on tap.
 */
export const TransitMap: React.FC<TransitMapProps> = ({ maps, onStation }) => {
  const [picked, setPicked] = useState<number | null>(null);
  // Left to right when that fits at 80% or more (text stays 12px+).
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setRoom(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const map =
    room === null || maps.horizontal.width * 0.8 <= room
      ? maps.horizontal
      : maps.vertical;
  const dim = (colour: number) => picked !== null && picked !== colour;

  return (
    <div className="flex flex-col gap-5">
      {/* Never scaled below 80%, so labels stay at 12px or more; wider
          maps scroll inside their box. */}
      <div ref={box} className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${map.width} ${map.height}`}
          width={map.width}
          height={map.height}
          className="mx-auto block h-auto"
          style={{ width: "100%", maxWidth: map.width, minWidth: map.width * 0.8 }}
          role="img"
          aria-label={`Transit map: ${map.stations.length} albums, ${map.lines.length} people as lines.`}
        >
          {map.lines.map((line) =>
            line.legs.map((leg, k) => (
              <path
                key={`${line.id}-${k}`}
                d={path(leg)}
                className={cn(
                  LINE_STROKE[line.colour],
                  "fill-none transition-opacity duration-150",
                )}
                strokeWidth={TRANSIT.line}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={dim(line.colour) ? 0.15 : 1}
              />
            )),
          )}
          {map.stations.map((station) => {
            const { label } = station;
            const anchor =
              label.align === "middle"
                ? "middle"
                : label.align === "end"
                  ? "end"
                  : "start";
            const tx =
              label.align === "middle"
                ? label.x + label.w / 2
                : label.align === "end"
                  ? label.x + label.w
                  : label.x;
            // The tap area: the station and its label, 44px tall at least.
            const left = Math.min(label.x, station.x - station.radius);
            const right = Math.max(label.x + label.w, station.x + station.radius);
            const top = Math.min(label.y, station.y - station.radius);
            const bottom = Math.max(
              label.y + label.h,
              station.y + station.radius,
              top + 44,
            );
            const single = station.lines.length === 1 ? station.lines[0] : null;
            return (
              <g
                key={station.key}
                role="link"
                tabIndex={0}
                aria-label={`${station.title} by ${station.artist}: ${station.lines.length} ${station.lines.length === 1 ? "line" : "lines"}. Open its results.`}
                onClick={() => onStation(station.searchId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onStation(station.searchId);
                  }
                }}
                className={cn("cursor-pointer outline-none", focusRing)}
              >
                <rect
                  x={left}
                  y={top}
                  width={right - left}
                  height={bottom - top}
                  className="fill-transparent"
                />
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={station.radius}
                  className={
                    single !== null
                      ? cn(LINE_FILL[single], "stroke-background")
                      : station.lines.length === 0
                        ? "fill-background stroke-faint"
                        : "fill-background stroke-foreground"
                  }
                  strokeWidth={station.lines.length >= 2 ? 3 : 2}
                />
                <text
                  x={tx}
                  y={label.y + TRANSIT.title.size}
                  textAnchor={anchor}
                  className="fill-foreground font-sans"
                  fontSize={TRANSIT.title.size}
                  fontWeight={600}
                >
                  {label.title}
                </text>
                {label.artist && (
                  <text
                    x={tx}
                    y={label.y + TRANSIT.title.line + TRANSIT.artist.size}
                    textAnchor={anchor}
                    className="fill-faint font-mono"
                    fontSize={TRANSIT.artist.size}
                  >
                    {label.artist}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {map.lines.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lines">
          {map.lines.map((line) => (
            <li key={line.id}>
              <button
                type="button"
                aria-pressed={picked === line.colour}
                onClick={() =>
                  setPicked((p) => (p === line.colour ? null : line.colour))
                }
                className={cn(
                  "inline-flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors",
                  picked === line.colour
                    ? "border-border-emphasis bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  focusRing,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-6 rounded-full", LINE_BG[line.colour])}
                />
                <span className="text-foreground">{line.name}</span>
                <span className="font-mono text-xs text-faint">
                  {line.stations.length} stations
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No one counts on two of these albums under the current filters.
        </p>
      )}
      {map.others.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Also on two or more:{" "}
          {map.others
            .slice(0, 12)
            .map((o) => `${o.name} (${o.stations})`)
            .join(", ")}
          {map.others.length > 12 && ` and ${map.others.length - 12} more`}
        </p>
      )}
    </div>
  );
};
