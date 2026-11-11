import React, { useState } from "react";
import { isTrackingOff, setTrackingOff } from "@/lib/analytics";
import { dialogButton } from "../common/buttons";

/**
 * `/no-track`: turns the site's anonymous usage events off (or back on) for
 * this browser, with a cookie, so the owner's own visits stay out of the
 * numbers. Not linked from anywhere.
 */
export const NoTrackPage: React.FC = () => {
  const [off, setOff] = useState(isTrackingOff);
  const toggle = () => {
    setTrackingOff(!off);
    // Read back: a blocked cookie leaves it as it was.
    setOff(isTrackingOff());
  };

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-24 pt-8 md:px-6 md:pt-14">
      <h1 className="font-display text-[30px] font-normal leading-none tracking-[0.3px] md:text-[56px] md:tracking-[0.5px]">
        Usage events
      </h1>
      <p className="mt-5 text-base" aria-live="polite">
        {off
          ? "Off in this browser. Nothing you do here is counted."
          : "On in this browser. Visits are counted anonymously."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        A cookie keeps the setting for 400 days, in this browser only. Each
        browser and device needs it set on its own, and clearing cookies turns
        it back on.
      </p>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={off}
        className={`${off ? dialogButton.secondary : dialogButton.primary} mt-6`}
      >
        {off ? "Count this browser again" : "Stop counting this browser"}
      </button>
    </div>
  );
};
