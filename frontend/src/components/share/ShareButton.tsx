import React, { useEffect, useMemo, useState } from "react";
import { Download, Link as LinkIcon, Share2 } from "lucide-react";
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
import { mapAlbums } from "@/lib/shareMap";
import { track } from "@/lib/analytics";
import { ScoredRelease, SortKey, sortReleases } from "@/lib/results";
import {
  albumMapPayload,
  cardPayload,
  MapCentre,
  mapPayload,
  ShareLayout,
  shareImagePath,
  shareLink,
  countOptions,
  SHARE_COUNTS,
  selectionCaption,
} from "@/lib/share";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";

/** Longest the sheet waits for covers before drawing without the rest. */
const COVER_WAIT_MS = 6000;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface ShareButtonProps {
  /** The search the Results layout lists. */
  search: SearchCache;
  /**
   * What the map draws: its centre, and the stack's searches around it (or
   * just this search), with liked albums from their results.
   */
  map: { centre: MapCentre; members: SearchCache[] };
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
  const { searches } = useCache();
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
  const cardCount = Math.min(counts.card, ranked.length);
  const mapShown = useMemo(
    () => (selection ? ranked.slice(0, counts.map) : []),
    [selection, ranked, counts.map],
  );
  // What the map would show around its centre.
  const around = useMemo(
    () =>
      !open
        ? []
        : selection
          ? mapShown
          : mapAlbums(map.centre.key, map.members, likes),
    [open, selection, mapShown, map.centre.key, map.members, likes],
  );
  const caption = (count: number) =>
    selection
      ? selectionCaption(search, count, selection.sort, selection.then)
      : undefined;
  // The albums either layout draws, so their covers can be looked up.
  const wanted = useMemo(
    () =>
      open
        ? [
            map.centre.key,
            ...around.map((a) => a.key),
            search.target?.key ?? "",
            ...ranked.slice(0, cardCount).map((r) => r.key),
          ].filter(Boolean)
        : [],
    [open, map.centre.key, around, search.target?.key, ranked, cardCount],
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
          : mapPayload(map.centre, map.members, searches, likes, coverFor),
    // coverFor reads the resolver; `covers` says when it has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ready,
      covers,
      selection,
      mapShown,
      map.centre.key,
      map.members,
      searches,
      likes,
    ],
  );
  // A map with nothing around its centre isn't worth sharing.
  const mapReady = around.length > 0;
  const layout: ShareLayout = mapReady ? chosen : "card";
  const payload = useMemo(() => {
    if (!ready) return null;
    return layout === "map"
      ? mapImage
      : cardPayload(search, ranked, coverFor, caption(cardCount), cardCount);
    // coverFor reads the resolver; `covers` says when it has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, covers, layout, mapImage, search, ranked, selection, cardCount]);
  // The album counts to offer for this layout (one search only).
  const shownCount = layout === "map" ? mapShown.length : cardCount;
  const countChoices = selection ? countOptions(layout, ranked.length) : [];

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
      ...(selection ? { albums: shownCount } : {}),
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      track("share_completed", { layout, method: "link" });
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "destructive" });
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
            !wide && "max-h-[92vh] rounded-t-xl",
          )}
        >
          <div className="flex flex-col gap-1.5 pr-8">
            <SheetTitle className="text-left text-lg font-semibold">
              Share
            </SheetTitle>
            <SheetDescription className="text-left text-sm text-muted-foreground">
              {selection
                ? `The top albums connected to ${search.searchParams.album}, as your filters and sort show them, with a link back here.`
                : layout === "map"
                  ? `A map of ${map.centre.title} and the albums around it, with a link back here.`
                  : `An image of what connects to ${search.searchParams.album}, with a link back here.`}
              {!mapReady &&
                (selection
                  ? " No albums match these filters."
                  : " Like albums in the results to share them as a map.")}
            </SheetDescription>
          </div>

          {mapReady && (
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

          <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-lg border bg-surface">
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

          <div className="flex flex-col gap-2">
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
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!payload}
              className={cn(dialogButton.secondary, "gap-2")}
            >
              <LinkIcon className="h-4 w-4" aria-hidden="true" />
              Copy link
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
