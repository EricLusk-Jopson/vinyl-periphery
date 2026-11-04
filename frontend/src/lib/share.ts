import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { ALBUM_MAP_PEOPLE, layoutAlbumMap } from "./albumMap";
import { countedContributors, requiredFilters } from "./filters";
import { TransitMap } from "./transitMap";
import {
  LANES_SHARED,
  searchSwimlanes,
  Swimlanes,
  topLanes,
} from "./swimlanes";
import {
  resetFilterState,
  ScoredRelease,
  SORT_OPTIONS,
  SortKey,
  sortReleases,
} from "./results";
import {
  editsCaption,
  editsWithoutHidden,
  NO_EDITS,
  ShareEdits,
  shareSelection,
  withoutHidden,
} from "./shareSelection";
import {
  layoutStackMap,
  orderStackResults,
  stackAsSearch,
  stackMapCapacity,
  StackNode,
  stackResults,
} from "./stackMap";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Share images: the payload the renderer (POST /api/og) draws from, built
 * from data already in the app. Everything the image shows travels in the
 * body, so rendering never calls Discogs. Format: backend/og/payload.js.
 */

export type ShareLayout = "map" | "card" | "lanes" | "transit";

/** A stack album or result on the stack map, as sent. */
export interface ShareStackNode {
  t: string;
  r: string;
  i: string;
  /** Place and cover side, in thousandths of a step; y up. */
  x: number;
  y: number;
  s: number;
  /** One of the stack's own albums. */
  m?: 1;
  /** Nodes it's linked to (0 is the centre, k is n[k - 1]), for lines. */
  e?: number[];
  /**
   * A result's line weights, one per `e`: 1, 2 or 3 for one, two, or three
   * or more people shared.
   */
  w?: number[];
}

/**
 * Art id: "g:<release-group mbid>", "r:<release mbid>", "d:<i.discogs.com
 * path>", or "".
 */
type ArtId = string;

interface ShareAlbum {
  t: string;
  r: string;
  i: ArtId;
}

export type SharePayload =
  | {
      v: 1;
      l: "card";
      a: ShareAlbum;
      x: Array<ShareAlbum & { n: number }>;
      /** How the albums were chosen (sort and filters), when it says. */
      d?: string;
      /** No covers: every album as its title and artist. */
      nc?: 1;
    }
  | {
      v: 1;
      l: "map";
      c: ShareAlbum;
      /**
       * x, y: thousandths of the radius, y up; z: size tier; s: cover side
       * in thousandths of the radius, which wins over z when present.
       */
      n: Array<
        ShareAlbum & {
          x: number;
          y: number;
          z: 1 | 2;
          s?: number;
          /** The people (indices into p) linking it, for lines. */
          l?: number[];
        }
      >;
      /** People around the rim: name, and angle in degrees. */
      p: Array<{ n: string; a: number }>;
      d?: string;
      nc?: 1;
      /** No boilerplate: no header, caption or site; a bigger graph. */
      nb?: 1;
      /** Lines from each person to their albums (`l`). */
      ln?: 1;
    }
  | {
      v: 1;
      l: "stack";
      /** The stack's start, in the middle. */
      c: ShareAlbum & { s: number };
      /** The other stack albums, then the results around them. */
      n: ShareStackNode[];
      d?: string;
      nc?: 1;
      nb?: 1;
      /** Lines between linked albums (`e`). */
      ln?: 1;
    }
  | {
      v: 1;
      l: "lanes";
      /** The searched album. */
      c: ShareAlbum;
      /** The years drawn. */
      y: [number, number];
      /** Album lines: the searched album's year, `m` for the accent. */
      k: Array<{ t: string; y: number; m?: 1 }>;
      /** Lanes, in order: name, results, result and other years. */
      n: Array<{
        n: string;
        c: number;
        s: Array<[number, number]>;
        f: Array<[number, number]>;
        p?: 1;
      }>;
      /** Undated items, not drawn. */
      u?: number;
      d?: string;
    }
  | {
      v: 1;
      l: "transit";
      /** The stack's start. */
      c: ShareAlbum;
      /** The map's box, in layout units (see `transitMap.ts`). */
      w: number;
      h: number;
      s: Array<{
        t: string;
        r: string;
        x: number;
        y: number;
        /** Radius. */
        q: number;
        /** Colours of its lines. */
        k: number[];
        /** Label box: x, y, w, h. */
        b: [number, number, number, number];
        a: "start" | "middle" | "end";
      }>;
      /** Lines: name, colour, legs of [x, y] points. */
      n: Array<{ n: string; c: number; g: Array<Array<[number, number]>> }>;
      /** People on 2+ albums not drawn as lines. */
      o?: number;
      d?: string;
    };

