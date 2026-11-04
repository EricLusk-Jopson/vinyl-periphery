import React, { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { SearchParams } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { useCache } from "@/contexts/cache/CacheContext";
import { KnownAlbum } from "@/hooks/useSearchRun";
import { useCoverArt } from "@/hooks/useCoverArt";
import { FindCovers } from "../common/FindCovers";
import { useLikes } from "@/hooks/useLikes";
import { useHidden } from "@/hooks/useHidden";
import { useToast } from "@/hooks/use-toast";
import { StackFilters } from "@/hooks/useStackFilters";
import { StackSort } from "@/hooks/useStackSort";
import { useFilterRequest } from "@/hooks/useFilterRequest";
import { track, trackStackFilter } from "@/lib/analytics";
import { MetaAlbum } from "@/lib/metaAlbum";
import { SortKey, sharedPeople, ScoredRelease } from "@/lib/results";
import { resultPath } from "@/lib/routes";
import { searchTarget } from "@/lib/searchTarget";
import {
  defaultStackFilters,
  filtersFromMembers,
  linkedAlbumsText,
  searchParentFor,
  STACK_SORT_OPTIONS,
  StackResult,
  stackFilterCount,
  StackSortKey,
  stackTiebreakOptions,
} from "@/lib/stackFilters";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";
import { defaultRolePipeline } from "@/lib/transformers/roleProcessor";
import { setLiked } from "@/services/likes";
import { setHidden } from "@/services/hidden";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { ToastAction } from "../ui/toast";
import { ReleaseRow } from "../results/ReleaseRow";
import { SearchCover } from "../search/SearchCover";
import { StackFilterPanel } from "./StackFilterPanel";

const PAGE_SIZE = 20;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const quietButton = cn(
  "h-11 rounded-lg border bg-surface px-6 text-[15px] font-medium text-foreground transition-colors hover:border-border-strong",
  focusRing,
);

interface StackResultsProps {
  stackId: string;
  meta: MetaAlbum;
  /** Member search id -> its step, for where a new search hangs. */
  levels: Map<string, number>;
  stackFilters: StackFilters;
  order: StackSort;
  /** The filtered results, in order (shared with Share). */
  results: StackResult[];
  /** Member albums switched on. */
  of: number;
  onSearchFrom: (params: SearchParams, known: KnownAlbum) => void;
  isSearching: boolean;
}

/** A linked member and who links it, with their roles there. */
const LinkPanel: React.FC<{ result: StackResult; meta: MetaAlbum }> = ({
  result,
  meta,
}) => {
  const members = new Map(meta.members.map((m) => [m.key, m]));
  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-surface md:grid md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-2.5 md:divide-y-0 md:border-0 md:bg-transparent">
      {result.linkedAlbums.map((link) => {
        const member = members.get(link.album);
        if (!member) return null;
        return (
          <li
            key={link.album}
            className="flex flex-col gap-2 px-3 py-2.5 md:rounded-lg md:border md:bg-surface"
          >
            <span className="flex items-center gap-2.5">
              <SearchCover
                search={member.search}
                className="h-8 w-8 rounded-[3px] text-xs"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium md:text-[15px]">
                  {member.title}
                </span>
                <span className="truncate text-xs text-faint">
                  {member.artist}
                </span>
              </span>
            </span>
            <dl className="flex flex-col gap-1.5 text-xs">
              {link.people.map((id) => {
                const person = member.search.contributors?.[id];
                return (
                  <div key={id} className="flex min-w-0 flex-col">
                    <dt className="text-foreground">
                      {defaultContributorDisplayPipeline(person?.name ?? "")}
                    </dt>
                    <dd className="font-mono text-muted-foreground">
                      {defaultRolePipeline(person?.roles ?? []).join(", ") ||
                        "Credited"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        );
      })}
    </ul>
  );
};

/**
 * A stack's Results tab: its members' results merged, filtered by credit,
 * scored by links (member albums linking each) and shared people. Filters
 * in a sidebar on desktop, a sheet below lg.
 */
export const StackResults: React.FC<StackResultsProps> = ({
  stackId,
  meta,
  levels,
  stackFilters,
  order,
  results,
  of,
  onSearchFrom,
  isSearching,
}) => {
  const { searches } = useCache();
  const likes = useLikes();
  const hidden = useHidden();
  const { toast } = useToast();
  const sortId = useId();
  const { filters, update, replace } = stackFilters;
  const { sort, setSort, then, setThen, canBreakTies } = order;
  const tiebreaks = stackTiebreakOptions(sort);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // The filter frame; "More filters" in the share sheet opens it too.
  const [filtersOpen, setFiltersOpen] = useState(false);
  useFilterRequest(() => setFiltersOpen(true));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isSearching) setPendingKey(null);
  }, [isSearching]);
  // A new filter or sort starts from the top of the list.
  useEffect(() => setVisible(PAGE_SIZE), [filters, sort, then]);

  const contributors = useMemo(
    () => Object.assign({}, ...meta.members.map((m) => m.search.contributors)),
    [meta],
  );
  const searchedByKey = useMemo(() => {
    const byKey = new Map<string, SearchCache>();
    for (const s of Object.values(searches)) {
      if (s.target) byKey.set(s.target.key, s);
    }
    return byKey;
  }, [searches]);

  const keys = useMemo(() => results.map((r) => r.key), [results]);
  const cover = useCoverArt(keys, stackId);

  const total = results.length;
  const shown = results.slice(0, visible);
  const shownKeys = shown.map((r) => r.key);
  const current =
    STACK_SORT_OPTIONS.find((o) => o.value === sort) ?? STACK_SORT_OPTIONS[0];
  const active = stackFilterCount(filters);

  const reset = () => {
    trackStackFilter("reset", true);
    replace(defaultStackFilters());
  };
  const applyMembers = () => {
    track("stack_filters_applied", { members: meta.members.length });
    replace(filtersFromMembers(meta));
  };

  const searchFrom = (release: StackResult) => {
    const parent = searchParentFor(release, meta, levels);
    setPendingKey(release.key);
    onSearchFrom(
      { artist: release.artist, album: release.title },
      {
        target: searchTarget(release.type, release.id),
        thumb: cover(release.key) || release.thumb,
        ...(parent
          ? {
              from: {
                parentSearchId: parent.parent.searchId,
                via: parent.via,
              },
            }
          : {}),
      },
    );
  };

  const panel = (variant: "sidebar" | "frame") => (
    <StackFilterPanel
      meta={meta}
      filters={filters}
      update={update}
      replace={replace}
      onApplyMembers={applyMembers}
      variant={variant}
    />
  );

  const filterSheet = (
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary",
            focusRing,
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters{" "}
          {active > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {active}
              <span className="sr-only"> active</span>
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l bg-background p-0 sm:max-w-none md:max-w-[420px]"
      >
        <div className="flex h-14 shrink-0 items-center gap-1 border-b bg-surface pl-1 pr-2">
          <SheetClose
            aria-label="Close filters"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary",
              focusRing,
            )}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </SheetClose>
          <SheetTitle className="flex-1 text-lg font-semibold">
            Filters
          </SheetTitle>
          <SheetDescription className="sr-only">
            Choose which albums, people and roles in the stack count towards the
            results.
          </SheetDescription>
          <button
            type="button"
            onClick={reset}
            className={cn(
              "h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              focusRing,
            )}
          >
            Reset
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {panel("frame")}
        </div>
        <div className="shrink-0 border-t bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          <SheetClose asChild>
            <button
              type="button"
              className={cn(
                "h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-dark",
                focusRing,
              )}
            >
              Show {total.toLocaleString("en-US")}{" "}
              {total === 1 ? "album" : "albums"}
            </button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      <aside
        aria-label="Filters"
        className="hidden lg:block lg:w-[300px] lg:shrink-0"
      >
        {panel("sidebar")}
      </aside>

      <section
        aria-labelledby={`${sortId}-count`}
        className="flex min-w-0 flex-1 flex-col gap-4"
      >
        <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2 md:-mx-6 md:gap-3 md:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <h2
            id={`${sortId}-count`}
            className="mr-auto shrink-0 text-[15px] font-semibold md:text-lg"
          >
            {total.toLocaleString("en-US")} {total === 1 ? "album" : "albums"}
          </h2>
          <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
            <label
              htmlFor={sortId}
              className="sr-only text-sm text-muted-foreground md:not-sr-only"
            >
              Sort by
            </label>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as StackSortKey)}
            >
              <SelectTrigger id={sortId} className="lg:h-10">
                <SelectValue>{current.short}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {STACK_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canBreakTies && (
              <>
                <label
                  htmlFor={`${sortId}-then`}
                  className="shrink-0 text-sm text-muted-foreground"
                >
                  then
                </label>
                <Select
                  value={then ?? "ranking"}
                  onValueChange={(value) =>
                    setThen(value === "ranking" ? null : (value as SortKey))
                  }
                >
                  <SelectTrigger id={`${sortId}-then`} className="lg:h-10">
                    <SelectValue>
                      {tiebreaks.find((o) => o.value === then)?.short ??
                        "Ranking"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="ranking">
                      Ranking (no tiebreaker)
                    </SelectItem>
                    {tiebreaks.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <div className="lg:hidden">{filterSheet}</div>
          </div>
        </div>

        <FindCovers keys={shownKeys} where="stack" />

        {total > 0 ? (
          <ul className="lg:border-t">
            {shown.map((release, i) => {
              const people = sharedPeople(
                release as ScoredRelease,
                contributors,
              );
              const position = {
                rank: i + 1,
                shared: people.length,
                links: release.links,
                sort,
                scope: "stack",
                ...(then ? { then } : {}),
              };
              const album = { title: release.title, artist: release.artist };
              const found = searchedByKey.get(release.key);
              return (
                <ReleaseRow
                  key={release.key}
                  release={release}
                  cover={cover(release.key)}
                  people={people}
                  searchedAlbum=""
                  stack={{
                    via: linkedAlbumsText(release, meta),
                    links: release.links,
                    of,
                    panel: <LinkPanel result={release} meta={meta} />,
                  }}
                  existing={
                    found
                      ? {
                          to: resultPath(found.searchParams, found.target),
                          state: { from: "stack", stackId },
                          onOpen: () =>
                            track("search_jumped", { from: "result" }),
                        }
                      : undefined
                  }
                  open={openKey === release.key}
                  onToggle={() => {
                    if (openKey !== release.key) {
                      track("result_opened", position);
                    }
                    setOpenKey((key) =>
                      key === release.key ? null : release.key,
                    );
                  }}
                  onSearchFrom={() => searchFrom(release)}
                  onOpenDiscogs={() => track("discogs_opened", position)}
                  searching={isSearching}
                  searchingFromHere={isSearching && pendingKey === release.key}
                  liked={Boolean(likes[release.key])}
                  hidden={Boolean(hidden[release.key])}
                  onLike={(like) => {
                    const liked = setLiked(release.key, like, album);
                    track("result_liked", { liked, ...position });
                  }}
                  onHide={(hide) => {
                    const isHidden = setHidden(release.key, hide, album);
                    const wasLiked = Boolean(likes[release.key]);
                    if (isHidden && wasLiked) {
                      setLiked(release.key, false, album);
                    }
                    track("result_hidden", { hidden: isHidden, ...position });
                    if (isHidden && !filters.showHidden) {
                      toast({
                        title: "Album hidden",
                        description: `${release.title} by ${release.artist}. "Show hidden albums" in the filters lists it again.`,
                        action: (
                          <ToastAction
                            altText="Undo hide"
                            onClick={() => {
                              setHidden(release.key, false, album);
                              if (wasLiked) setLiked(release.key, true, album);
                            }}
                          >
                            Undo
                          </ToastAction>
                        ),
                      });
                    }
                  }}
                />
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-base font-semibold">
              {meta.results.size > 0
                ? "No albums match these filters"
                : "No connected albums found"}
            </p>
            {meta.results.size > 0 && (
              <button
                type="button"
                onClick={reset}
                className={cn(quietButton, "bg-transparent px-4 text-sm")}
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col items-center gap-2.5 pt-3">
            {visible < total && (
              <button
                type="button"
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
                className={quietButton}
              >
                Show more
              </button>
            )}
            <span className="font-mono text-xs text-faint" aria-live="polite">
              Showing {shown.length.toLocaleString("en-US")} of{" "}
              {total.toLocaleString("en-US")}
            </span>
          </div>
        )}
      </section>
    </div>
  );
};
