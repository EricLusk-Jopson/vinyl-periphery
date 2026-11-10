import React, { useId } from "react";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * One line of the image's words, as written in the sheet: shows the
 * default until edited; clearing it leaves the line off the image; "Use
 * the default" goes back.
 */
const Field: React.FC<{
  label: string;
  value: string | undefined;
  fallback: string;
  multiline?: boolean;
  onChange: (value: string | undefined) => void;
}> = ({ label, value, fallback, multiline, onChange }) => {
  const id = useId();
  const shown = value ?? fallback;
  const className = cn(
    "w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[15px] text-foreground placeholder:text-faint",
    focusRing,
  );
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={shown}
          rows={2}
          maxLength={160}
          placeholder="None"
          onChange={(e) => onChange(e.target.value)}
          className={cn(className, "min-h-11 resize-none")}
        />
      ) : (
        <input
          id={id}
          value={shown}
          maxLength={80}
          placeholder="None"
          onChange={(e) => onChange(e.target.value)}
          className={cn(className, "h-11")}
        />
      )}
      {value !== undefined && value !== fallback && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={cn(
            "inline-flex min-h-11 items-center self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground",
            focusRing,
          )}
        >
          Use the default
        </button>
      )}
    </div>
  );
};

/** The image's subtitle and caption, editable; empty leaves them off. */
export const ImageText: React.FC<{
  text: { subtitle?: string; caption?: string };
  defaults: { subtitle: string; caption: string };
  onChange: (text: { subtitle?: string; caption?: string }) => void;
}> = ({ text, defaults, onChange }) => (
  <div className="flex flex-col gap-3">
    <Field
      label="Subtitle"
      value={text.subtitle}
      fallback={defaults.subtitle}
      onChange={(subtitle) => onChange({ ...text, subtitle })}
    />
    <Field
      label="Caption"
      value={text.caption}
      fallback={defaults.caption}
      multiline
      onChange={(caption) => onChange({ ...text, caption })}
    />
  </div>
);