/** Rows on the results card by default (it takes up to ten). */
export const SHARE_RESULTS = 5;

/** How many albums each layout can show, and how many it starts with. */
export const SHARE_COUNTS: Record<
  ShareLayout,
  { options: number[]; start: number }
> = {
  map: { options: [6, 12, 18, 24], start: 12 },
  card: { options: [3, 5, 8, 10], start: 5 },
  // Always the top LANES_SHARED people: nothing to choose.
  lanes: { options: [LANES_SHARED], start: LANES_SHARED },
  // Every stack album: nothing to choose.
  transit: { options: [0], start: 0 },
};

/**
 * The counts to offer when `available` albums match: those below it, then
 * "All" when it's under the largest. Nothing to choose with one album or
 * none.
 */
export const countOptions = (
  layout: ShareLayout,
  available: number,
  /** The most this share can draw (a crowded stack map), if fewer. */
  cap = Infinity,
): Array<{ count: number; label: string }> => {
  const { options } = SHARE_COUNTS[layout];
  const largest = options[options.length - 1];
  if (cap < Math.min(available, largest)) {
    const choices = [
      ...options
        .filter((n) => n < cap)
        .map((n) => ({ count: n, label: String(n) })),
      { count: cap, label: String(cap) },
    ];
    return choices.length > 1 ? choices : [];
  }
  const max = largest;
  const below = options.filter((n) => n < available && n < max);
  const all =
    available <= max ? [{ count: available, label: `All ${available}` }] : [];
  const choices = [
    ...below.map((n) => ({ count: n, label: String(n) })),
    ...(available > max ? [{ count: max, label: String(max) }] : all),
  ];
  return choices.length > 1 ? choices : [];
};

/**
 * The art id in a cover URL, or "": a Cover Art Archive URL, or an
 * i.discogs.com image (its path; the renderer fetches only that host).
 */
export const artIdFromCoverUrl = (url: string | null | undefined): ArtId => {
  const discogs =
    /^https:\/\/i\.discogs\.com\/([A-Za-z0-9._~:=+,%/-]{1,512})$/.exec(
      url ?? "",
    );
  if (discogs && !discogs[1].includes("..") && !discogs[1].startsWith("/")) {
    return `d:${discogs[1]}`;
  }
  const match =
    /^https:\/\/coverartarchive\.org\/(release-group|release)\/([0-9a-f-]{36})\//i.exec(
      url ?? "",
    );
  if (!match) return "";
  return `${match[1] === "release-group" ? "g" : "r"}:${match[2].toLowerCase()}`;
};

/** Looks up a cover URL for a result key (the app's cover resolver). */
export type CoverFor = (key: string) => string | null | undefined;

const artFor = (key: string | undefined, coverFor: CoverFor): ArtId =>
  key ? artIdFromCoverUrl(coverFor(key)) : "";

/** Periphery card: the searched album and its top results. */
export const cardPayload = (
  search: SearchCache,
  ranked: ScoredRelease[],
  coverFor: CoverFor,
  caption?: string,
  count = SHARE_RESULTS,
): SharePayload => ({
  v: 1,
  l: "card",
  a: {
    t: search.searchParams.album,
    r: search.searchParams.artist,
    i: artFor(search.target?.key, coverFor),
  },
  x: ranked.slice(0, count).map((release) => ({
    t: release.title,
    r: release.artist,
    i: artFor(release.key, coverFor),
    n: release.activeContributors.length,
  })),
  ...(caption ? { d: caption } : {}),
});

const sortName = (key: SortKey) =>
  SORT_OPTIONS.find((o) => o.value === key)?.short ?? key;

/**
 * How a share's albums were chosen, in a line for the image: "Top 12 by
 * Shared, then Newest · Liked only · 2 people off". Only filters that differ
 * from Reset are named.
 */
