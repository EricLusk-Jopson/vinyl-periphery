import React from "react";
import { History, Search } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

const navButton =
  "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const iconButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface HeaderProps {
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  /** Opens a search picked from History. */
  onOpenSearch: (searchId: string) => void;
  /** Returns to the home page. */
  onHome: () => void;
  /** Compact search form, shown from `lg` while results are showing. */
  search?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  historyOpen,
  onHistoryOpenChange,
  onOpenSearch,
  onHome,
  search,
}) => {
  const { getActiveSearch } = useCache();
  const activeSearch = getActiveSearch();

  const handleHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onHome();
  };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-2 pl-4 md:h-16 md:px-6">
        <Wordmark onClick={handleHome} />

        {activeSearch && search && (
          <div className="ml-auto hidden duration-200 animate-in fade-in lg:block">
            {search}
          </div>
        )}

        <nav aria-label="Main" className="flex items-center gap-1">
          {activeSearch ? (
            <button
              type="button"
              onClick={onHome}
              aria-label="New search"
              className={cn(iconButton, "lg:hidden")}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <a href="#how" className={cn(navButton, "hidden md:inline-flex")}>
              How it works
            </a>
          )}

          <HistoryDrawer
            open={historyOpen}
            onOpenChange={onHistoryOpenChange}
            onOpenSearch={onOpenSearch}
            trigger={
              <button type="button" className={navButton}>
                <History className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only md:not-sr-only">History</span>
              </button>
            }
          />
        </nav>
      </div>
    </header>
  );
};
