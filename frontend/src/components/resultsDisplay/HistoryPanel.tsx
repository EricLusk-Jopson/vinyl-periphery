import React from "react";
import { Star, ChevronDown, Trash2 } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SheetClose } from "../ui/sheet";

interface HistoryItemProps {
  searchId: string;
  artist: string;
  album: string;
  onSelect: () => void;
  onDelete: () => void;
  onToggleSave: () => Promise<void>;
  isActive: boolean;
  isSaved: boolean;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  artist,
  album,
  onSelect,
  onDelete,
  onToggleSave,
  isActive,
  isSaved,
}) => {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onToggleSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SheetClose asChild>
      <div
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 justify-between p-md hover:bg-bg-secondary cursor-pointer rounded-md group",
          isActive && "bg-bg-secondary"
        )}
      >
        <div className="flex flex-col flex-grow w-[200px]">
          <span className="text-text-primary font-medium truncate">
            {album}
          </span>
          <span className="text-text-secondary text-sm truncate">{artist}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className={cn(
              "p-2 hover:text-primary-main transition-all",
              !isActive && "opacity-0 group-hover:opacity-100",
              isSaving && "opacity-50 cursor-not-allowed"
            )}
            aria-label={isSaved ? "Unsave search" : "Save search"}
          >
            <Star
              size={16}
              className={cn(
                "transition-colors",
                isSaved && "fill-primary-main text-primary-main"
              )}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              "p-2 hover:text-destructive transition-all",
              !isActive && "opacity-0 group-hover:opacity-100",
              isSaving && "opacity-50 cursor-not-allowed"
            )}
            aria-label="Delete search"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </SheetClose>
  );
};

const HistoryPanel: React.FC = () => {
  const {
    searches,
    setActiveSearch,
    activeSearchId,
    clearSearch,
    savedSearchIds,
    saveSearch,
    unsaveSearch,
  } = useCache();

  const [savedOpen, setSavedOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(true);

  // Get all searches and sort them by timestamp
  const allSearches = React.useMemo(
    () =>
      Object.entries(searches)
        .map(([id, search]) => ({
          id,
          artist: search.searchParams.artist,
          album: search.searchParams.album,
        }))
        .sort((a, b) => b.id.localeCompare(a.id)), // Sort by ID which contains timestamp
    [searches]
  );

  // Filter saved searches
  const savedSearches = React.useMemo(
    () => allSearches.filter((search) => savedSearchIds.has(search.id)),
    [allSearches, savedSearchIds]
  );

  // Filter session-only searches
  const sessionSearches = React.useMemo(
    () => allSearches.filter((search) => !savedSearchIds.has(search.id)),
    [allSearches, savedSearchIds]
  );

  const handleDelete = React.useCallback(
    async (searchId: string) => {
      try {
        // If it's a saved search, remove from IndexedDB first
        if (savedSearchIds.has(searchId)) {
          await unsaveSearch(searchId);
        }
        // Then clear from session state
        clearSearch(searchId);
      } catch (error) {
        console.error("Failed to delete search:", error);
        // You might want to show an error notification here
      }
    },
    [clearSearch, unsaveSearch, savedSearchIds]
  );

  const handleToggleSave = React.useCallback(
    async (searchId: string) => {
      if (savedSearchIds.has(searchId)) {
        await unsaveSearch(searchId);
      } else {
        await saveSearch(searchId);
      }
    },
    [saveSearch, unsaveSearch, savedSearchIds]
  );

  return (
    <div className="flex flex-col gap-lg mt-xl w-full md:w-[320px]">
      <Collapsible open={savedOpen} onOpenChange={setSavedOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-md text-left font-bold text-md">
          <span>Saved Searches</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">{savedSearches.length}</span>
            <ChevronDown
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                savedOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-sm">
            {savedSearches.length === 0 ? (
              <div className="py-sm px-md text-text-secondary">
                No saved searches yet
              </div>
            ) : (
              savedSearches.map(({ id, artist, album }) => (
                <HistoryItem
                  key={id}
                  searchId={id}
                  artist={artist}
                  album={album}
                  onSelect={() => {
                    setActiveSearch(id);
                  }}
                  onDelete={() => handleDelete(id)}
                  onToggleSave={() => handleToggleSave(id)}
                  isActive={id === activeSearchId}
                  isSaved={true}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-md text-left font-bold text-md">
          <span className="font-bold">Session History</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">
              {sessionSearches.length}
            </span>
            <ChevronDown
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                historyOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-sm">
            {sessionSearches.length === 0 ? (
              <div className="py-sm px-md text-text-secondary">
                No search history yet
              </div>
            ) : (
              sessionSearches.map(({ id, artist, album }) => (
                <HistoryItem
                  key={id}
                  searchId={id}
                  artist={artist}
                  album={album}
                  onSelect={() => setActiveSearch(id)}
                  onDelete={() => handleDelete(id)}
                  onToggleSave={() => handleToggleSave(id)}
                  isActive={id === activeSearchId}
                  isSaved={false}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default HistoryPanel;
