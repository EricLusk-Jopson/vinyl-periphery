import React from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface ChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** The buttons, main action last (it sits on the right on wide screens). */
  children: React.ReactNode;
}

/**
 * A small centred dialog for a decision: a title, a sentence, two or three
 * buttons. Radix traps focus and closes it on Escape.
 */
export const ChoiceDialog: React.FC<ChoiceDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border bg-surface p-5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 md:p-6">
        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">
          {description}
        </Dialog.Description>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {children}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
