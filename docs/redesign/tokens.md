# Design tokens

All colours are CSS variables in `frontend/src/styles/globals.css`, exposed to
Tailwind in `frontend/tailwind.config.js`. Use the Tailwind names in components.
Never write a hex value in a component.

## Colour

| Tailwind class part | Value | Use |
|---|---|---|
| `background` | `#0C0C0D` | Page background |
| `surface` | `#141416` | Panels, cards, inputs on dark sections |
| `secondary` / `muted` / `accent` | `#1C1C1F` | Raised: selected chips, hover rows |
| `foreground` | `#EDEDEF` | Body text |
| `muted-foreground` | `#A3A3A8` | Secondary text, labels |
| `faint` | `#8A8A90` | Metadata, hints. Smallest text colour allowed |
| `border` | `#2A2A2E` | Dividers, card outlines (the default for `border`) |
| `border-strong` | `#3A3A3F` | Inputs, outline buttons |
| `border-emphasis` | `#4A4A50` | Selected chips |
| `primary` | `#E0312A` | Fills only: main action, switch on, progress, score dots |
| `primary-foreground` | `#FFFFFF` | Text on `primary` |
| `primary-text` | `#FF6257` | Red text on dark (eyebrows, strong scores, links) |
| `primary-dark` | `#B3261F` | Pressed state of primary buttons |
| `ring` | `#E0312A` | Focus outline |

Rules:

- Red is for the one main action on a screen, selected states and the strongest
  matches. If more than two or three things on a screen are red, something is
  wrong.
- Never use `primary` (`#E0312A`) for text under 24px. It fails contrast. Use
  `primary-text`.
- Never use a grey lighter than `faint` for text on `background`.
- States must differ in more than hue (lightness, line style, strikethrough).

## Type

| Family | Tailwind | Use |
|---|---|---|
| Bebas Neue | `font-display` | Wordmark, page and album titles, section headings. Never body text, buttons or labels |
| IBM Plex Sans | `font-sans` (default) | Everything else |
| IBM Plex Mono | `font-mono` | Metadata that reads like liner notes: years, counts, "via" lines, roles, progress detail, eyebrows |

Scale: use Tailwind's default scale (`text-xs` 12px up). Nothing below 12px.
Display sizes:

| Where | Desktop | Mobile |
|---|---|---|
| Home hero | 96px (`text-8xl`) | 52px |
| Album title (results, searching) | 56px | 30px |
| Section headings | 34px | 24px |

Letter spacing: none on body text. Display headings get `tracking-wide` at
most; the wordmark is the exception at 1.5px. Eyebrows: mono, 12–13px, uppercase, `tracking-[2px]`, `primary-text`.

## Space and shape

- Tailwind's default spacing scale. Page gutters 16px mobile, 24px desktop.
- Content width: `max-w-[1200px]` home, `max-w-[1280px]` results.
- Radius: 8px for inputs and buttons (`rounded-lg`), 10–12px for cards and
  panels, 3–4px for cover art, 6px for chips, full for switches and pills.
- Touch targets at least 44px tall. Chips may be 34–36px if spaced 8px apart.

## Motion

- Short transitions only (150–200ms) on colour and transform.
- No ambient animation. The background grain is static.
- `prefers-reduced-motion` is handled globally in `globals.css`.

## Legacy names

The old theme names (`text-text-primary`, `bg-bg-primary`, `primary-main`,
`font-primary`, `font-secondary` and similar) were removed in the last phase
of the redesign. Use the names above.
