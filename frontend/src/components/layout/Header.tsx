import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Library, Search } from "lucide-react";
import { LIBRARY_PATH, HOME_PATH } from "@/lib/routes";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

const navButton =
  "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const iconButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface HeaderProps {
  /** Returns to the home page with an empty search form. */
  onHome: () => void;
  /** Compact search form, shown from `lg` on every page but home. */
  search?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ onHome, search }) => {
  const { pathname } = useLocation();
  const onHomePage = pathname === HOME_PATH;

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

        {!onHomePage && search && (
          <div className="ml-auto hidden duration-200 animate-in fade-in lg:block">
            {search}
          </div>
        )}

        <nav aria-label="Main" className="flex items-center gap-1">
          {onHomePage ? (
            <a href="#how" className={cn(navButton, "hidden md:inline-flex")}>
              How it works
            </a>
          ) : (
            <button
              type="button"
              onClick={onHome}
              aria-label="New search"
              className={cn(iconButton, "lg:hidden")}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          {/* NavLink sets aria-current="page" on the library page. */}
          <NavLink
            to={LIBRARY_PATH}
            className={({ isActive }) =>
              cn(navButton, isActive && "bg-secondary")
            }
          >
            <Library className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only md:not-sr-only">Library</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
};
