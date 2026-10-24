import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./styles/globals.css";
import { SearchParams } from "./api/types";
import { useCache } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./components/home/Home";
import { LibraryPage } from "./components/library/LibraryPage";
import { ResultsPage } from "./components/results/ResultsPage";
import { SearchForm } from "./components/search/SearchForm";
import { SearchProgress } from "./components/search/SearchProgress";
import { SearchBanner } from "./components/search/SearchBanner";
import { ToastAction } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { useSearchRun } from "./hooks/useSearchRun";
import { useLingering } from "./hooks/useLingering";
import {
  HOME_PATH,
  LIBRARY_PATH,
  fromLocation,
  resultPath,
} from "./lib/routes";

const EMPTY_SEARCH: SearchParams = { artist: "", album: "" };

const App: React.FC = () => {
  const { getActiveSearch, clearActiveSearch } = useCache();
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
  // Counts searches that failed before the album was found; each one
  // jiggles the search button.
  const [failedAttempt, setFailedAttempt] = useState(0);
  // Whether the running search is expanded above the library and results
  // pages. Home always shows it in place of the hero.
  const [progressExpanded, setProgressExpanded] = useState(true);

  // Read when a search finishes, which can be long after it started.
  const locationRef = useRef(location);
  locationRef.current = location;
  const watchingRef = useRef(false);
  watchingRef.current = onHomePage || progressExpanded;

  const openResult = useCallback(
    (searchId: string) => {
      const { pathname, search } = locationRef.current;
      navigate(resultPath(searchId), { state: fromLocation(pathname, search) });
    },
    [navigate],
  );

  const { run, isSearching, start, cancel } = useSearchRun({
    onComplete: (searchId, params) => {
      // Open the results if the user is watching the search; otherwise say
      // they are ready and let them choose.
      if (watchingRef.current) {
        openResult(searchId);
        return;
      }
      toast({
        title: "Results ready",
        description: `${params.album} by ${params.artist}`,
        action: (
          <ToastAction
            altText="View results"
            onClick={() => openResult(searchId)}
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

  // The URL decides which search is open: leaving a results page closes it.
  useEffect(() => {
    if (!location.pathname.startsWith("/results/")) clearActiveSearch();
  }, [location.pathname, clearActiveSearch]);

  // On each page change: start at the top, and minimise a running search
  // (it is expanded again by "View progress" or a new search).
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    window.scrollTo({ top: 0 });
    setProgressExpanded(false);
  }, [location.pathname]);

  const goHome = useCallback(() => {
    navigate(HOME_PATH);
    setFormValues(EMPTY_SEARCH);
    setFocusHeroSearch(true);
  }, [navigate]);

  const handleSearch = (params: SearchParams) => {
    setProgressExpanded(true);
    void start(params);
  };

  const searchFrom = (params: SearchParams) => {
    setFormValues(params);
    handleSearch(params);
  };

  // Progress appears once the album is found; until then the form shows the
  // search under way.
  const running = run?.phase === "running" ? run : null;
  const showHeroProgress = running !== null && onHomePage;
  const showExpanded = running !== null && (onHomePage || progressExpanded);
  useEffect(() => {
    if (showExpanded) window.scrollTo({ top: 0 });
  }, [showExpanded]);
  // Keeps the hero's progress view rendered while it fades out after a cancel.
  const heroRun = useLingering(showHeroProgress ? running : null, 200);
  const heroProgress = heroRun && (
    <SearchProgress key={heroRun.id} run={heroRun} onCancel={cancel} />
  );

  const formProps = {
    values: formValues,
    onValuesChange: setFormValues,
    onSearch: handleSearch,
    isSearching,
    failedAttempt,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        onHome={goHome}
        search={<SearchForm variant="compact" {...formProps} />}
      />
      {running && !onHomePage && (
        <SearchBanner
          run={running}
          expanded={progressExpanded}
          onExpandedChange={setProgressExpanded}
          onCancel={cancel}
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
            path="/results/:searchId"
            element={
              <ResultsPage
                onSearchFrom={searchFrom}
                isSearching={isSearching}
              />
            }
          />
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;
