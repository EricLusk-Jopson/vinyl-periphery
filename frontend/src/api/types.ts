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
  id: number;
  name: string;
  role?: string | string[];
  resource_url: string;
}

export interface Track {
  duration: string;
  position: number;
  title: string;
  extraartists?: RawArtist[];
}

export type ContributorSource = "credits" | "artist" | "member";

export interface Contributor {
  id: number;
  name: string;
  roles: Set<string>;
  sources: Set<ContributorSource>;
  resourceUrl: string;
}

export interface ContributorSet {
  contributors: Map<number, Contributor>;
}

export interface EnrichedRelease {
  id: number;
  title: string;
  year: string;
  artist: string;
  thumb: string;
  resource_url: string;
  contributors: {
    fromCredits: Set<number>;
    fromArtists: Set<number>;
    fromMembers: Set<number>;
  };
}

export interface SearchParams {
  artist: string;
  album: string;
}

export interface ReleasesParams {
  releases: SearchResult[];
  maxReleases: number;
}
