// src/components/search/SearchResults.tsx
import { ResultsList, ResultItem, ResultTitle, ResultMeta } from "./styles";
import { SearchResult } from "../../api/types";

interface SearchResultsProps {
  results: SearchResult[] | undefined;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ results }) => {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <ResultsList>
      {results.map((result) => (
        <ResultItem key={result.id}>
          <ResultTitle>{result.title}</ResultTitle>
          <ResultMeta>
            {result.community.have}/{result.community.want}
          </ResultMeta>
          <ResultMeta>Release {result.id}</ResultMeta>
          <ResultMeta>
            {` ${result.year} ${result.label} ${result.country}`}
          </ResultMeta>
        </ResultItem>
      ))}
    </ResultsList>
  );
};
