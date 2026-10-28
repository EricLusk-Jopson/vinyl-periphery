import React, { useState } from "react";
import { useCache } from "@/contexts/cache/CacheContext";
import { track } from "@/lib/analytics";
import { LibraryStack, stackLabel } from "@/lib/stacks";
import { ChoiceDialog } from "../common/ChoiceDialog";
import { dialogButton } from "../common/buttons";

export type StackAction = "delete" | "disband";

interface StackConfirmProps {
  /** The stack and what to do to it; null when closed. */
  request: { stack: LibraryStack; action: StackAction } | null;
  onClose: () => void;
  /** After it's done, e.g. to leave the stack's page. */
  onDone?: (action: StackAction) => void;
}

/**
 * Confirms a whole-stack action. Delete removes every search in it.
 * Destack (`disband`) keeps them all, each on its own.
 */
export const StackConfirm: React.FC<StackConfirmProps> = ({
  request,
  onClose,
  onDone,
}) => {
  const { deleteStack, disbandStack } = useCache();
  const [busy, setBusy] = useState(false);
  const count = request?.stack.members.length ?? 0;
  const label = request ? stackLabel(request.stack) : "";
  const deleting = request?.action === "delete";

  const confirm = async () => {
    if (!request || busy) return;
    setBusy(true);
    try {
      const { stack, action } = request;
      const members = await (action === "delete" ? deleteStack : disbandStack)(
        stack.stackId,
      );
      track(action === "delete" ? "stack_deleted" : "stack_disbanded", {
        members,
      });
      onClose();
      onDone?.(action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChoiceDialog
      open={request !== null}
      onOpenChange={(open) => !open && onClose()}
      title={deleting ? "Delete this stack?" : "Destack this stack?"}
      description={
        deleting
          ? `This deletes the ${count} searches in ${label}.`
          : `The ${count} searches in ${label} stay in your library, each on its own.`
      }
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
        {deleting ? `Delete ${count} searches` : "Destack"}
      </button>
    </ChoiceDialog>
  );
};
