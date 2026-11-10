import React, { useId, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { matchesName } from "@/lib/filters";
import { Lane, LaneEdits, YearBounds } from "@/lib/swimlanes";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const inputClass = cn(
  "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 font-mono text-[15px] text-foreground placeholder:text-faint",
  focusRing,
);

/**
 * The People image's years: From and To, each empty for the careers' own
 * start or end. Out-of-range or reversed years are kept to the span.
 */
export const YearRange: React.FC<{
  years: YearBounds;
  /** The years the people's careers span. */
  span: { from: number; to: number };
  onChange: (years: YearBounds) => void;
}> = ({ years, span, onChange }) => {
  const id = useId();
  const read = (value: string): number | null => {
    const n = Math.round(Number(value));
    if (!value.trim() || !Number.isFinite(n)) return null;
    return Math.min(span.to, Math.max(span.from, n));
  };
  const set =
    (part: keyof YearBounds) => (e: React.ChangeEvent<HTMLInputElement>) => {
      // Typing a year: only kept once it's four digits (or cleared).
      const value = e.target.value;
      if (value.trim() !== "" && value.trim().length < 4) return;
      const next = { ...years, [part]: read(value) };
      if (next.from !== null && next.to !== null && next.from > next.to) {
        [next.from, next.to] = [next.to, next.from];
      }
      onChange(next);
    };
  const bounded = years.from !== null || years.to !== null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-from`} className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
            From
          </span>
          <input
            id={`${id}-from`}
            key={`from-${years.from}`}
            type="number"
            inputMode="numeric"
            min={span.from}
            max={span.to}
            defaultValue={years.from ?? ""}
            placeholder={String(span.from)}
            onChange={set("from")}
            className={inputClass}
          />
        </label>
        <label htmlFor={`${id}-to`} className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
            To
          </span>
          <input
            id={`${id}-to`}
            key={`to-${years.to}`}
            type="number"
            inputMode="numeric"
            min={span.from}
            max={span.to}
            defaultValue={years.to ?? ""}
            placeholder={String(span.to)}
            onChange={set("to")}
            className={inputClass}
          />
        </label>
      </div>
      {bounded && (
        <button
          type="button"
          onClick={() => onChange({ from: null, to: null })}
          className={cn(
            "inline-flex min-h-11 items-center self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground",
            focusRing,
          )}
        >
          All years ({span.from}–{span.to})
        </button>
      )}
    </div>
  );
};

/**
 * The People image's people: those drawn, each with Remove, and a search
 * of everyone else it could draw, each with Add. Added people always go
 * in; the rest are the most linked, up to the count.
 */
export const LanePeoplePicker: React.FC<{
  /** Drawn now. */
  shown: Lane[];
  /** Everyone it could draw, most linked first. */
  candidates: Lane[];
  edits: LaneEdits;
  onChange: (edits: LaneEdits) => void;
}> = ({ shown, candidates, edits, onChange }) => {
  const id = useId();
  const [query, setQuery] = useState("");
  const shownIds = useMemo(() => new Set(shown.map((l) => l.id)), [shown]);
  const others = useMemo(
    () =>
      candidates
        .filter((l) => !shownIds.has(l.id))
        .filter((l) => !query.trim() || matchesName(l.name, query))
        .slice(0, 8),
    [candidates, shownIds, query],
  );
  const remove = (lane: Lane) =>
    onChange({
      added: edits.added.filter((x) => x !== lane.id),
      removed: [...edits.removed.filter((x) => x !== lane.id), lane.id],
    });
  const add = (lane: Lane) =>
    onChange({
      added: [...edits.added.filter((x) => x !== lane.id), lane.id],
      removed: edits.removed.filter((x) => x !== lane.id),
    });
  const albums = (lane: Lane) =>
    `${lane.results} ${lane.results === 1 ? "album" : "albums"} here`;
  const picked = edits.added.length + edits.removed.length;

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
        Drawn · {shown.length}
      </span>
      <ul className="flex flex-col divide-y rounded-lg border bg-surface">
        {shown.map((lane) => (
          <li
            key={lane.id}
            className="flex min-h-[52px] items-center gap-3 pl-3"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{lane.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {albums(lane)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove(lane)}
              aria-label={`Take ${lane.name} out`}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                focusRing,
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor={`${id}-find`} className="relative mt-1">
        <span className="sr-only">Find someone to add</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          id={`${id}-find`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find someone to add"
          autoComplete="off"
          className={cn(
            "h-11 w-full rounded-lg border bg-surface pl-9 pr-3 text-[15px] text-foreground placeholder:text-faint",
            focusRing,
          )}
        />
      </label>
      {others.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border bg-surface">
          {others.map((lane) => (
            <li
              key={lane.id}
              className="flex min-h-[52px] items-center gap-3 pl-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {lane.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {albums(lane)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => add(lane)}
                aria-label={`Add ${lane.name}`}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary",
                  focusRing,
                )}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-faint">
          {query.trim()
            ? `No one else matches "${query.trim()}".`
            : "Everyone is drawn."}
        </p>
      )}
      {picked > 0 && (
        <button
          type="button"
          onClick={() => onChange({ added: [], removed: [] })}
          className={cn(
            "inline-flex min-h-11 items-center self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground",
            focusRing,
          )}
        >
          Back to the most linked
        </button>
      )}
    </div>
  );
};
