import { SearchParams, SearchStage } from "../../api/types";

export interface SearchFormProps {
  onSearch: (
    params: SearchParams,
    onProgress?: (stage: SearchStage) => void
  ) => Promise<void>;
  isSearching: boolean;
}
