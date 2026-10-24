import React, { useEffect, useId, useState } from "react";
import { Type, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BODY_FONTS,
  DEFAULT_SETTINGS,
  FLOURISH_FONTS,
  PRESETS,
  TITLE_FONTS,
  TypeSettings,
  applySettings,
  matchPreset,
  parseSettings,
} from "@/lib/typePresets";

const STORAGE_KEY = "vp-type-demo";

const initialSettings = (): TypeSettings => {
  const fromUrl = new URLSearchParams(window.location.search).get("type");
  const preset = PRESETS.find((p) => p.id === fromUrl);
  if (preset) return preset;
  try {
    const saved = parseSettings(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")
    );
    if (saved) return saved;
  } catch {
    // Storage unavailable or corrupt: fall through to the default.
  }
  return DEFAULT_SETTINGS;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * Demo-only control for comparing type combinations on the real pages.
 * Not part of the redesign; remove before merging anything from this branch.
 */
export const TypeSwitcher: React.FC = () => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<TypeSettings>(initialSettings);

  useEffect(() => {
    applySettings(document.documentElement, settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Not persisting is fine.
    }
  }, [settings]);

  const update = (patch: Partial<TypeSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  const preset = matchPreset(settings);
  const label = preset?.name ?? "Custom";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Type demo: ${label}. Open type options`}
        className={cn(
          "fixed bottom-4 left-4 z-overlay inline-flex h-11 items-center gap-2 border border-dim bg-surface px-3 text-sm font-semibold text-foreground shadow-lg",
          focusRing
        )}
      >
        <Type className="h-4 w-4" aria-hidden="true" />
        Type · {label}
      </button>
    );
  }

  const select = (
    labelText: string,
    value: string,
    options: Record<string, string>,
    onChange: (v: string) => void
  ) => {
    const selectId = `${id}-${labelText}`;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-xs font-semibold text-muted-foreground">
          {labelText}
        </label>
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 border border-dim bg-background px-2 text-sm text-foreground",
            focusRing
          )}
        >
          {Object.entries(options).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <section
      aria-label="Type demo"
      className="fixed bottom-4 left-4 z-overlay flex max-h-[calc(100vh-2rem)] w-[min(320px,calc(100vw-2rem))] flex-col overflow-y-auto border border-dim bg-surface text-foreground shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-dim px-4 py-2">
        <h2 className="text-sm font-semibold">Type demo</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close type options"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center text-foreground hover:bg-secondary",
            focusRing
          )}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">
            Presets
          </legend>
          {PRESETS.map((p, i) => {
            const active = preset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings({
                    title: p.title,
                    body: p.body,
                    flourish: p.flourish,
                    grain: p.grain,
                    redRules: p.redRules,
                  })
                }
                className={cn(
                  "flex flex-col items-start gap-0.5 border px-3 py-2 text-left",
                  active ? "border-primary" : "border-dim hover:bg-secondary",
                  focusRing
                )}
              >
                <span className="text-sm font-semibold">
                  <span className="text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}{" "}
                  </span>
                  {p.name}
                </span>
                <span className="text-xs text-muted-foreground">{p.description}</span>
              </button>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-3">
          {select("Titles", settings.title, TITLE_FONTS, (v) =>
            update({ title: v as TypeSettings["title"] })
          )}
          {select("Body", settings.body, BODY_FONTS, (v) =>
            update({ body: v as TypeSettings["body"] })
          )}
          {select("Flourishes", settings.flourish, FLOURISH_FONTS, (v) =>
            update({ flourish: v as TypeSettings["flourish"] })
          )}
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">
            Industrial details
          </legend>
          {(
            [
              ["grain", "Grain texture"],
              ["redRules", "Red rules"],
            ] as const
          ).map(([key, text]) => (
            <label key={key} className="flex min-h-[44px] items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => update({ [key]: e.target.checked })}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              {text}
            </label>
          ))}
        </fieldset>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Share a preset with <code className="font-mono">?type=</code>
          {preset ? <code className="font-mono">{preset.id}</code> : " and a preset id"}
          . Helvetica only renders as Helvetica on Apple devices.
        </p>
      </div>
    </section>
  );
};
