import React, { useState } from "react";
import { useCache } from "@/contexts/cache/CacheContext";
import { track } from "@/lib/analytics";
import { LibraryStack, stackLabel } from "@/lib/stacks";
import { ChoiceDialog } from "../common/ChoiceDialog";
import { dialogButton } from "../common/buttons";

interface StackConfirmProps {
  /** The stack to destack; null when closed. */
  stack: LibraryStack | null;
  onClose: () => void;
  /** After it's done, e.g. to leave the stack's page. */
  onDone?: () => void;
}

/**
 * Confirms Destack: every search in the stack stays in the library, each
 * on its own. (Searches are deleted one at a time, from their own cards.)
 */
export const StackConfirm: React.FC<StackConfirmProps> = ({
  stack,
  onClose,
  onDone,
}) => {
  const { disbandStack } = useCache();
  const [busy, setBusy] = useState(false);
  const count = stack?.members.length ?? 0;
  const label = stack ? stackLabel(stack) : "";

  const confirm = async () => {
    if (!stack || busy) return;
    setBusy(true);
    try {
      const members = await disbandStack(stack.stackId);
      track("stack_disbanded", { members });
      onClose();
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChoiceDialog
      open={stack !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Destack this stack?"
      description={`The ${count} searches in ${label} stay in your library, each on its own.`}
    >
      <button
        type="button"
        onClick={onClose}
        className={dialogButton.secondary}
      >
        Keep it
      </button>
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={busy}
        className={dialogButton.primary}
      >
        Destack
      </button>
    </ChoiceDialog>
  );
};
