/**
 * Role strings as Discogs sends them, awkward ones on purpose: brackets,
 * lists, odd spellings, and credits from real releases. Each with the
 * group it should land in (for a list, the groups in order).
 */
export const AWKWARD_ROLES: [string, string[]][] = [
  ["Drums [Uncredited]", ["session"]],
  ["Percussion, Drums", ["session"]],
  ["Bass, Vocals", ["session"]],
  ["Bass, Producer", ["session", "production"]],
  ["Producer [Produced With]", ["production"]],
  ["Recorded By, Mixed By", ["engineering"]],
  ["Mastered By", ["engineering"]],
  ["Lacquer Cut By", ["engineering"]],
  ["Engineer [Assistant]", ["engineering"]],
  ["Photography By [Other Photos]", ["art"]],
  ["Design, Layout", ["art"]],
  ["Artwork [Cover Painting]", ["art"]],
  ["Written-By", ["session"]],
  ["Strings Arranged By", ["session"]],
  ["Executive-Producer", ["production"]],
  ["Remix [Uncredited]", ["production"]],
  ["Tenor Saxophone", ["session"]],
  ["Electric Guitar, Acoustic Guitar", ["session"]],
  ["Synthesizer [Moog]", ["session"]],
  ["Backing Vocals", ["session"]],
  ["Liner Notes", ["other"]],
  ["Management", ["other"]],
  ["Other [Bartender]", ["other"]],
];
