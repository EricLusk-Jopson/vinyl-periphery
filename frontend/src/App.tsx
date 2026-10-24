import React, { useCallback, useEffect, useRef, useState } from "react";
import "./styles/globals.css";
import { SearchParams } from "./api/types";
import { useCache } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./components/home/Home";
import { SearchForm } from "./components/search/SearchForm";
import { SearchProgress } from "./components/search/SearchProgress";
import { SearchStatusBar } from "./components/search/SearchStatusBar";
import { AlbumHeader } from "./components/results/AlbumHeader";
import { ReleaseList } from "./components/results/ReleaseList";
import { FilterPanel } from "./components/filters/FilterPanel";
import { FilterSheet } from "./components/filters/FilterSheet";
import { ToastAction } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { useSearchRun } from "./hooks/useSearchRun";
import { useLingering } from "./hooks/useLingering";

const EMPTY_SEARCH: SearchParams = { artist: "", album: "" };

const App: React.FC = () => {
  const { getActiveSearch, setActiveSearch, clearActiveSearch } = useCache();
  const { toast } = useToast();

  const activeSearch = getActiveSearch();
  const activeSearchId = activeSearch?.searchId ?? null;

  // One set of form values, shared by the hero and the compact header form
  // (only one is on screen at a time).
  const [formValues, setFormValues] = useState<SearchParams>(
    () => activeSearch?.searchParams ?? EMPTY_SEARCH,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusHeroSearch, setFocusHeroSearch] = useState(false);

  // True once the user opens something else while a search runs. The search
  // carries on and a toast says when it is done.
  const [progressHidden, setProgressHidden] = useState(false);
  const progressHiddenRef = useRef(progressHidden);
  progressHiddenRef.current = progressHidden;
  // Counts searches that failed before the album was found; each one
  // jiggles the search button.
  const [failedAttempt, setFailedAttempt] = useState(0);

  const openSearch = useCallback(
    (searchId: string) => {
      setActiveSearch(searchId);
      window.scrollTo({ top: 0 });
    },
    [setActiveSearch],
  );

  const { run, isSearching, start, cancel } = useSearchRun({
    onComplete: (searchId, params) => {
      if (!progressHiddenRef.current) {
        openSearch(searchId);
        return;
      }
      toast({
        title: "Results ready",
        description: `${params.album} by ${params.artist}`,
        action: (
          <ToastAction
            altText="View results"
            onClick={() => openSearch(searchId)}
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

  // Show the open search in the compact form, including one picked from
  // history. searchParams keeps its identity across filter changes.
  const activeParams = activeSearch?.searchParams;
  useEffect(() => {
    if (activeParams) setFormValues(activeParams);
  }, [activeParams]);

  // Opening a search from history or the recent list mid-search moves the
  // progress page out of the way.
  const isSearchingRef = useRef(isSearching);
  isSearchingRef.current = isSearching;
  useEffect(() => {
    if (activeSearchId && isSearchingRef.current) setProgressHidden(true);
  }, [activeSearchId]);

  const goHome = useCallback(() => {
    clearActiveSearch();
    setFormValues(EMPTY_SEARCH);
    setFocusHeroSearch(true);
    setProgressHidden(false);
    window.scrollTo({ top: 0 });
  }, [clearActiveSearch]);

  const handleSearch = (params: SearchParams) => {
    setProgressHidden(false);
    void start(params);
  };

  const searchFrom = (params: SearchParams) => {
    setFormValues(params);
    handleSearch(params);
  };

  // Progress appears once the album is found; until then the form shows the
  // search under way.
  const showProgress = run?.phase === "running" && !progressHidden;
  useEffect(() => {
    if (showProgress) window.scrollTo({ top: 0 });
  }, [showProgress]);
  // Keeps the progress view rendered while it fades out after a cancel.
  const shownRun = useLingering(showProgress ? run : null, 200);
  const progress = shownRun && (
    <SearchProgress key={shownRun.id} run={shownRun} onCancel={cancel} />
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
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        onOpenSearch={openSearch}
        onHome={goHome}
        search={<SearchForm variant="compact" {...formProps} />}
      />
      {run?.phase === "running" && progressHidden && (
        <SearchStatusBar run={run} onView={() => setProgressHidden(false)} />
      )}
      <main className="flex-1">
        {activeSearch ? (
          showProgress ? (
            <div className="duration-200 animate-in fade-in slide-in-from-right-8">
              {progress}
            </div>
          ) : (
            <div
              key={activeSearch.searchId}
              className="duration-200 animate-in fade-in"
            >
              <AlbumHeader search={activeSearch} />
              <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-3 md:px-6 md:pt-8 lg:flex lg:items-start lg:gap-8 lg:pb-24">
                <aside
                  aria-label="Filters"
                  className="hidden lg:block lg:w-[300px] lg:shrink-0"
                >
                  <FilterPanel
                    searchId={activeSearch.searchId}
                    variant="sidebar"
                  />
                </aside>
                <div className="min-w-0 flex-1">
                  <ReleaseList
                    searchId={activeSearch.searchId}
                    onSearchFrom={searchFrom}
                    isSearching={isSearching}
                  />
                </div>
              </div>
              <FilterSheet searchId={activeSearch.searchId} />
            </div>
          )
        ) : (
          <Home
            form={{ ...formProps, autoFocus: focusHeroSearch }}
            onOpenSearch={openSearch}
            onViewHistory={() => setHistoryOpen(true)}
            progress={progress}
            showProgress={showProgress}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
