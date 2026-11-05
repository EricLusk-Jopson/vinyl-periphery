import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, RefreshCw, Share2 } from "lucide-react";
import { coverResolver } from "@/api/coverArt";
import { renderShareImage } from "@/api/shareImage";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/hooks/use-toast";
import { useLikes } from "@/hooks/useLikes";
import { useHidden } from "@/hooks/useHidden";
import { useCoverArt } from "@/hooks/useCoverArt";
import { track, trackStackFilter } from "@/lib/analytics";
import { activeFilterCount } from "@/lib/filters";
import { requestFilters } from "@/lib/filterRequest";
import {
  SEARCH_TOGGLES,
  setToggle,
  STACK_TOGGLES,
  toggleOn,
} from "@/lib/filterToggles";
import { MetaAlbum } from "@/lib/metaAlbum";
import {
  setStates,
  stackAlbumChips,
  StackFilterState,
  stackFilterCount,
} from "@/lib/stackFilters";
import { ScoredRelease, SortKey } from "@/lib/results";
import {
  buildPayload,
  MapCentre,
  ShareData,
  ShareDraft,
  ShareLayout,
  countOptions,
  lineOptions,
  canDrawLines,
  draftChange,
  NO_BOILERPLATE,
  planShare,
  serialisePayload,
  PageSort,
  pageSortName,
} from "@/lib/share";
import { filtersToInclude, ShareEdits } from "@/lib/shareSelection";
import {
  committedShare,
  CommittedShare,
  shareDraft,
  keepShare,
} from "@/lib/shareDrafts";
import { cn } from "@/lib/utils";
import { dialogButton, pageAction } from "../common/buttons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ShareAlbums } from "./ShareAlbums";
import { FindCovers } from "../common/FindCovers";
import { StackAlbumList } from "../library/StackAlbumList";
import { Switch } from "../filters/Switch";

const BARE_KEY = "vinyl-periphery-no-boilerplate";
const readBareUnlocked = () => {
  try {
    return localStorage.getItem(BARE_KEY) === "1";
  } catch {
    return false;
  }
};

/** Longest the sheet waits for covers before drawing without the rest. */
const COVER_WAIT_MS = 6000;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface ShareButtonProps {
  /** The search the Results layout lists. */
  search: SearchCache;
  /**
   * What the stack map draws (without `selection`): its start in the
   * middle, the stack's searches a step apart by `levels` (their steps),
   * and results around them.
   */
  map: {
    centre: MapCentre;
    members: SearchCache[];
    levels?: Map<string, number>;
    /**
     * The stack's results as its Results tab filters them, in order.
     * Without it, every result of its searches.
     */
    results?: ScoredRelease[];
    /**
     * Stack album key -> who counts there under the stack's filters, for
     * the People and Transit images.
     */
    counted?: Map<string, Set<number>>;
  };
  /**
   * For one search: the results' order. Both layouts then draw its top
   * albums as filtered and sorted on the page (no stack, no picking), and
   * say how they were chosen. Without it, the map is the stack's.
   */
  selection?: { sort: SortKey; then: SortKey | null };
  /**
   * The page's sort, which the image draws in: shown and changed in the
   * sheet's "From this page" section (changing it changes the page).
   */
  order: PageSort;
  /**
   * Names this share's draft, kept in memory while the page is open:
   * "search:<id>" or "stack:<stackId>".
   */
  draftKey: string;
  /**
   * A stack's Results tab filters, which the sheet's switches and album
   * list change (the same state the page uses).
   */
  stackFilters?: {
    filters: StackFilterState;
    update: (updates: Partial<StackFilterState>) => void;
    meta: MetaAlbum;
  };
}

/** A stack's layouts: the ring of album overlap, people, a transit map. */
const STACK_LAYOUTS: { id: ShareLayout; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "lanes", label: "People" },
  { id: "transit", label: "Transit" },
];

