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
  /** For a master, the release Discogs lists as its main version. */
  mainRelease?: number;
  /**
   * For a release, its master when the discography item says so. Unverified
   * whether Discogs sends this on artist releases; folded on when present.
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

/**
 * The Discogs album a search is about. Text searches resolve it from the
 * first search result; searches started from a result row know it already.
 */
export interface SearchTarget {
  type: ReleaseType;
  id: number;
  /** "master:123" / "release:456", as EnrichedRelease.key. */
  key: string;
}

/** The credits step reads only each release's id. */
export type ReleaseToRead = Pick<SearchResult, "id">;

export interface ReleasesParams {
  releases: ReleaseToRead[];
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
  releases: ReleaseToRead[];
  maxReleases: number;
  callbacks?: MutationCallbacks;
  signal?: AbortSignal;
}

export interface ReleaseMutationParams {
  contributorSet: ContributorSet;
  callbacks?: MutationCallbacks;
  signal?: AbortSignal;
}
