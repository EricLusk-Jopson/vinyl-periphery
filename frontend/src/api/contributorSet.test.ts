import {
  addBandMembers,
  addContributorToSet,
  BAND_MEMBER,
  releaseHasCredits,
} from "./contributorSet";
import { ContributorSetInternal } from "./types";

const artist = (id: number, name: string, role?: string) => ({
  id,
  name,
  resource_url: "",
  ...(role ? { role } : {}),
});

const freshSet = (): ContributorSetInternal => ({ contributors: new Map() });

describe("releaseHasCredits", () => {
  it("finds credits on the release or its tracks", () => {
    expect(releaseHasCredits({})).toBe(false);
    expect(releaseHasCredits({ extraartists: [] })).toBe(false);
    expect(
      releaseHasCredits({ extraartists: [artist(1, "A", "Producer")] }),
    ).toBe(true);
    expect(
      releaseHasCredits({
        tracklist: [{}, { extraartists: [artist(2, "B", "Bass")] }],
      }),
    ).toBe(true);
  });
});

describe("addBandMembers", () => {
  // Every member the band has had: only Dave played on this album.
  const members = [artist(10, "Dave"), artist(11, "Former Drummer")];

  it("marks credited members as band, and adds no one else", () => {
    const set = freshSet();
    addContributorToSet(set, artist(10, "Dave", "Guitar"), "credits");
    addBandMembers(set, members, true);
    expect([...set.contributors.keys()]).toEqual([10]);
    const dave = set.contributors.get(10)!;
    expect([...dave.sources].sort()).toEqual(["credits", "member"]);
    expect([...dave.roles]).not.toContain(BAND_MEMBER);
  });

  it("adds every member as a Band Member when there are no credits", () => {
    const set = freshSet();
    addBandMembers(set, members, false);
    expect([...set.contributors.keys()]).toEqual([10, 11]);
    expect([...set.contributors.get(11)!.roles]).toEqual([BAND_MEMBER]);
    expect([...set.contributors.get(11)!.sources]).toEqual(["member"]);
  });
});
