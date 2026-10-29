import React, { useCallback, useEffect, useRef, useState } from "react";

/** How long a press (or, with a mouse, a hover) lasts before details open. */
export const HOLD_MS = 1000;
/** A touch that moves farther than this is a scroll, not a hold. */
const MOVE_TOLERANCE = 8;

/**
 * Details that open after a one-second hold. With a mouse, resting on the
 * element for a second opens them (a tooltip: leaving or clicking closes
 * them); with touch or a pen, holding still for a second does, and they stay
 * until dismissed. The click that ends a hold, or the tap that dismisses
 * held-open details, is swallowed, so holding never toggles the element. The context menu key,
 * Shift+F10 and a right click open them at once.
 */
export type HoldVia = "hover" | "hold" | "key";

export const useHoldToOpen = (onOpen?: (via: HoldVia) => void) => {
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback(
    (next: boolean, via?: HoldVia) => {
      setOpenState(next);
      if (next && via) onOpen?.(via);
    },
    [onOpen],
  );
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const pointer = useRef<string>("mouse");
  const pressed = useRef(false);
  const swallowClick = useRef(false);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const arm = (e: React.PointerEvent) => {
    cancel();
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = undefined;
      // Released after this: that click ends the hold.
      if (pressed.current) swallowClick.current = true;
      setOpen(true, pressed.current ? "hold" : "hover");
    }, HOLD_MS);
  };

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && !open) arm(e);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancel();
      pressed.current = false;
      setOpen(false);
    },
    onPointerDown: (e: React.PointerEvent) => {
      pointer.current = e.pointerType;
      if (e.button !== 0) return;
      pressed.current = true;
      swallowClick.current = false;
      if (e.pointerType === "mouse") {
        // Hover details are a tooltip: a click closes them and still counts.
        setOpen(false);
        return;
      }
      if (open) {
        // A tap on held-open details dismisses them; it doesn't toggle too.
        swallowClick.current = true;
        cancel();
        setOpen(false);
        return;
      }
      arm(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" || !start.current) return;
      const moved = Math.hypot(
        e.clientX - start.current.x,
        e.clientY - start.current.y,
      );
      if (moved > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: (e: React.PointerEvent) => {
      pressed.current = false;
      if (e.pointerType !== "mouse") cancel();
    },
    onPointerCancel: () => {
      pressed.current = false;
      cancel();
    },
    onClickCapture: (e: React.MouseEvent) => {
      // A mouse click before the second is up isn't a hover any more.
      if (pointer.current === "mouse") cancel();
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      // A touch hold fires this early on some phones; it waits the second.
      if (pointer.current === "touch" || pointer.current === "pen") return;
      cancel();
      setOpen(true, "key");
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        // The context menu key also fires contextmenu; that's from a key.
        pointer.current = "keyboard";
        setOpen(true, "key");
      }
    },
  };

  return { open, setOpen: (next: boolean) => setOpen(next), handlers };
};
