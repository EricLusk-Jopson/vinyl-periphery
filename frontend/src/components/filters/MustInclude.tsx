import React, { useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import {
  MustIncludeItem,
  mustIncludeOptions,
  requireContributor,
  requiredChips,
  requireRole,
  unrequire,
} from "@/lib/filters";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * "Must include": contributors and roles every result has to feature, on top
 * of the other filters, and locked on in the chips below. A name filter
 * finds them; required ones show as chips that remove themselves when
 * pressed. This list is the only way to change them.
 */
export const MustInclude: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches, updateFilterState } = useCache();
  const search = searches[searchId];
  const chips = useMemo(() => (search ? requiredChips(search) : []), [search]);
  if (!search) return null;
  return (
    <MustIncludeView
      chips={chips}
      options={(query) => mustIncludeOptions(search, query)}
      onAdd={(item) => {
        if (item.kind === "album") return;
        track("filter_changed", {
          filter: `must_include_${item.kind}`,
          on: true,
        });
        updateFilterState(
          searchId,
          item.kind === "contributor"
            ? requireContributor(search, item.id)
            : requireRole(search, item.role),
        );
      }}
      onRemove={(item) => {
        if (item.kind === "album") return;
        track("filter_changed", {
          filter: `must_include_${item.kind}`,
          on: false,
        });
        updateFilterState(
          searchId,
          unrequire(
            search,
            item.kind === "contributor"
              ? { contributor: item.id }
              : { role: item.role },
          ),
        );
      }}
    />
  );
};

interface MustIncludeViewProps {
  chips: MustIncludeItem[];
  /** Matches for a query, not yet required. */
  options: (query: string) => MustIncludeItem[];
  onAdd: (item: MustIncludeItem) => void;
  onRemove: (item: MustIncludeItem) => void;
  /** The words for what can be added (a stack adds albums too). */
  copy?: { thing: string; things: string; hint: string };
}

const SEARCH_COPY = {
  thing: "a name or role",
  things: "names or roles",
  hint: "Every result will feature each person and role you add here.",
};

const itemKey = (item: MustIncludeItem) =>
  item.kind === "contributor"
    ? `c${item.id}`
    : item.kind === "role"
      ? `r${item.role}`
      : `a${item.key}`;

/** The kind, shown beside roles and albums (names need no tag). */
const KIND_TAG: Record<MustIncludeItem["kind"], string> = {
  contributor: "",
  role: "Role",
  album: "Album",
};

/** The "must include" list and picker, for one search or a stack. */
export const MustIncludeView: React.FC<MustIncludeViewProps> = ({
  chips,
  options: optionsFor,
  onAdd,
  onRemove,
  copy = SEARCH_COPY,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const options = useMemo(() => optionsFor(query), [optionsFor, query]);

  const add = (item: MustIncludeItem) => {
    onAdd(item);
    setQuery("");
    inputRef.current?.focus();
  };
  const remove = onRemove;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-2.5 lg:gap-3"
    >
      <h3
        id={`${id}-heading`}
        className="flex min-h-11 items-center gap-2 lg:min-h-9"
      >
        <span className="text-xs font-medium uppercase tracking-[1px] text-muted-foreground lg:text-[13px]">
          Must include
        </span>
        {chips.length > 0 && (
          <span className="ml-auto font-mono text-xs text-faint">
            {chips.length} required
          </span>
        )}
      </h3>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={itemKey(chip)}>
              <button
                type="button"
                onClick={() => remove(chip)}
                className={cn(
                  "inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-border-emphasis bg-secondary pl-2.5 pr-2 text-sm text-foreground transition-colors duration-150 hover:border-border-strong lg:h-[34px]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                )}
              >
                <span className="truncate">{chip.label}</span>
                {KIND_TAG[chip.kind] && (
                  <span className="font-mono text-xs text-faint">
                    {KIND_TAG[chip.kind].toLowerCase()}
                  </span>
                )}
                <X
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {chip.detail && `, ${chip.detail}`}, remove from must include
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-faint">{copy.hint}</p>
      )}

      <label htmlFor={`${id}-input`} className="sr-only">
        Add {copy.thing} that results must include
      </label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && options.length > 0) {
            e.preventDefault();
            add(options[0]);
          }
        }}
        placeholder={`Add ${copy.thing}`}
        autoComplete="off"
        aria-describedby={query.trim() ? `${id}-options` : undefined}
        className={cn(
          "h-11 rounded-lg border px-3 text-[15px] text-foreground placeholder:text-faint lg:h-9 lg:text-sm",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          "bg-surface",
        )}
      />

      {query.trim() !== "" && (
        <div id={`${id}-options`} aria-live="polite">
          {options.length > 0 ? (
            <ul className="flex flex-col overflow-hidden rounded-lg border">
              {options.map((option) => (
                <li key={itemKey(option)} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => add(option)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-secondary lg:min-h-9",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-foreground">
                        {option.label}
                      </span>
                      <span className="truncate font-mono text-xs text-faint">
                        {KIND_TAG[option.kind]}
                        {KIND_TAG[option.kind] && option.detail ? " · " : ""}
                        {option.detail}
                      </span>
                    </span>
                    <Plus
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="sr-only">, add to must include</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">
              No {copy.things} match "{query.trim()}".
            </p>
          )}
        </div>
      )}
    </section>
  );
};
