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
  roles: string[];
  sources: ContributorSource[];
  resourceUrl: string;
}

export interface ContributorSet {
  contributors: Record<number, Contributor>;
}

export interface ContributorSetInternal {
  contributors: Map<
    number,
    {
      id: number;
      name: string;
      roles: Set<string>;
      sources: Set<ContributorSource>;
      resourceUrl: string;
    }
  >;
}

export interface EnrichedRelease {
  id: number;
  title: string;
  year: string;
  artist: string;
  thumb: string;
  resource_url: string;
  contributorIds: number[];
}

export interface SearchParams {
  artist: string;
  album: string;
}

export interface ReleasesParams {
  releases: SearchResult[];
  maxReleases: number;
}

export interface SearchStage {
  id: "initial" | "contributors" | "releases";
  label: string;
  current: number;
  total: number;
}

export interface MutationCallbacks {
  onProgress?: (stage: SearchStage) => void;
}

export interface SearchMutationParams {
  params: SearchParams;
  callbacks?: MutationCallbacks;
}

export interface ContributorMutationParams {
  releases: SearchResult[];
  maxReleases: number;
  callbacks?: MutationCallbacks;
}

export interface ReleaseMutationParams {
  contributorSet: ContributorSet;
  callbacks?: MutationCallbacks;
}
