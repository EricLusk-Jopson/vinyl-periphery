import React, { useMemo, useState } from "react";
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
import { track } from "@/lib/analytics";
import { ScoredRelease } from "@/lib/results";
import {
  cardPayload,
  MapCentre,
  mapHasAlbums,
  mapPayload,
  ShareLayout,
  shareImagePath,
  shareLink,
  ShareSize,
  SIZES,
} from "@/lib/share";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";

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
 * Share: a watermarked image, story or square: a map of the stack (or this
 * search) and the liked albums around it, or these results as a list; through the native share sheet where it takes
 * files, as a download otherwise. The image is rendered by /api/og from
 * data in the URL.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  search,
  map,
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
  const [size, setSize] = useState<ShareSize>("story");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState("");

  const coverFor = (key: string) => coverResolver.get(key);
  const mapImage = useMemo(
    () =>
      open
        ? mapPayload(map.centre, map.members, searches, likes, coverFor)
        : null,
    // coverFor reads the resolver as it is when the sheet opens; the
    // centre is named by its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, map.centre.key, map.members, searches, likes],
  );
  // A map with nothing around its centre isn't worth sharing.
  const mapReady = mapImage !== null && mapHasAlbums(mapImage);
  const layout: ShareLayout = mapReady ? chosen : "card";
  const payload = useMemo(() => {
    if (!open) return null;
    return layout === "map"
      ? mapImage
      : cardPayload(search, releases as ScoredRelease[], coverFor);
  }, [open, layout, mapImage, search, releases]);

  const image = payload ? shareImagePath(payload, size) : "";
  const link = payload ? shareLink(window.location.origin, payload, to) : "";
  const title =
    layout === "map"
      ? `${map.centre.title} by ${map.centre.artist} on Vinyl Periphery`
      : `${search.searchParams.album} by ${search.searchParams.artist} on Vinyl Periphery`;
  const fileName = `vinyl-periphery-${layout}-${size}.png`;

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
    track("share_created", { layout, size });
    try {
      const response = await fetch(image);
      if (!response.ok) throw new Error(`Image failed: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, url: link });
        track("share_completed", { layout, size, method: "share" });
      } else {
        download(blob);
        track("share_completed", { layout, size, method: "download" });
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
      track("share_completed", { layout, size, method: "link" });
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
              {layout === "map"
                ? `A map of ${map.centre.title} and the albums around it, with a link back here.`
                : `An image of what connects to ${search.searchParams.album}, with a link back here.`}
              {!mapReady &&
                " Like albums in the results to share them as a map."}
            </SheetDescription>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {mapReady && (
              <div className="flex-1">
                <Segmented
                  label="Show"
                  value={layout}
                  options={LAYOUTS}
                  onChange={(value) => setChosen(value)}
                />
              </div>
            )}
            <div className="flex-1">
              <Segmented
                label="Size"
                value={size}
                options={SIZES}
                onChange={(value) => setSize(value)}
              />
            </div>
          </div>

          <div
            className={cn(
              "relative mx-auto w-full overflow-hidden rounded-lg border bg-surface",
              size === "story"
                ? "max-w-[220px] md:max-w-[240px]"
                : "max-w-[300px]",
            )}
            style={{ aspectRatio: SIZES.find((s) => s.id === size)?.ratio }}
          >
            {image && loaded !== image && (
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-faint">
                Making the image…
              </span>
            )}
            {image && (
              <img
                key={image}
                src={image}
                alt={`Preview of the ${size} share image`}
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
