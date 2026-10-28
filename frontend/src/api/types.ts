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

/**
 * How a contributor's own discography lists a release: a coarse role
 * ("Main", "Appearance", "TrackAppearance", or a credit such as "Producer")
 * and, for some, the tracks or titles it covers.
 */
export interface Appearance {
  role: string;
  trackinfo?: string;
}

export type ReleaseType = "master" | "release";

export interface EnrichedRelease {
  id: number;
  /** Masters and releases have separate id spaces. */
  type: ReleaseType;
  /** "master:123" or "release:456": unique across both, used as the map key. */
  key: string;
  /**
   * For a master, the `main_release` from the first contributor's
   * discography item. Artist releases set it per person and role (the
   * release where they have that credit), not to the master's own main
   * release.
   */
  mainRelease?: number;
  /**
   * For a release, its master when the discography item says so. Artist
   * releases don't send it (none of 32 release items sampled had one); kept
   * so other sources can fold releases into masters.
   */
  masterId?: number;
  title: string;
  year: string;
  artist: string;
  thumb: string;
  resource_url: string;
  contributorIds: number[];
  /**
   * Contributor id -> how their discography lists this release. A fallback
   * when the release's own credits don't name them. Missing on searches run
   * before it was kept.
   */
  appearances?: Record<number, Appearance>;
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
  /** Called after each contributor's discography is read. */
  onContributorChecked?: (name: string, releaseCount: number) => void;
}

export interface SearchMutationParams {
  params: SearchParams;
  callbacks?: MutationCallbacks;
  signal?: AbortSignal;
}

export interface ContributorMutationParams {
  releases: SearchResult[];
  maxReleases: number;
  callbacks?: MutationCallbacks;
  signal?: AbortSignal;
}

export interface ReleaseMutationParams {
  contributorSet: ContributorSet;
  callbacks?: MutationCallbacks;
  signal?: AbortSignal;
}
