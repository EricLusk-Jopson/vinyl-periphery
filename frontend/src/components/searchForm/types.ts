import { SearchParams } from "../../api/types";

export interface SearchFormProps {
  onSearch: (params: SearchParams) => Promise<void>;
  isSearching: boolean;
}
