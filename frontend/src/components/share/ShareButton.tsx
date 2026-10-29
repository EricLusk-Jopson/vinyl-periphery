import React, { useEffect, useId, useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { coverResolver } from "@/api/coverArt";
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
import { useCoverArt } from "@/hooks/useCoverArt";
import {
  layoutStackMap,
  orderStackResults,
  stackAsSearch,
  stackResults,
} from "@/lib/stackMap";
import { track } from "@/lib/analytics";
import {
  ScoredRelease,
  SORT_OPTIONS,
  SortKey,
  sortReleases,
  tiebreakOptions,
} from "@/lib/results";
import {
  albumMapPayload,
  cardPayload,
  MapCentre,
  stackMapPayload,
  ShareLayout,
  shareImagePath,
  shareLink,
  countOptions,
  SHARE_COUNTS,
  canDrawLines,
  stackCaption,
  DEFAULT_VIEW,
  NO_BOILERPLATE,
  ShareView,
  withView,
  selectionCaption,
} from "@/lib/share";
import {
  editsCaption,
  filtersToInclude,
  NO_EDITS,
  ShareEdits,
  shareSelection,
} from "@/lib/shareSelection";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ShareAlbums } from "./ShareAlbums";
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
  };
  /**
   * For one search: the results' order. Both layouts then draw its top
   * albums as filtered and sorted on the page (no stack, no picking), and
   * say how they were chosen. Without it, the map is the stack's.
   */
  selection?: { sort: SortKey; then: SortKey | null };
  /** Where the shared link opens: these results, or a stack. */
  to: string;
  /** Button style: compact icon on phones (results header) or labelled. */
  compact?: boolean;
}

const LAYOUTS: { id: ShareLayout; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "card", label: "Results" },
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

interface StackOrder {
  sort: SortKey;
  then: SortKey | null;
  likesFirst: boolean;
}

/**
 * The order of a stack's results: a sort, a tiebreaker, and whether
 * liked albums come first (then: stack albums, likes, the rest).
 */
