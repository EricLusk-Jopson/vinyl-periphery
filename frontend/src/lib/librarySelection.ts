/**
 * Selecting albums in the library to delete several at once: the
 * selection's helpers and what the selection bar and toast say.
 */

/** The selection with `id` added, or taken out if it was in. */
export const toggled = (
  selected: ReadonlySet<string>,
  id: string,
): Set<string> => {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Whether every shown album is selected (and there's at least one). */
export const allSelected = (
  selected: ReadonlySet<string>,
  shown: string[],
): boolean => shown.length > 0 && shown.every((id) => selected.has(id));

/**
 * Select all of the shown albums, or, when they're all selected already,
 * none of them. Selected albums not shown (filtered out) stay selected.
 */
export const toggleAll = (
  selected: ReadonlySet<string>,
  shown: string[],
): Set<string> => {
  const next = new Set(selected);
  if (allSelected(selected, shown)) shown.forEach((id) => next.delete(id));
  else shown.forEach((id) => next.add(id));
  return next;
};

const albums = (n: number) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? "album" : "albums"}`;

/** "3 selected", or the hint before any are. */
export const selectionLabel = (count: number): string =>
  count === 0
    ? "Choose albums to delete"
    : `${count.toLocaleString("en-US")} selected`;

/**
 * The note under the bar when some selected albums are in stacks: they
 * stay there, greyed, with Search to run them again.
 */
export const stackedNote = (inStacks: number): string | null =>
  inStacks === 0
    ? null
    : `${inStacks === 1 ? "1 is in a stack" : `${inStacks.toLocaleString("en-US")} are in stacks`}. Deleted, ${
        inStacks === 1 ? "it stays" : "they stay"
      } there greyed out, with Search to run ${inStacks === 1 ? "it" : "them"} again.`;

/** The toast after deleting: its title and a line naming the albums. */
export const deletedToast = (
  titles: string[],
): { title: string; description: string } => {
  const rest = titles.length - 2;
  return {
    title:
      titles.length === 1
        ? "Album deleted"
        : `${albums(titles.length)} deleted`,
    description:
      rest <= 0
        ? titles.join(" and ")
        : `${titles.slice(0, 2).join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`,
  };
};
