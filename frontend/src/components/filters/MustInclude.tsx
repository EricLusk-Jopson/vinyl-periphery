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
 * of the other filters. A name filter finds them; required ones show as
 * chips that remove themselves when pressed.
 */
export const MustInclude: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches, updateFilterState } = useCache();
  const search = searches[searchId];
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const chips = useMemo(() => (search ? requiredChips(search) : []), [search]);
  const options = useMemo(
    () => (search ? mustIncludeOptions(search, query) : []),
    [search, query],
  );

  if (!search) return null;

  const add = (item: MustIncludeItem) => {
    track("filter_changed", { filter: `must_include_${item.kind}`, on: true });
    updateFilterState(
      searchId,
      item.kind === "contributor"
        ? requireContributor(search, item.id)
        : requireRole(search, item.role),
    );
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (item: MustIncludeItem) => {
    track("filter_changed", { filter: `must_include_${item.kind}`, on: false });
    updateFilterState(
      searchId,
      unrequire(
        search,
        item.kind === "contributor"
          ? { contributor: item.id }
          : { role: item.role },
      ),
    );
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2.5 lg:gap-3">
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
            <li key={chip.kind === "contributor" ? `c${chip.id}` : `r${chip.role}`}>
              <button
                type="button"
                onClick={() => remove(chip)}
                className={cn(
                  "inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-border-emphasis bg-secondary pl-2.5 pr-2 text-sm text-foreground transition-colors duration-150 hover:border-border-strong lg:h-[34px]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  !chip.available && "border-dashed text-muted-foreground",
                )}
              >
                <span className="truncate">{chip.label}</span>
                {chip.kind === "role" && (
                  <span className="font-mono text-xs text-faint">role</span>
                )}
                <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">
                  {chip.detail && `, ${chip.detail}`}
                  {!chip.available &&
                    (chip.kind === "contributor"
                      ? ", can't be met: all their roles are switched off"
                      : ", can't be met: everyone with this role is switched off")}
                  , remove from must include
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-faint">
          Every result will feature each person and role you add here.
        </p>
      )}

      <label htmlFor={`${id}-input`} className="sr-only">
        Add a name or role that results must include
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
        placeholder="Add a name or role"
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
                <li
                  key={
                    option.kind === "contributor"
                      ? `c${option.id}`
                      : `r${option.role}`
                  }
                  className="border-b last:border-b-0"
                >
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
                        {option.kind === "role" ? "Role" : ""}
                        {option.kind === "role" && option.detail ? " · " : ""}
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
              No names or roles match "{query.trim()}".
            </p>
          )}
        </div>
      )}
    </section>
  );
};