const StackOrderControls: React.FC<{
  order: StackOrder;
  onChange: (order: StackOrder) => void;
}> = ({ order, onChange }) => {
  const id = useId();
  const tiebreaks = tiebreakOptions(order.sort);
  const then = tiebreaks.some((o) => o.value === order.then)
    ? order.then
    : null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
        Order
      </span>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-sort`} className="sr-only">
          Sort by
        </label>
        <Select
          value={order.sort}
          onValueChange={(value) =>
            onChange({ ...order, sort: value as SortKey })
          }
        >
          <SelectTrigger id={`${id}-sort`}>
            <SelectValue>
              {SORT_OPTIONS.find((o) => o.value === order.sort)?.short}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.value === "shared"
                  ? "Most people shared with the stack"
                  : o.label}
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
            onChange({
              ...order,
              then: value === "none" ? null : (value as SortKey),
            })
          }
        >
          <SelectTrigger id={`${id}-then`} aria-label="then">
            <SelectValue>
              {then
                ? `then ${tiebreaks.find((o) => o.value === then)?.short}`
                : "No tiebreaker"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="none">No tiebreaker</SelectItem>
            {tiebreaks.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Switch
        label="Likes first"
        checked={order.likesFirst}
        onChange={(likesFirst) => onChange({ ...order, likesFirst })}
      />
    </div>
  );
};

/**
 * Share: a square, watermarked image: a map of the stack (or this
 * search) and the liked albums around it, or these results as a list;
 * through the native share sheet where it takes files, as a download
 * otherwise. The image is rendered by /api/og from data in the URL. Covers
 * for every album it draws are looked up first (up to COVER_WAIT_MS), so
 * albums that were never on screen still get their art.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  search,
  map,
  selection,
  to,
  compact = false,
}) => {
  const { updateFilterState } = useCache();
  const { releases } = useFilteredAndScoredReleases(search.searchId);
  const { toast } = useToast();
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const likes = useLikes();
  const [chosen, setChosen] = useState<ShareLayout>("map");
  // How many albums each layout draws (one search only).
  const [counts, setCounts] = useState<Record<ShareLayout, number>>({
    map: SHARE_COUNTS.map.start,
    card: SHARE_COUNTS.card.start,
  });
  // Albums taken out of the image or added to it (one search only).
  const [edits, setEdits] = useState<ShareEdits>(NO_EDITS);
  // Covers or titles only; lines from people to their albums.
  const [view, setView] = useState<ShareView>(DEFAULT_VIEW);
  // A stack's results: their order, and whether liked ones come first.
  const [stackOrder, setStackOrder] = useState<StackOrder>({
    sort: "shared",
    then: null,
    likesFirst: true,
  });
  // The "no boilerplate" switch, once its phrase has been typed here.
  const [bareUnlocked, setBareUnlocked] = useState(readBareUnlocked);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState("");

  // One search: its results in the page's order (filters already applied).
  const ranked = useMemo(
    () =>
      selection
        ? sortReleases(
            releases as ScoredRelease[],
            selection.sort,
            selection.then,
          )
        : (releases as ScoredRelease[]),
    [releases, selection],
  );
  // What each layout draws: the top of the list, as edited.
  const mapShown = useMemo(
    () => (selection ? shareSelection(search, ranked, counts.map, edits) : []),
    [selection, search, ranked, counts.map, edits],
  );
  const cardShown = useMemo(
    () =>
      selection
        ? shareSelection(search, ranked, counts.card, edits)
        : ranked.slice(0, counts.card),
    [selection, search, ranked, counts.card, edits],
  );
  const visibleKeys = useMemo(
    () => new Set(ranked.map((r) => r.key)),
    [ranked],
  );
  // A stack: every result of its searches, in the chosen order (no
  // filters here: the stack has none), edited, then laid out around the
  // stack's albums.
  const stackList = useMemo(
    () => (open && !selection ? stackResults(map.centre, map.members) : []),
    [open, selection, map.centre, map.members],
  );
  const stackOrdered = useMemo(
    () =>
      orderStackResults(
        stackList,
        stackOrder.sort,
        stackOrder.then,
        likes,
        stackOrder.likesFirst,
      ),
    [stackList, stackOrder, likes],
  );
  const stackSearch = useMemo(
    () => stackAsSearch(search, map.members, stackList),
    [search, map.members, stackList],
  );
  // A stack has no filters: every result can be shown.
  const allStackKeys = useMemo(
    () => new Set(stackList.map((r) => r.key)),
    [stackList],
  );
  const stackShown = useMemo(
    () => shareSelection(stackSearch, stackOrdered, counts.map, edits),
    [stackSearch, stackOrdered, counts.map, edits],
  );
  // Albums there are to draw: the list less removed ones, plus added ones.
  const pool = selection ? ranked : stackList;
  const available = new Set([
    ...pool.map((r) => r.key).filter((k) => !edits.removed.includes(k)),
    ...edits.added,
  ]).size;
  const stackNodes = useMemo(
    () =>
      open && !selection
        ? layoutStackMap(
            map.centre,
            map.members,
            map.levels ?? new Map(),
            likes,
            stackShown.map((r) => r.key),
          )
        : [],
    [open, selection, map.centre, map.members, map.levels, likes, stackShown],
  );
  // What the map would show around its centre.
  const around = useMemo(
    () => (!open ? [] : selection ? mapShown : stackNodes.slice(1)),
    [open, selection, mapShown, stackNodes],
  );
  const caption = (count: number) =>
    selection
      ? [
          selectionCaption(search, count, selection.sort, selection.then),
          editsCaption(edits),
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;
  // The albums either layout draws, so their covers can be looked up.
  const wanted = useMemo(
    () =>
      // Without covers there's no art to wait for.
      open && view.covers
        ? [
            map.centre.key,
            ...around.map((a) => a.key),
            search.target?.key ?? "",
            ...cardShown.map((r) => r.key),
          ].filter(Boolean)
        : [],
    [open, view.covers, map.centre.key, around, search.target?.key, cardShown],
  );
  const cover = useCoverArt(wanted);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!open) return;
    setWaited(false);
    const timer = setTimeout(() => setWaited(true), COVER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [open]);
  const ready =
    open && (waited || wanted.every((key) => cover(key) !== undefined));
  // Changes as covers arrive, so the image is rebuilt with them.
  const covers = ready ? wanted.map((key) => cover(key) ?? "").join("|") : "";

  const coverFor = (key: string) => coverResolver.get(key);
  const mapImage = useMemo(
    () =>
      !ready
        ? null
        : selection
          ? albumMapPayload(
              search,
              mapShown,
              likes,
              coverFor,
              caption(mapShown.length),
            )
          : stackMapPayload(
              map.centre,
              stackNodes,
              coverFor,
              stackCaption(stackNodes, stackOrder, editsCaption(edits)),
            ),
    // coverFor reads the resolver; `covers` says when it has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, covers, selection, mapShown, map.centre, stackNodes, stackOrder],
  );
  // A map with nothing around its centre isn't worth sharing.
  const mapReady = around.length > 0;
  // A stack is shared as its map only.
  const layout: ShareLayout = !selection ? "map" : mapReady ? chosen : "card";
  const drawn = useMemo(() => {
    if (!ready) return null;
    return layout === "map"
      ? mapImage
      : cardPayload(
          search,
          cardShown,
          coverFor,
          caption(cardShown.length),
          cardShown.length,
        );
    // coverFor reads the resolver; `covers` says when it has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, covers, layout, mapImage, search, cardShown, selection, edits]);
  // The album counts to offer for this layout (one search only).
  const shown = !selection
    ? stackShown
    : layout === "map"
      ? mapShown
      : cardShown;
  const shownCount = shown.length;
  const countChoices = countOptions(layout, available);

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
  const linesAvailable = drawn !== null && canDrawLines(drawn);
  const payload = useMemo(
    () => (drawn ? withView(drawn, view) : null),
    [drawn, view],
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
  const image = payload ? shareImagePath(payload) : "";
  const link = payload ? shareLink(window.location.origin, payload, to) : "";
  const title =
    layout === "map"
      ? `${map.centre.title} by ${map.centre.artist} on Vinyl Periphery`
      : `${search.searchParams.album} by ${search.searchParams.artist} on Vinyl Periphery`;
  const fileName = `vinyl-periphery-${layout}.png`;

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareImage = async () => {
    if (!payload || busy) return;
    setBusy(true);
    track("share_created", {
      layout,
      stack: !selection,
      albums: shownCount,
      removed: edits.removed.length,
      added: edits.added.length,
      ...(view.boilerplate ? {} : { bare: true }),
    });
    try {
      const response = await fetch(image);
      if (!response.ok) throw new Error(`Image failed: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, url: link });
        track("share_completed", { layout, method: "share" });
      } else {
        download(blob);
        track("share_completed", { layout, method: "download" });
      }
    } catch (error) {
      // Closing the share sheet rejects with AbortError: not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Share failed:", error);
        toast({
          title: "Couldn't make the image",
          description: "Try again in a moment.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  // Whether this browser's share sheet takes image files; otherwise the
  // image downloads.
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share"
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-[15px] font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60",
          focusRing,
          compact
            ? "w-11 md:w-auto md:border md:border-border-strong md:px-4"
            : "border border-border-strong px-4",
        )}
      >
        <Share2
          className="h-5 w-5 text-muted-foreground md:h-4 md:w-4"
          aria-hidden="true"
        />
        <span
          className={compact ? "hidden md:inline" : undefined}
          aria-hidden="true"
        >
          Share
        </span>
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
              {selection
                ? `The top albums connected to ${search.searchParams.album}, as your filters and sort show them. Take albums out or add others below.`
                : layout === "map"
                  ? `A map of the stack from ${map.centre.title}: each step one unit from the album it came from, and its results nearest the albums they share people with. Choose their order, take albums out or add others below.`
                  : `An image of what connects to ${search.searchParams.album}.`}
              {!mapReady &&
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
                {selection && mapReady && (
                  <Segmented
                    label="Show"
                    value={layout}
                    options={LAYOUTS}
                    onChange={(value) => setChosen(value)}
                  />
                )}
                {countChoices.length > 0 && (
                  <Segmented
                    label="Albums"
                    value={String(shownCount)}
                    options={countChoices.map((c) => ({
                      id: String(c.count),
                      label: c.label,
                    }))}
                    onChange={(value) =>
                      setCounts((current) => ({
                        ...current,
                        [layout]: Number(value),
                      }))
                    }
                  />
                )}
                {!selection && (
                  <StackOrderControls
                    order={stackOrder}
                    onChange={(order) => setStackOrder(order)}
                  />
                )}
                <div className="flex flex-col">
                  <Switch
                    label="Album covers"
                    checked={view.covers}
                    onChange={(covers) =>
                      setView((current) => ({ ...current, covers }))
                    }
                  />
                  {linesAvailable && (
                    <Switch
                      label={
                        selection
                          ? "Lines from people to albums"
                          : "Lines between linked albums"
                      }
                      checked={view.lines}
                      onChange={(lines) =>
                        setView((current) => ({ ...current, lines }))
                      }
                    />
                  )}
                  {bareUnlocked && layout === "map" && (
                    <Switch
                      label="Title and watermark"
                      checked={view.boilerplate}
                      onChange={(boilerplate) =>
                        setView((current) => ({ ...current, boilerplate }))
                      }
                    />
                  )}
                </div>
              </div>
            }

            <div className="flex flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <div
                className={cn(
                  "relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-lg border bg-surface",
                  "lg:max-w-none",
                )}
              >
                {loaded !== image && (
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-faint">
                    {image ? "Making the image…" : "Finding covers…"}
                  </span>
                )}
                {image && (
                  <img
                    key={image}
                    src={image}
                    alt="Preview of the share image"
                    onLoad={() => setLoaded(image)}
                    className={cn(
                      "relative h-full w-full object-cover transition-opacity duration-200",
                      loaded === image ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
              </div>

              {/* One action: the image, through the share sheet where it
                  takes files (with the link back here), or downloaded. */}
              <button
                type="button"
                onClick={() => void shareImage()}
                disabled={busy || !payload}
                className={cn(dialogButton.primary, "gap-2")}
              >
                {canShareFiles ? (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {busy
                  ? "Making the image…"
                  : canShareFiles
                    ? "Share image"
                    : "Download image"}
              </button>
            </div>

            {(selection || mapReady) && (
              <div className="lg:col-start-2 lg:row-start-2">
                <ShareAlbums
                  search={selection ? search : stackSearch}
                  shown={shown}
                  visibleKeys={selection ? visibleKeys : allStackKeys}
                  onQuery={takeQuery}
                  edits={edits}
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
        </SheetContent>
      </Sheet>
    </>
  );
};