export const selectionCaption = (
  search: SearchCache,
  count: number,
  sort: SortKey,
  then: SortKey | null,
): string => {
  const { filterState } = search;
  const base = resetFilterState(search);
  const parts = [
    `Top ${count} by ${sortName(sort)}${then ? `, then ${sortName(then)}` : ""}`,
  ];
  if (filterState.likedOnly) parts.push("Liked only");
  if (filterState.collaborationsOnly) parts.push("2+ shared");
  if (filterState.excludeVarious) parts.push("No Various Artists");
  if (filterState.excludeMainArtist !== base.excludeMainArtist) {
    parts.push(`With ${search.searchParams.artist}'s own`);
  }
  const required = requiredFilters(filterState);
  const names = [
    ...required.contributors.map((id) =>
      defaultContributorDisplayPipeline(search.contributors[id]?.name ?? ""),
    ),
    ...required.roles,
  ].filter(Boolean);
  if (names.length > 0) {
    parts.push(
      `Must include ${names.slice(0, 2).join(", ")}${
        names.length > 2 ? ` +${names.length - 2}` : ""
      }`,
    );
  }
  const off = (states: Record<string | number, boolean>) =>
    Object.values(states).filter((on) => !on).length;
  const peopleOff = off(filterState.contributors);
  const rolesOff = off(filterState.roles);
  if (peopleOff > 0) {
    parts.push(`${peopleOff} ${peopleOff === 1 ? "person" : "people"} off`);
  }
  if (rolesOff > 0) {
    parts.push(`${rolesOff} ${rolesOff === 1 ? "role" : "roles"} off`);
  }
  return parts.join(" · ");
};

/**
 * Share map for one search: its album in the middle and `shown` (its top
 * results, as filtered and sorted) around it. See `albumMap.ts`.
 */
export const albumMapPayload = (
  search: SearchCache,
  shown: ScoredRelease[],
  likes: Likes,
  coverFor: CoverFor,
  caption?: string,
): SharePayload => {
  const { albums, people } = layoutAlbumMap(shown, search.contributors, likes);
  const names = (id: number) =>
    defaultContributorDisplayPipeline(search.contributors[id]?.name ?? "");
  // Names for the people linking the most albums; the rest still placed
  // the albums, but aren't drawn.
  const labelled = new Set(
    [...people]
      .sort((a, b) => b.albums - a.albums || a.id - b.id)
      .slice(0, ALBUM_MAP_PEOPLE)
      .map((p) => p.id),
  );
  const rim = people.filter((p) => labelled.has(p.id) && names(p.id));
  const rimIndex = new Map(rim.map((p, i) => [p.id, i]));
  return {
    v: 1,
    l: "map",
    c: {
      t: search.searchParams.album,
      r: search.searchParams.artist,
      i: artFor(search.target?.key, coverFor),
    },
    n: albums.map((album) => ({
      t: album.title,
      r: album.artist,
      i: artFor(album.key, coverFor),
      x: Math.round(album.x * 1000),
      y: Math.round(album.y * 1000),
      z: album.liked ? 2 : 1,
      s: Math.round(album.side * 1000),
      // Named people only: the lines run from their dots.
      l: album.people
        .map((id) => rimIndex.get(id))
        .filter((i): i is number => i !== undefined),
    })),
    p: rim.map((p) => ({
      n: names(p.id),
      a: (Math.round((p.angle * 180) / Math.PI) + 360) % 360,
    })),
    ...(caption ? { d: caption } : {}),
  };
};

/** How an image is drawn, chosen in the share sheet. */
export interface ShareView {
  /** Cover art, or titles and artists only. */
  covers: boolean;
  /** Lines from each person to their albums (maps that have them). */
  lines: boolean;
  /**
   * The header, caption and site on the maps; off, the graph fills the
   * image. Offered once unlocked (see `NO_BOILERPLATE`).
   */
  boilerplate: boolean;
}

export const DEFAULT_VIEW: ShareView = {
  covers: true,
  lines: false,
  boilerplate: true,
};

/** Typed into the share sheet's album search, it unlocks `boilerplate`. */
export const NO_BOILERPLATE = "no boilerplate";

/** Whether a payload has anything to draw lines from. */
export const canDrawLines = (payload: SharePayload): boolean =>
  payload.l === "map"
    ? payload.n.some((n) => (n.l?.length ?? 0) > 0)
    : payload.l === "stack" && payload.n.some((n) => (n.e?.length ?? 0) > 0);

