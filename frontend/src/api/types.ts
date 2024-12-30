export interface CommunityInfo {
  want: number;
  have: number;
}

export interface Format {
  name: string;
  qty: string;
  descriptions: string[];
}

export interface SearchResult {
  country: string;
  year: string;
  format: string[];
  label: string[];
  type: string;
  genre: string[];
  style: string[];
  id: number;
  barcode: string[];
  master_id: number;
  master_url: string;
  uri: string;
  catno: string;
  title: string;
  thumb: string;
  cover_image: string;
  resource_url: string;
  community: CommunityInfo;
  format_quantity: number;
  formats: Format[];
}

export interface DiscogsSearchResponse {
  results: SearchResult[];
}

export interface RawArtist {
  name: string;
  id: number;
  role: string | string[];
}

export interface ProcessedArtist {
  name: string;
  id: number;
}

export interface ContributorSet {
  artists: Map<number, ProcessedArtist>;
  roleMapping: Map<number, Set<string>>;
}

export interface Track {
  duration: string;
  position: number;
  title: string;
  extraartists?: RawArtist[];
}
