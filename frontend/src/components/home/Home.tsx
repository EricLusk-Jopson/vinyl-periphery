import React from "react";
import { Hero } from "./Hero";
import { RecentSearches } from "./RecentSearches";
import { HowItWorks } from "./HowItWorks";
import { SearchFormProps } from "../search/SearchForm";

interface HomeProps {
  form: Omit<SearchFormProps, "variant">;
  onOpenSearch: (searchId: string) => void;
  onViewHistory: () => void;
}

export const Home: React.FC<HomeProps> = ({
  form,
  onOpenSearch,
  onViewHistory,
}) => (
  <>
    <Hero {...form} />
    <RecentSearches onOpen={onOpenSearch} onViewHistory={onViewHistory} />
    <HowItWorks />
  </>
);