const LAYOUTS: { id: ShareLayout; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "card", label: "Results" },
  { id: "lanes", label: "People" },
  { id: "transit", label: "Transit" },
];

/** A segmented choice, as radios. */
const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
      {label}
    </span>
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-lg border p-1"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-11 flex-1 rounded-md px-3 text-sm font-medium transition-colors md:h-9",
            focusRing,
            value === o.id
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

/** The page's sort and tiebreaker, as on the page itself. */
const PageSortControls: React.FC<{ order: PageSort }> = ({ order }) => {
  const id = useId();
  const then = order.tiebreaks.some((o) => o.value === order.then)
    ? order.then
    : null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <label htmlFor={`${id}-sort`} className="sr-only">
        Sort by
      </label>
      <Select value={order.sort} onValueChange={order.setSort}>
        <SelectTrigger id={`${id}-sort`}>
          <SelectValue>
            {order.options.find((o) => o.value === order.sort)?.short}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {order.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label htmlFor={`${id}-then`} className="sr-only">
        then
      </label>
      <Select
        value={then ?? "none"}
        onValueChange={(value) =>
          order.setThen(value === "none" ? null : value)
        }
      >
        <SelectTrigger id={`${id}-then`} aria-label="then">
          <SelectValue>
            {then
              ? `then ${order.tiebreaks.find((o) => o.value === then)?.short}`
              : "No tiebreaker"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="none">No tiebreaker</SelectItem>
          {order.tiebreaks.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/** A section heading in the sheet, with an optional line under it. */
const SectionHeading: React.FC<{ title: string; note?: string }> = ({
  title,
  note,
}) => (
  <div className="flex flex-col gap-1">
    <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
      {title}
    </span>
    {note && <p className="text-[13px] text-muted-foreground">{note}</p>}
  </div>
);

/**
 * Share: a square, watermarked image: a map of the stack (or this
 * search) and the liked albums around it, or these results as a list;
 * through the native share sheet where it takes files, as a download
 * otherwise. The controls edit a draft; the image (POST /api/og) is made
 * once when the sheet opens (after covers are looked up, up to
 * COVER_WAIT_MS) and then only when the user presses Regenerate, so what's
 * shared is always the image on screen.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  search,
  map,
  selection,
  order,
  draftKey,
  stackFilters,
}) => {
  const { updateFilterState, searches } = useCache();
  // The search as the cache has it now, for its filter switches.
  const liveSearch = searches[search.searchId] ?? search;
  const { releases } = useFilteredAndScoredReleases(search.searchId);
  const { toast } = useToast();
  const wide = useMediaQuery("(min-width: 768px)");
  // A finger for a pointer: a phone or tablet.
  const coarse = useMediaQuery("(pointer: coarse)");
  const [open, setOpen] = useState(false);
  const likes = useLikes();
  const hidden = useHidden();
  // What the controls set. Kept per search or stack while the page is open.
  const [draft, setDraftState] = useState<ShareDraft>(() =>
    shareDraft(draftKey),
  );
  // The image last made, and the payload it was made from.
  const [committed, setCommitted] = useState<CommittedShare | null>(() =>
    committedShare(draftKey),
  );
  useEffect(() => {
    setDraftState(shareDraft(draftKey));
    setCommitted(committedShare(draftKey));
  }, [draftKey]);
  useEffect(() => {
    keepShare(draftKey, draft, committed);
  }, [draftKey, draft, committed]);
  const setDraft = (update: (current: ShareDraft) => ShareDraft) =>
    setDraftState(update);
  const setView = (update: Partial<ShareDraft["view"]>) =>
    setDraft((d) => ({ ...d, view: { ...d.view, ...update } }));
  const setEdits = (update: (current: ShareEdits) => ShareEdits) =>
    setDraft((d) => ({ ...d, edits: update(d.edits) }));
  // The "no boilerplate" switch, once its phrase has been typed here.
  const [bareUnlocked, setBareUnlocked] = useState(readBareUnlocked);
  const [busy, setBusy] = useState(false);

  // Full size for the image (Discogs covers have a small and a large).
  const coverFor = (key: string) => coverResolver.large(key);
  // The page's order, by name: the stack image draws in it.
  const pageOrder = pageSortName(order);
  const data = useMemo<ShareData | null>(() => {
    if (!open) return null;
    const common = { likes, hidden, coverFor };
    return selection
      ? {
          ...common,
          kind: "search",
          search,
          releases: releases as ScoredRelease[],
          selection,
        }
      : {
          ...common,
          kind: "stack",
          search,
          centre: map.centre,
          members: map.members,
          levels: map.levels ?? new Map(),
          results: map.results,
          counted: map.counted,
          pageOrder,
          albumsOff: Object.entries(stackFilters?.filters.albums ?? {})
            .filter(([, on]) => !on)
            .map(([key]) => key),
        };
  }, [
    open,
    likes,
    hidden,
    selection,
    search,
    releases,
    map,
    stackFilters,
    pageOrder,
  ]);
  const plan = useMemo(
    () => (data ? planShare(draft, data) : null),
    [draft, data],
  );

  const wanted = plan?.wanted ?? [];
  const cover = useCoverArt(wanted);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!open) return;
    setWaited(false);
    const timer = setTimeout(() => setWaited(true), COVER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [open]);
  const ready =
    plan !== null &&
    (waited || wanted.every((key) => cover(key) !== undefined));
  // Changes as covers arrive, so the draft picks them up.
  const covers = ready ? wanted.map((key) => cover(key) ?? "").join("|") : "";
  const payload = useMemo(
    () => (ready && data && plan ? buildPayload(draft, data, plan) : null),
    // coverFor reads the resolver; `covers` says when it has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, covers, draft, data, plan],
  );
  const change = draftChange(payload, committed?.encoded ?? null);

  // Making the image: one request at a time, the latest wins.
  const request = useRef<AbortController | null>(null);
  const [rendering, setRendering] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  const regenerate = async () => {
    if (!payload || !plan) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRendering(true);
    const encoded = serialisePayload(payload);
    try {
      const blob = await renderShareImage(payload, controller.signal);
      setCommitted({
        encoded,
        blob,
        layout: plan.layout,
        albums: plan.shown.length,
        removed: plan.edits.removed.length,
        added: plan.edits.added.length,
        bare: !draft.view.boilerplate,
      });
      setFailed(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Image failed:", error);
      setFailed(true);
      toast({
        title: "Couldn't make the image",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      if (request.current === controller) {
        request.current = null;
        setRendering(false);
      }
    }
  };
  // Nothing is made on open: the image is made when asked (Make image,
  // then Regenerate). Asked before covers are found, it's made once
  // they are (or COVER_WAIT_MS has passed).
  const [wanted_, setWanted] = useState(false);
  const make = () => {
    track("share_regenerated", {
      layout: plan?.layout ?? draft.chosen,
      stack: !selection,
      ...(committed ? {} : { first: true }),
    });
    if (payload) void regenerate();
    else setWanted(true);
  };
  useEffect(() => {
    if (wanted_ && payload) {
      setWanted(false);
      void regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted_, payload]);
  useEffect(() => {
    if (!open) setWanted(false);
  }, [open]);
  // A new layout picked: made straight away, with no Regenerate, once its
  // payload is ready (covers looked up).
  const remakeOnLayout = useRef(false);
  useEffect(() => {
    if (!remakeOnLayout.current || !open || !payload) return;
    remakeOnLayout.current = false;
    if (draftChange(payload, committed?.encoded ?? null) !== "same") {
      void regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payload]);
  useEffect(() => {
    if (!open) setFailed(false);
  }, [open]);

  // The preview: the committed image, as an object URL.
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!committed) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(committed.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [committed]);

  const layout: ShareLayout = plan?.layout ?? "map";
  const mapReady = plan?.mapReady ?? false;
  const shown = plan?.shown ?? [];
  const shownCount = shown.length;
  // The layouts there's something to draw for.
  const layoutReady: Record<ShareLayout, boolean> = {
    map: mapReady,
    card: true,
    lanes: Boolean(plan?.lanesReady),
    transit: Boolean(plan?.transitReady),
  };
  const layoutChoices = (selection ? LAYOUTS : STACK_LAYOUTS).filter(
    (o) => layoutReady[o.id],
  );
  const countChoices = countOptions(layout, plan?.available ?? 0, plan?.cap);
  const lineChoices = lineOptions(plan?.transitPeople ?? 0);
  // Something to make: nothing yet, or the draft has changed since.
  const stale = !committed || change !== "same";

  const removeAlbum = (key: string) =>
    setEdits((current) =>
      current.added.includes(key)
        ? { ...current, added: current.added.filter((k) => k !== key) }
        : { ...current, removed: [...current.removed, key] },
    );
  const addAlbum = (key: string, filtered: boolean) => {
    // Linked through the usual filters: its people and their roles on.
    if (filtered && selection) {
      const update = filtersToInclude(search, key);
      if (update) updateFilterState(search.searchId, update);
    }
    setEdits((current) => ({
      removed: current.removed.filter((k) => k !== key),
      added: current.added.includes(key)
        ? current.added
        : [...current.added, key],
    }));
  };

  // Lines need people to run from: maps of one search have them.
  const linesAvailable = useMemo(
    () =>
      data && plan
        ? canDrawLines(
            buildPayload(
              { ...draft, view: { ...draft.view, lines: true } },
              data,
              plan,
            ),
          )
        : false,
    // Only whether there are links matters, not the art.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, plan],
  );
  // Typing the phrase in the album search unlocks the boilerplate switch.
  const takeQuery = (query: string) => {
    if (query !== NO_BOILERPLATE) return false;
    setBareUnlocked(true);
    try {
      localStorage.setItem(BARE_KEY, "1");
    } catch {
      // Blocked storage: unlocked until the page reloads.
    }
    toast({ title: "Boilerplate switch unlocked" });
    return true;
  };
  const sharedLayout = committed?.layout ?? layout;
  const title =
    sharedLayout === "map"
      ? `${map.centre.title} by ${map.centre.artist} on Vinyl Periphery`
      : `${search.searchParams.album} by ${search.searchParams.artist} on Vinyl Periphery`;
  const fileName = `vinyl-periphery-${sharedLayout}.png`;

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Shares the image on screen: the share sheet only opens straight off a
  // tap, so the file is already here.
  const shareImage = async () => {
    if (!committed || stale || busy) return;
    setBusy(true);
    track("share_created", {
      layout: committed.layout,
      stack: !selection,
      albums: committed.albums,
      removed: committed.removed,
      added: committed.added,
      ...(committed.bare ? { bare: true } : {}),
    });
    const file = new File([committed.blob], fileName, { type: "image/png" });
    if (useShareSheet && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        track("share_completed", { layout: committed.layout, method: "share" });
        setBusy(false);
        return;
      } catch (error) {
        // Closing the share sheet rejects with AbortError: not a failure.
        if (error instanceof DOMException && error.name === "AbortError") {
          setBusy(false);
          return;
        }
        // Anything else (no tap to go with it, a refusal): download.
        console.error("Share failed, downloading instead:", error);
      }
    }
    download(committed.blob);
    track("share_completed", { layout: committed.layout, method: "download" });
    setBusy(false);
  };

  // Whether this browser's share sheet takes image files; otherwise the
  // image downloads. Only touch devices use it: desktop share panels (on
  // Windows and macOS) are slow or hang with an image, and a download is
  // what a laptop wants anyway.
  const canShareFiles = useMemo(() => {
    try {
      return Boolean(
        navigator.canShare?.({
          files: [new File([], "x.png", { type: "image/png" })],
        }),
      );
    } catch {
      return false;
    }
  }, []);
  const useShareSheet = canShareFiles && coarse;

  // The stack's albums, to switch on and off for the map.
  const stackAlbums = useMemo(
    () =>
      stackFilters && !selection
        ? stackAlbumChips(stackFilters.meta, stackFilters.filters)
        : [],
    [stackFilters, selection],
  );
  const activeFilters = selection
    ? activeFilterCount(liveSearch)
    : stackFilters
      ? stackFilterCount(stackFilters.filters)
      : 0;
  // Closes the sheet, then opens the page's filters (the draft stays).
  const moreFilters = () => {
    track("share_more_filters", { stack: !selection });
    setOpen(false);
    setTimeout(requestFilters, 0);
  };

  // The one action: Make image until there is one, Regenerate while the
  // draft differs from it, then Share or Download for the image on screen.
  const making = rendering || wanted_;
  const action = stale ? (
    <button
      type="button"
      onClick={make}
      disabled={making || !plan}
      className={cn(dialogButton.primary, "w-full gap-2")}
    >
      {making ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : committed ? (
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ImageIcon className="h-4 w-4" aria-hidden="true" />
      )}
      {making
        ? payload
          ? "Making the image…"
          : "Finding covers…"
        : committed
          ? "Regenerate"
          : "Make image"}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void shareImage()}
      disabled={busy}
      className={cn(dialogButton.primary, "w-full gap-2")}
    >
      {useShareSheet ? (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {useShareSheet ? "Share image" : "Download image"}
    </button>
  );
  const notice =
    !committed || !stale || rendering
      ? null
      : change === "covers"
        ? "More covers found"
        : "Changes not applied";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={pageAction}
      >
        <Share2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Share
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={cn(
            "flex flex-col gap-4 overflow-y-auto bg-background p-5 md:w-[440px] md:max-w-[440px] md:p-6",
            // Room for the album list beside the preview.
            "lg:w-[920px] lg:max-w-[920px]",
            !wide && "max-h-[92vh] rounded-t-xl",
          )}
        >
          <div className="flex flex-col gap-1.5 pr-8">
            <SheetTitle className="text-left text-lg font-semibold">
              Share
            </SheetTitle>
            <SheetDescription className="text-left text-sm text-muted-foreground">
              {layout === "transit"
                ? `A transit map: ${selection ? `${search.searchParams.album} and the albums chosen` : "the stack's albums and the albums chosen"} are stations, and people credited on two or more are lines.`
                : layout === "lanes"
                  ? `The people on the albums chosen, across their careers: tall marks are those albums, and the red ${selection ? `line is ${search.searchParams.album}` : "lines are the stack's albums"}.`
                  : layout === "card"
                    ? `A list of the top albums connected to ${search.searchParams.album}.`
                    : selection
                      ? `A map of ${search.searchParams.album}'s people and the top albums they share.`
                      : `A map of the stack: its albums on a ring, and the albums chosen nearest the ones they share people with.`}{" "}
              The albums come from this page, as its sort and filters show them;
              change those under From this page.
              {!mapReady &&
                layout !== "lanes" &&
                layout !== "transit" &&
                (selection
                  ? " No albums match these filters."
                  : " Stack another album to share a map.")}
            </SheetDescription>
          </div>

          {/* Phones and tablets: choices, preview and buttons, then the
              album list. Desktop: preview and buttons on the left, the
              choices and the album list on the right. */}
          <div
            className={cn(
              "flex flex-col gap-4",
              "lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-x-8 lg:gap-y-5",
            )}
          >
            {
              <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
                {layoutChoices.length > 1 && (
                  <Segmented
                    label="Show"
                    value={layout}
                    options={layoutChoices}
                    onChange={(chosen) => {
                      remakeOnLayout.current = true;
                      setDraft((d) => ({ ...d, chosen }));
                    }}
                  />
                )}
                {(countChoices.length > 0 || plan?.cap !== undefined) && (
                  <div className="flex flex-col gap-1.5">
                    {countChoices.length > 0 && (
                      <Segmented
                        label="Albums"
                        value={String(shownCount)}
                        options={countChoices.map((c) => ({
                          id: String(c.count),
                          label: c.label,
                        }))}
                        onChange={(value) =>
                          setDraft((d) => ({
                            ...d,
                            counts: { ...d.counts, [layout]: Number(value) },
                          }))
                        }
                      />
                    )}
                    {plan?.cap !== undefined && (
                      <p className="text-[13px] text-muted-foreground">
                        Up to {plan.cap} for this stack, so covers stay big
                        enough to read
                      </p>
                    )}
                  </div>
                )}
                {layout === "transit" &&
                  plan?.transit &&
                  lineChoices.length > 0 && (
                    <Segmented
                      label="Lines"
                      value={String(plan.transit.lines.length)}
                      options={lineChoices.map((c) => ({
                        id: String(c.count),
                        label: c.label,
                      }))}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, transitLines: Number(value) }))
                      }
                    />
                  )}
                <div className="flex flex-col gap-1.5">
                  <SectionHeading title="Image" />
                  <div className="flex flex-col">
                    {!selection && (
                      <Switch
                        label="Liked albums first"
                        checked={draft.stackOrder.likesFirst}
                        onChange={(likesFirst) =>
                          setDraft((d) => ({
                            ...d,
                            stackOrder: { ...d.stackOrder, likesFirst },
                          }))
                        }
                      />
                    )}
                    {layout !== "lanes" && layout !== "transit" && (
                      <Switch
                        label="Album covers"
                        checked={draft.view.covers}
                        onChange={(covers) => setView({ covers })}
                      />
                    )}
                    {linesAvailable && (
                      <Switch
                        label={
                          selection
                            ? "Lines from people to albums"
                            : "Lines between linked albums"
                        }
                        checked={draft.view.lines}
                        onChange={(lines) => setView({ lines })}
                      />
                    )}
                    {layout === "transit" && plan?.transit && (
                      <Switch
                        label="Station titles in a legend"
                        checked={plan.transit.legend}
                        onChange={(legend) => setView({ legend })}
                      />
                    )}
                    {bareUnlocked && layout === "map" && (
                      <Switch
                        label="Title and watermark"
                        checked={draft.view.boilerplate}
                        onChange={(boilerplate) => setView({ boilerplate })}
                      />
                    )}
                  </div>
                </div>
              </div>
            }

            <div className="order-first flex flex-col gap-4 lg:order-none lg:col-start-1 lg:row-span-3 lg:row-start-1">
              <div
                className={cn(
                  "relative mx-auto w-full max-w-[360px] overflow-hidden rounded-lg border bg-surface",
                  "lg:aspect-square lg:max-w-none",
                  // Nothing made yet: a short box on phones, so the
                  // choices aren't pushed below the fold.
                  preview ? "aspect-square" : "h-32 lg:h-auto",
                )}
              >
                {!preview && (
                  <span
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center"
                    role="status"
                  >
                    {making ? (
                      <>
                        <Loader2
                          className="h-6 w-6 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-muted-foreground">
                          {payload ? "Making the image…" : "Finding covers…"}
                        </span>
                      </>
                    ) : failed ? (
                      <span className="text-sm text-muted-foreground">
                        Couldn't make the image. Try again.
                      </span>
                    ) : (
                      <>
                        <ImageIcon
                          className="h-6 w-6 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-muted-foreground">
                          Choose what to draw, then make the image.
                        </span>
                      </>
                    )}
                  </span>
                )}
                {preview && (
                  <img
                    src={preview}
                    alt="Preview of the share image"
                    className={cn(
                      "relative h-full w-full object-cover transition-opacity duration-200",
                      stale || rendering ? "opacity-40" : "opacity-100",
                    )}
                  />
                )}
                {preview && rendering && (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    role="status"
                    aria-label="Making the image"
                  >
                    <Loader2
                      className="h-8 w-8 animate-spin text-foreground"
                      aria-hidden="true"
                    />
                  </span>
                )}
                {notice && (
                  <span
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center"
                    role="status"
                  >
                    <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium text-foreground">
                      {notice}
                    </span>
                    <span className="rounded-md bg-background/90 px-2 py-0.5 text-xs text-muted-foreground">
                      Regenerate to update the image
                    </span>
                  </span>
                )}
              </div>

              {/* Desktop: the action under the preview. Narrower sheets
                  keep it in a footer that stays in reach (below). */}
              <div className="hidden lg:flex">{action}</div>
              {/* Covers MusicBrainz doesn't have, from Discogs: they
                  mark the draft changed as they arrive. */}
              {open && <FindCovers keys={wanted} where="sheet" />}
            </div>

            {/* The page's own sort and filters: changing one here changes
                the page, and the page's changes show here. */}
            <section
              aria-label="From this page"
              className="flex flex-col gap-2 rounded-lg border p-4 lg:col-start-2 lg:row-start-2"
            >
              <SectionHeading
                title="From this page"
                note={`The image draws ${selection ? "this page's" : "the Results tab's"} albums in its order, through its filters. Changing them here changes the page too.`}
              />
              <PageSortControls order={order} />
              <div className="flex flex-col">
                {selection && liveSearch
                  ? SEARCH_TOGGLES.filter((t) => t.inSheet).map((t) => {
                      const on = toggleOn(liveSearch.filterState, t.key);
                      return (
                        <Switch
                          key={t.key}
                          label={t.label(liveSearch.searchParams.artist)}
                          checked={on}
                          onChange={() => {
                            track("filter_changed", {
                              filter: t.event,
                              on: !on,
                              from: "share",
                            });
                            updateFilterState(
                              liveSearch.searchId,
                              setToggle(t.key, !on),
                            );
                          }}
                        />
                      );
                    })
                  : stackFilters &&
                    STACK_TOGGLES.filter((t) => t.inSheet).map((t) => {
                      const on = toggleOn(stackFilters.filters, t.key);
                      return (
                        <Switch
                          key={t.key}
                          label={t.label("")}
                          checked={on}
                          onChange={() => {
                            trackStackFilter(t.event, !on, { from: "share" });
                            stackFilters.update(setToggle(t.key, !on));
                          }}
                        />
                      );
                    })}
              </div>
              {stackAlbums.length > 1 && stackFilters && (
                <div className="mt-3 flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Albums on the map
                  </span>
                  <StackAlbumList
                    albums={stackAlbums}
                    onToggle={(album) => {
                      trackStackFilter("album", !album.included, {
                        from: "share",
                      });
                      stackFilters.update({
                        albums: setStates(
                          stackFilters.filters.albums,
                          [album.key],
                          !album.included,
                        ),
                      });
                    }}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={moreFilters}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground",
                  focusRing,
                )}
              >
                More filters
                {activeFilters > 0 && (
                  <span className="font-mono text-xs no-underline">
                    · {activeFilters} active
                  </span>
                )}
              </button>
            </section>

            {(selection || mapReady) && (
              <div className="lg:col-start-2 lg:row-start-3">
                <ShareAlbums
                  hidden={hidden}
                  search={plan?.pickerSearch ?? search}
                  shown={shown}
                  visibleKeys={plan?.visibleKeys ?? new Set()}
                  onQuery={takeQuery}
                  edits={plan?.edits ?? draft.edits}
                  cover={cover}
                  onRemove={removeAlbum}
                  onAdd={addAlbum}
                  onRestore={() =>
                    setEdits((current) => ({ ...current, removed: [] }))
                  }
                />
              </div>
            )}
          </div>

          {/* Phones and tablets: the action in a footer that stays in
              reach while the controls scroll. */}
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-auto border-t bg-background px-5 pb-5 pt-3 md:-mx-6 md:-mb-6 md:px-6 md:pb-6 lg:hidden">
            {action}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
