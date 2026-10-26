import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, Library, Search } from "lucide-react";
import { LIBRARY_PATH, HOME_PATH, RESULTS_PATH, backLink } from "@/lib/routes";
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
  const { pathname, state } = useLocation();
  const onHomePage = pathname === HOME_PATH;
  // On phones the results page's back link lives here, saving a row.
  const back = pathname === RESULTS_PATH ? backLink(state) : null;

  // Glide down to "How it works" rather than jumping, unless the user prefers
  // reduced motion, and move focus to its heading for keyboard users.
  const scrollToHowItWorks = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const heading = document.getElementById("how-heading");
    if (!heading) return;
    e.preventDefault();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    heading.closest("section")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    heading.focus({ preventScroll: true });
  };

  const handleHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onHome();
  };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-2 px-2 md:h-16 md:gap-4 md:px-6">
        <div className="flex items-center">
          {back && (
            <Link
              to={back.to}
              aria-label={back.label}
              className={cn(iconButton, "md:hidden")}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </Link>
          )}
          <Wordmark onClick={handleHome} nameFrom={onHomePage ? "md" : "lg"} />
        </div>

        {!onHomePage && search && (
          <div className="ml-auto hidden duration-200 animate-in fade-in md:block">
            {search}
          </div>
        )}

        <nav aria-label="Main" className="flex items-center gap-1">
          {onHomePage ? (
            <a
              href="#how"
              onClick={scrollToHowItWorks}
              className={cn(navButton, "hidden md:inline-flex")}
            >
              How it works
            </a>
          ) : (
            <button
              type="button"
              onClick={onHome}
              aria-label="New search"
              className={cn(iconButton, "md:hidden")}
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
