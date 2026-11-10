import React, { useState } from "react";
import { useCache } from "@/contexts/cache/CacheContext";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { LibraryStack } from "@/lib/stacks";
import { ChoiceDialog } from "../common/ChoiceDialog";
import { dialogButton } from "../common/buttons";
import { ToastAction } from "../ui/toast";

interface DeleteStackConfirmProps {
  /** The stack to delete; null when closed. */
  stack: LibraryStack | null;
  onClose: () => void;
  /** After it's deleted, e.g. to leave the stack's page. */
  onDone?: () => void;
}

/**
 * Confirms deleting a stack. Its albums stay in the library (and in any
 * other stacks); a toast offers Undo.
 */
export const DeleteStackConfirm: React.FC<DeleteStackConfirmProps> = ({
  stack,
  onClose,
  onDone,
}) => {
  const { deleteStack, restoreStack } = useCache();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const count = stack?.record.members.length ?? 0;
  const name = stack?.record.name ?? "";

  const confirm = async () => {
    if (!stack || busy) return;
    setBusy(true);
    try {
      const { record } = stack;
      await deleteStack(record.id);
      track("stack_deleted", { members: count });
      onClose();
      onDone?.();
      toast({
        title: "Stack deleted",
        description: `${name}. Its albums are still in your library.`,
        action: (
          <ToastAction
            altText="Undo delete"
            onClick={() => void restoreStack(record)}
          >
            Undo
          </ToastAction>
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChoiceDialog
      open={stack !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Delete this stack?"
      description={`${name} goes. Its ${count} ${
        count === 1 ? "album stays" : "albums stay"
      } in your library, and in any other stacks.`}
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
        Delete stack
      </button>
    </ChoiceDialog>
  );
};
