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
import { ReleaseList } from "./components/resultsDisplay/ReleaseList";
import { ToastAction } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { useSearchRun } from "./hooks/useSearchRun";

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
    onError: () => {
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
    window.scrollTo({ top: 0 });
    void start(params);
  };

  const showProgress = run !== null && !progressHidden;

  const formProps = {
    values: formValues,
    onValuesChange: setFormValues,
    onSearch: handleSearch,
    isSearching,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        onHome={goHome}
        showHowItWorks={!showProgress && !activeSearch}
        search={<SearchForm variant="compact" {...formProps} />}
      />
      {run && progressHidden && (
        <SearchStatusBar run={run} onView={() => setProgressHidden(false)} />
      )}
      <main className="flex-1">
        {showProgress ? (
          <SearchProgress run={run} onCancel={cancel} />
        ) : activeSearch ? (
          <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-6">
            <ReleaseList searchId={activeSearch.searchId} />
          </div>
        ) : (
          <Home
            form={{ ...formProps, autoFocus: focusHeroSearch }}
            onOpenSearch={openSearch}
            onViewHistory={() => setHistoryOpen(true)}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