/** The payload as `view` draws it: flags set, links kept only for lines. */
export const withView = (
  payload: SharePayload,
  view: ShareView,
): SharePayload => {
  const covers = view.covers ? {} : { nc: 1 as const };
  if (payload.l === "card") return { ...payload, ...covers };
  // Swimlanes and transit maps have no covers, lines or boilerplate switch.
  if (payload.l === "lanes" || payload.l === "transit") return payload;
  const lines = view.lines && canDrawLines(payload);
  const bare = view.boilerplate ? {} : { nb: 1 as const };
  if (payload.l === "stack") {
    return {
      ...payload,
      ...covers,
      ...bare,
      ...(lines ? { ln: 1 as const } : {}),
      n: payload.n.map(({ e, w, ...node }) =>
        lines && e ? { ...node, e, ...(w ? { w } : {}) } : node,
      ),
    };
  }
  return {
    ...payload,
    ...covers,
    ...bare,
    ...(lines ? { ln: 1 as const } : {}),
    n: payload.n.map(({ l, ...album }) =>
      lines && l ? { ...album, l } : album,
    ),
  };
};

/** The album at the middle of a map. */
export interface MapCentre {
  key: string;
  title: string;
  artist: string;
  /** Art known for it already (e.g. a lineage snapshot's cover URL). */
  thumb?: string;
}

/**
 * Share map for a stack: its albums a step apart from its start, and
 * results around them where they overlap most. See `stackMap.ts`.
 */
export const stackMapPayload = (
  centre: MapCentre,
  /** From `layoutStackMap`: the centre first. */
  nodes: StackNode[],
  coverFor: CoverFor,
  caption?: string,
): SharePayload => {
  const [middle, ...rest] = nodes;
  const thousandths = (n: number) => Math.round(n * 1000);
  return {
    v: 1,
    l: "stack",
    c: {
      t: centre.title,
      r: centre.artist,
      i: artFor(centre.key, coverFor) || artIdFromCoverUrl(centre.thumb),
      s: thousandths(middle.side),
    },
    n: rest.map((node) => ({
      t: node.title,
      r: node.artist,
      i: artFor(node.key, coverFor),
      x: thousandths(node.x - middle.x),
      y: thousandths(node.y - middle.y),
      s: thousandths(node.side),
      // Lines run from results only: none between the stack's own albums.
      ...(node.member ? { m: 1 as const } : { e: node.links }),
      ...(node.weights
        ? { w: node.weights.map((w) => Math.max(1, Math.min(3, w))) }
        : {}),
    })),
    ...(caption ? { d: caption } : {}),
  };
};

