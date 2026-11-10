import { useState } from "react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { track } from "@/lib/analytics";
import { LibraryStack } from "@/lib/stacks";
import {
  albumKeyOf,
  memberKey,
  StackMember,
  strandedBy,
} from "@/lib/stackRecords";
import { ChoiceDialog } from "../common/ChoiceDialog";
import { dialogButton } from "../common/buttons";

interface Pending {
  name: string;
  stranded: string[];
  confirm: () => void;
}

const listOf = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * Taking an album out of a stack, with a warning when that would leave
 * other albums with no link back to the start: `check` says whether a
 * removal strands any, and `confirm` runs the removal once the user agrees
 * (or straight away when nothing is stranded). Render `dialog` once.
 */
export const useStackRemoval = () => {
  const [pending, setPending] = useState<Pending | null>(null);

  /**
   * Removes `album` from the albums `albums` (a stack's, or a draft's),
   * calling `remove` now or after the warning.
   */
  const request = (
    album: Pick<SearchCache, "searchId" | "target" | "searchParams">,
    albums: SearchCache[],
    remove: () => void,
  ) => {
    const stranded = strandedBy(albums, new Set([albumKeyOf(album)]));
    if (stranded.length === 0) {
      remove();
      return;
    }
    setPending({
      name: album.searchParams.album,
      stranded: stranded.map((s) => s.searchParams.album),
      confirm: remove,
    });
  };

  const dialog = (
    <ChoiceDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title="This breaks the stack's links"
      description={
        pending &&
        `Without ${pending.name}, ${listOf(pending.stranded)} ${
          pending.stranded.length === 1 ? "has" : "have"
        } no link back to the stack's start. ${
          pending.stranded.length === 1 ? "It stays" : "They stay"
        } in the stack, marked as not linked, until you add an album that links ${
          pending.stranded.length === 1 ? "it" : "them"
        } again or take ${pending.stranded.length === 1 ? "it" : "them"} out.`
      }
    >
      <button
        type="button"
        onClick={() => setPending(null)}
        className={dialogButton.secondary}
      >
        Keep it
      </button>
      <button
        type="button"
        onClick={() => {
          pending?.confirm();
          setPending(null);
        }}
        className={dialogButton.primary}
      >
        Remove anyway
      </button>
    </ChoiceDialog>
  );

  return { request, dialog };
};

/** Takes an album out of a stack record and writes it. */
export const useRemoveFromStack = () => {
  const { updateStack } = useCache();
  const { request, dialog } = useStackRemoval();
  const remove = (stack: LibraryStack, album: SearchCache, from: string) =>
    request(album, stack.members, () => {
      const key = albumKeyOf(album);
      const members: StackMember[] = stack.record.members.filter(
        (m) => memberKey(m) !== key && m.searchId !== album.searchId,
      );
      track("stack_album_removed", { from, members: members.length });
      void updateStack({ ...stack.record, members });
    });
  return { remove, dialog };
};
