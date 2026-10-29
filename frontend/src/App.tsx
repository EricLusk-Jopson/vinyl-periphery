import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./styles/globals.css";
import { SearchParams, SearchTarget } from "./api/types";
import { useCache } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./components/home/Home";
import { StackPage } from "./components/library/StackPage";
import { ChoiceDialog } from "./components/common/ChoiceDialog";
import { dialogButton } from "./components/common/buttons";
import { LibraryPage } from "./components/library/LibraryPage";
import {
  LegacyResultsRedirect,
  ResultsPage,
} from "./components/results/ResultsPage";
import { SearchForm } from "./components/search/SearchForm";
import { SearchProgress } from "./components/search/SearchProgress";
import { SearchBanner } from "./components/search/SearchBanner";
import { ToastAction } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { KnownAlbum, SearchSource, useSearchRun } from "./hooks/useSearchRun";
import { useLingering } from "./hooks/useLingering";
import { pageName, track } from "./lib/analytics";
import {
  HOME_PATH,
  LIBRARY_PATH,
  STACK_ROUTE,
  RESULTS_PATH,
  fromLocation,
  resultPath,
} from "./lib/routes";

const EMPTY_SEARCH: SearchParams = { artist: "", album: "" };

const App: React.FC = () => {
  const { getActiveSearch, clearActiveSearch, searches } = useCache();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const onHomePage = location.pathname === HOME_PATH;

  const activeSearch = getActiveSearch();

  // One set of form values, shared by the hero and the compact header form
  // (only one is on screen at a time).
  const [formValues, setFormValues] = useState<SearchParams>(
    () => activeSearch?.searchParams ?? EMPTY_SEARCH,
  );
  const [focusHeroSearch, setFocusHeroSearch] = useState(false);
  // A typed search that found an album already searched: open it, or run
  // it again by id.
  const [alreadySearched, setAlreadySearched] = useState<{
    searchId: string;
    params: SearchParams;
    target: SearchTarget;
  } | null>(null);
  // Counts searches that failed before the album was found; each one
  // jiggles the search button.
  const [failedAttempt, setFailedAttempt] = useState(0);
  // Whether the running search is expanded: in place of the hero on home,
  // above the page elsewhere. Collapsed, it is the slim status bar.
  const [progressExpanded, setProgressExpanded] = useState(true);
  // Focus "View progress" when the bar appears after hiding the hero's view.
  const [focusStatusBar, setFocusStatusBar] = useState(false);

  // Read when a search finishes, which can be long after it started.
  const locationRef = useRef(location);
  locationRef.current = location;
  const watchingRef = useRef(false);
  watchingRef.current = progressExpanded;

  const openResult = useCallback(
    (params: SearchParams, target: SearchTarget | null = null) => {
      const { pathname, search, state } = locationRef.current;
      const to = resultPath(params, target);
      // Already on this results page (run from a link): stay, keeping its
      // back link, rather than stacking a second history entry.
      if (pathname + search === to) {
        navigate(to, { replace: true, state });
        return;
      }
      navigate(to, { state: fromLocation(pathname) });
    },
    [navigate],
  );

  const { run, isSearching, start, cancel } = useSearchRun({
    onComplete: (_searchId, params, target) => {
      // Open the results if the user is watching the search; otherwise say
      // they are ready and let them choose.
      if (watchingRef.current) {
        openResult(params, target);
        return;
      }
      toast({
        title: "Results ready",
        description: `${params.album} by ${params.artist}`,
        action: (
          <ToastAction
            altText="View results"
            onClick={() => openResult(params, target)}
          >
            View results
          </ToastAction>
        ),
      });
    },
    onNotFound: (params) => {
      setFailedAttempt((n) => n + 1);
      toast({
        title: "Album not found",
        description: `Discogs has nothing for ${params.album} by ${params.artist}. Check the spelling and try again.`,
        variant: "destructive",
      });
    },
    onAlreadySearched: (searchId, params, target) => {
      setAlreadySearched({ searchId, params, target });
    },
    onError: (_error, phase) => {
      if (phase === "finding") setFailedAttempt((n) => n + 1);
      toast({
        title: "Search failed",
        description: "Something went wrong talking to Discogs. Try again.",
        variant: "destructive",
      });
    },
  });

  // Show the open search in the compact form. searchParams keeps its
  // identity across filter changes.
  const activeParams = activeSearch?.searchParams;
  useEffect(() => {
    if (activeParams) setFormValues(activeParams);
  }, [activeParams]);

  useEffect(() => {
    track("page_view", { page: pageName(location.pathname) });
  }, [location.pathname]);

  // The URL decides which search is open: leaving a results page closes it.
  useEffect(() => {
    if (location.pathname !== RESULTS_PATH) clearActiveSearch();
  }, [location.pathname, clearActiveSearch]);

  // On each page change: start at the top, with a running search minimised.
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    window.scrollTo({ top: 0 });
    setProgressExpanded(false);
  }, [location.pathname]);

  const setExpanded = useCallback((expanded: boolean) => {
    setProgressExpanded(expanded);
    setFocusStatusBar(!expanded);
  }, []);

  const goHome = useCallback(() => {
    navigate(HOME_PATH);
    setFormValues(EMPTY_SEARCH);
    setFocusHeroSearch(true);
  }, [navigate]);

  const handleSearch = (
    params: SearchParams,
    source: SearchSource = "form",
    known?: KnownAlbum,
  ) => {
    setProgressExpanded(true);
    void start(params, source, known);
  };

  // From a result row: exactly that album, by its Discogs id.
  const searchFrom = (params: SearchParams, known: KnownAlbum) => {
    setFormValues(params);
    handleSearch(params, "result", known);
  };

  // Progress appears once the album is found; until then the form shows the
  // search under way.
  const running = run?.phase === "running" ? run : null;
  const showHeroProgress = running !== null && onHomePage && progressExpanded;
  const showExpanded = running !== null && progressExpanded;
  useEffect(() => {
    if (showExpanded) window.scrollTo({ top: 0 });
  }, [showExpanded]);
  // Keeps the hero's progress view rendered while it fades out after a cancel.
  const heroRun = useLingering(showHeroProgress ? running : null, 200);
  const heroProgress = heroRun && (
    <SearchProgress
      key={heroRun.id}
      run={heroRun}
      onCancel={cancel}
      onHide={() => setExpanded(false)}
    />
  );

  const formProps = {
    values: formValues,
    onValuesChange: setFormValues,
    onSearch: handleSearch,
    isSearching,
    failedAttempt,
    // Collapsed on home, the hero's form stays locked until the search ends.
    busyLabel: running ? "Search in progress" : "Finding the album",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        onHome={goHome}
        search={<SearchForm variant="compact" {...formProps} />}
      />
      {/* On home the expanded view replaces the hero, so the banner only
          shows there while collapsed. */}
      {running && !(onHomePage && progressExpanded) && (
        <SearchBanner
          run={running}
          expanded={progressExpanded}
          onExpandedChange={setExpanded}
          onCancel={cancel}
          focusOnMount={focusStatusBar}
        />
      )}
      <main className="flex-1">
        <Routes>
          <Route
            path={HOME_PATH}
            element={
              <Home
                form={{ ...formProps, autoFocus: focusHeroSearch }}
                progress={heroProgress}
                showProgress={showHeroProgress}
              />
            }
          />
          <Route path={LIBRARY_PATH} element={<LibraryPage />} />
          <Route
            path={STACK_ROUTE}
            element={
              <StackPage
                onSearchStep={(params, known) => {
                  setFormValues(params);
                  handleSearch(params, "result", known);
                }}
                isSearching={isSearching}
              />
            }
          />
          <Route
            path={RESULTS_PATH}
            element={
              <ResultsPage
                onSearchFrom={searchFrom}
                onRunSearch={(params, target) => {
                  setFormValues(params);
                  // A link naming the album by id runs exactly that album.
                  handleSearch(params, "link", target ? { target } : undefined);
                }}
                isSearching={isSearching}
              />
            }
          />
          {/* Links from before the URL named the album. */}
          <Route
            path={`${RESULTS_PATH}/:searchId`}
            element={<LegacyResultsRedirect />}
          />
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </main>
      <Footer />
      <ChoiceDialog
        open={alreadySearched !== null}
        onOpenChange={(open) => !open && setAlreadySearched(null)}
        title="You've searched this album"
        description={
          alreadySearched &&
          `${alreadySearched.params.album} by ${alreadySearched.params.artist} is already in your ${
            searches[alreadySearched.searchId]?.savedAt ? "library" : "session"
          }. Open it, or search again for fresh results.`
        }
      >
        <button
          type="button"
          className={dialogButton.secondary}
          onClick={() => {
            if (!alreadySearched) return;
            const { params, target } = alreadySearched;
            setAlreadySearched(null);
            // By id: no second text search.
            handleSearch(params, "form", { target });
          }}
        >
          Search again
        </button>
        <button
          type="button"
          className={dialogButton.primary}
          onClick={() => {
            if (!alreadySearched) return;
            const existing = searches[alreadySearched.searchId];
            setAlreadySearched(null);
            track("search_jumped", { from: "form" });
            if (existing) openResult(existing.searchParams, existing.target);
          }}
        >
          Open your search
        </button>
      </ChoiceDialog>
    </div>
  );
};

export default App;