/** What a stack map shows, in a line: "4 albums stacked · 12 around them". */
export const stackCaption = (
  nodes: StackNode[],
  order?: { sort: SortKey; then: SortKey | null; likesFirst: boolean },
  edits?: string,
): string => {
  const stacked = nodes.filter((n) => n.member).length;
  const around = nodes.length - stacked;
  const by =
    order && around > 0
      ? `, by ${sortName(order.sort)}${order.then ? `, then ${sortName(order.then)}` : ""}`
      : "";
  return [
    `${stacked} ${stacked === 1 ? "album" : "albums"} stacked`,
    around > 0 ? `${around} around them${by}` : "",
    order?.likesFirst && around > 0 ? "Likes first" : "",
    edits ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
};

/** Whether a map would have anything around its centre. */
export const mapHasAlbums = (payload: SharePayload): boolean =>
  (payload.l === "map" || payload.l === "stack") && payload.n.length > 0;

/** A payload as text: two payloads draw the same image when these match. */
export const serialisePayload = (payload: SharePayload): string =>
  JSON.stringify(payload);

/** The payload with every art id blanked, to tell cover-only changes apart. */
const withoutArt = (payload: SharePayload): SharePayload => {
  const blank = <T extends { i: string }>(a: T): T => ({ ...a, i: "" });
  if (payload.l === "card") {
    return { ...payload, a: blank(payload.a), x: payload.x.map(blank) };
  }
  if (payload.l === "map") {
    return { ...payload, c: blank(payload.c), n: payload.n.map(blank) };
  }
  if (payload.l === "lanes" || payload.l === "transit") {
    return { ...payload, c: blank(payload.c) };
  }
  return { ...payload, c: blank(payload.c), n: payload.n.map(blank) };
};

/**
 * How the share sheet's draft differs from the image last made: "same",
 * "covers" (only art found since), or "changed".
 */
export const draftChange = (
  draft: SharePayload | null,
  committed: string | null,
): "same" | "covers" | "changed" => {
  if (!draft || committed === null) return "same";
  const text = serialisePayload(draft);
  if (text === committed) return "same";
  try {
    const before = JSON.parse(committed) as SharePayload;
    return serialisePayload(withoutArt(draft)) ===
      serialisePayload(withoutArt(before))
      ? "covers"
      : "changed";
  } catch {
    return "changed";
  }
};

/** The order of a stack's results in its share map. */
export interface StackOrder {
  sort: SortKey;
  then: SortKey | null;
  likesFirst: boolean;
}

/**
 * Everything the share sheet's controls set. The image is made from it
 * only when the user presses Regenerate (and once when the sheet opens).
 */
export interface ShareDraft {
  /** The layout picked (one search only; a stack is always a map). */
  chosen: ShareLayout;
  /** How many albums each layout draws. */
  counts: Record<ShareLayout, number>;
  /** Albums taken out of the image or added to it. */
  edits: ShareEdits;
  view: ShareView;
  /** A stack's results: their order, and whether liked ones come first. */
  stackOrder: StackOrder;
}

export const defaultDraft = (): ShareDraft => ({
  chosen: "map",
  counts: {
    map: SHARE_COUNTS.map.start,
    card: SHARE_COUNTS.card.start,
    lanes: SHARE_COUNTS.lanes.start,
    transit: SHARE_COUNTS.transit.start,
  },
  edits: NO_EDITS,
  view: DEFAULT_VIEW,
  stackOrder: { sort: "shared", then: null, likesFirst: true },
});

/** What a share draws from: the page's data, not the sheet's choices. */
export type ShareData = {
  likes: Likes;
  /** Hidden albums: never drawn, whatever the page shows. */
  hidden: Record<string, unknown>;
  /** The app's cover lookup, read when the payload is built. */
  coverFor: CoverFor;
} & (
  | {
      kind: "search";
      search: SearchCache;
      /** The results as the page filters them. */
      releases: ScoredRelease[];
      /** The page's order. */
      selection: { sort: SortKey; then: SortKey | null };
    }
  | {
      kind: "stack";
      /** The stack's root search, for names and contributors. */
      search: SearchCache;
      centre: MapCentre;
      members: SearchCache[];
      levels: Map<string, number>;
      /** The results as the Results tab filters them, or every result. */
      results?: ScoredRelease[];
      /**
       * Stack albums switched off in the filters (by album key): left off
       * the ring, with their links, as on the Results tab.
       */
      albumsOff?: string[];
      /** The stack as a transit map (left to right), as its Map tab has it. */
      transit?: TransitMap;
    }
);

/**
 * A stack's albums less those switched off, and its centre: the start, or
 * (when that's off) the shallowest album left.
 */
export const stackMembersOn = (
  centre: MapCentre,
  members: SearchCache[],
  levels: Map<string, number>,
  albumsOff: string[] = [],
): { centre: MapCentre; members: SearchCache[] } => {
  const off = new Set(albumsOff);
  const on = members.filter((m) => !off.has(m.target?.key ?? ""));
  if (!off.has(centre.key) || on.length === 0) return { centre, members: on };
  const first = [...on].sort(
    (a, b) =>
      (levels.get(a.searchId) ?? 0) - (levels.get(b.searchId) ?? 0) ||
      (a.savedAt ?? 0) - (b.savedAt ?? 0),
  )[0];
  return {
    centre: {
      key: first.target?.key ?? "",
      title: first.searchParams.album,
      artist: first.searchParams.artist,
      thumb: first.thumb,
    },
    members: on,
  };
};

/** What a draft would draw, before covers: for the sheet's controls. */
export interface SharePlan {
  layout: ShareLayout;
  /** The edits, less hidden albums. */
  edits: ShareEdits;
  /** The albums this layout draws around its centre, or lists. */
  shown: ScoredRelease[];
  /** The map has something around its centre. */
  mapReady: boolean;
  /** Albums there are to draw: the list less removed ones, plus added. */
  available: number;
  /**
   * The most a stack map can draw with covers big enough to read, when
   * that's fewer than there are to draw and than the largest count.
   */
  cap?: number;
  /** The search the album picker reads (a stack's as one search). */
  pickerSearch: SearchCache;
  /** Keys the picker counts as in the results. */
  visibleKeys: Set<string>;
  /** The stack map's nodes (the centre first); empty for one search. */
  stackNodes: StackNode[];
  /** The stack map's centre (the start, unless switched off). */
  centre?: MapCentre;
  /** The swimlanes drawn, when that's the layout. */
  lanes?: Swimlanes;
  /** There are people with dated items to draw as swimlanes. */
  lanesReady?: boolean;
  /** The stack has lines to draw as a transit map. */
  transitReady?: boolean;
  /** Albums to find covers for: everything the image may draw. */
  wanted: string[];
  /** The caption the image will carry. */
  caption?: string;
}

/** What a draft draws from `data`. Pure. */
export const planShare = (draft: ShareDraft, data: ShareData): SharePlan => {
  const edits = editsWithoutHidden(draft.edits, data.hidden);
  if (data.kind === "search") {
    const { search, selection } = data;
    const ranked = withoutHidden(
      sortReleases(data.releases, selection.sort, selection.then),
      data.hidden,
    );
    const mapShown = shareSelection(search, ranked, draft.counts.map, edits);
    const cardShown = shareSelection(search, ranked, draft.counts.card, edits);
    const mapReady = mapShown.length > 0;
    const allLanes = searchSwimlanes(
      search,
      countedContributors(search),
      ranked,
    );
    const lanes = topLanes(allLanes, LANES_SHARED);
    const lanesReady = lanes.lanes.some((l) => l.ticks.length > 0);
    const layout: ShareLayout =
      draft.chosen === "lanes"
        ? lanesReady
          ? "lanes"
          : "card"
        : mapReady
          ? draft.chosen
          : "card";
    const shown = layout === "map" ? mapShown : cardShown;
    const caption =
      layout === "lanes"
        ? lanesCaption(
            search,
            lanes.lanes.length,
            allLanes.lanes.length,
            selection,
          )
        : [
            selectionCaption(
              search,
              shown.length,
              selection.sort,
              selection.then,
            ),
            editsCaption(edits),
          ]
            .filter(Boolean)
            .join(" · ");
    return {
      layout,
      edits,
      shown,
      mapReady,
      available: available(ranked, edits),
      pickerSearch: search,
      visibleKeys: new Set(ranked.map((r) => r.key)),
      stackNodes: [],
      ...(layout === "lanes" ? { lanes } : {}),
      lanesReady,
      // The swimlanes draw no covers.
      wanted:
        draft.view.covers && layout !== "lanes"
          ? [search.target?.key ?? "", ...shown.map((r) => r.key)].filter(
              Boolean,
            )
          : [],
      caption,
    };
  }
  const { centre, members } = stackMembersOn(
    data.centre,
    data.members,
    data.levels,
    data.albumsOff,
  );
  const list = withoutHidden(
    data.results ?? stackResults(centre, members),
    data.hidden,
  );
  const { stackOrder } = draft;
  const ordered = orderStackResults(
    list,
    stackOrder.sort,
    stackOrder.then,
    data.likes,
    stackOrder.likesFirst,
  );
  const pickerSearch = stackAsSearch(data.search, members, list);
  const pick = (count: number) =>
    shareSelection(pickerSearch, ordered, count, edits);
  const largest = SHARE_COUNTS.map.options[SHARE_COUNTS.map.options.length - 1];
  const most = Math.min(available(list, edits), largest);
  const capacity = stackMapCapacity(
    centre,
    members,
    data.levels,
    data.likes,
    (count) => pick(count).map((r) => r.key),
    most,
  );
  const shown = pick(Math.min(draft.counts.map, capacity));
  const stackNodes = layoutStackMap(
    centre,
    members,
    data.levels,
    data.likes,
    shown.map((r) => r.key),
  );
  const transitReady = (data.transit?.lines.length ?? 0) > 0;
  const transit = draft.chosen === "transit" && transitReady;
  return {
    layout: transit ? "transit" : "map",
    transitReady,
    edits,
    shown,
    mapReady: stackNodes.length > 1,
    available: available(list, edits),
    ...(capacity < most ? { cap: capacity } : {}),
    pickerSearch,
    visibleKeys: new Set(list.map((r) => r.key)),
    stackNodes,
    centre,
    wanted:
      draft.view.covers && !transit
        ? [centre.key, ...stackNodes.slice(1).map((n) => n.key)]
        : [],
    caption:
      transit && data.transit
        ? transitCaption(data.transit)
        : stackCaption(stackNodes, stackOrder, editsCaption(edits)),
  };
};

const available = (pool: ScoredRelease[], edits: ShareEdits) =>
  new Set([
    ...pool.map((r) => r.key).filter((k) => !edits.removed.includes(k)),
    ...edits.added,
  ]).size;

/**
 * The image a draft makes: its payload, with covers as `data.coverFor`
 * knows them now. Pure apart from that lookup.
 */
export const buildPayload = (
  draft: ShareDraft,
  data: ShareData,
  plan: SharePlan = planShare(draft, data),
): SharePayload => {
  const { coverFor } = data;
  const drawn =
    data.kind === "stack" && plan.layout === "transit" && data.transit
      ? transitPayload(data.centre, data.transit, plan.caption)
      : data.kind === "stack"
        ? stackMapPayload(
            plan.centre ?? data.centre,
            plan.stackNodes,
            coverFor,
            plan.caption,
          )
        : plan.layout === "lanes" && plan.lanes
          ? lanesPayload(data.search, plan.lanes, plan.caption)
          : plan.layout === "map"
            ? albumMapPayload(
                data.search,
                plan.shown,
                data.likes,
                coverFor,
                plan.caption,
              )
            : cardPayload(
                data.search,
                plan.shown,
                coverFor,
                plan.caption,
                plan.shown.length,
              );
  return withView(drawn, draft.view);
};

/**
 * How the swimlanes were chosen, in a line: "Top 8 of 23 people by results
 * · 2+ shared · Liked only". Filters as `selectionCaption` names them.
 */
export const lanesCaption = (
  search: SearchCache,
  shown: number,
  of: number,
  selection: { sort: SortKey; then: SortKey | null },
): string => {
  const filters = selectionCaption(search, 0, selection.sort, selection.then)
    .split(" · ")
    .slice(1);
  return [
    shown < of
      ? `Top ${shown} of ${of} people by results`
      : `${shown} ${shown === 1 ? "person" : "people"}`,
    ...filters,
  ].join(" · ");
};

/** The swimlanes share image: the lanes as drawn, ticks by year. */
export const lanesPayload = (
  search: SearchCache,
  lanes: Swimlanes,
  caption?: string,
): SharePayload => ({
  v: 1,
  l: "lanes",
  c: {
    t: search.searchParams.album,
    r: search.searchParams.artist,
    i: "",
  },
  y: [lanes.from, lanes.to],
  k: lanes.albums.map((a) => ({
    t: a.title,
    y: a.year,
    ...(a.accent ? { m: 1 as const } : {}),
  })),
  n: lanes.lanes.map((lane) => ({
    n: lane.name,
    c: lane.results,
    s: lane.ticks
      .filter((t) => t.results.length > 0)
      .map((t) => [t.year, t.results.length] as [number, number]),
    f: lane.ticks
      .filter((t) => t.others > 0)
      .map((t) => [t.year, t.others] as [number, number]),
    ...(lane.partial ? { p: 1 as const } : {}),
  })),
  ...(lanes.undated > 0 ? { u: lanes.undated } : {}),
  ...(caption ? { d: caption } : {}),
});

/** What a transit map shows, in a line: "6 albums · 4 people as lines". */
export const transitCaption = (map: TransitMap): string =>
  [
    `${map.stations.length} ${map.stations.length === 1 ? "album" : "albums"}`,
    `${map.lines.length} ${map.lines.length === 1 ? "person" : "people"} as lines`,
    map.others.length > 0 ? `${map.others.length} more on two or more` : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** The transit map share image, laid out as on the Map tab. */
export const transitPayload = (
  centre: MapCentre,
  map: TransitMap,
  caption?: string,
): SharePayload => ({
  v: 1,
  l: "transit",
  c: { t: centre.title, r: centre.artist, i: "" },
  w: map.width,
  h: map.height,
  s: map.stations.map((s) => ({
    t: s.label.title,
    r: s.label.artist,
    x: s.x,
    y: s.y,
    q: s.radius,
    k: s.lines,
    b: [s.label.x, s.label.y, s.label.w, s.label.h],
    a: s.label.align,
  })),
  n: map.lines.map((l) => ({
    n: l.name,
    c: l.colour,
    g: l.legs.map((leg) => leg.map((p) => [p.x, p.y] as [number, number])),
  })),
  ...(map.others.length > 0 ? { o: map.others.length } : {}),
  ...(caption ? { d: caption } : {}),
});
