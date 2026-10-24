# Brand and design

**Brand name: Gusty** (one "y"). Founder decision, 24 Oct 2026. The reference PDF also shows a
"Gustyyy" spelling in some lockups and the type sheet; that spelling is retired and must not be used.

**Concept:** Expressive on the outside, calm on the inside. Public pages are bold and editorial;
working screens get quieter as tasks get more complex.

## Asset status

| Status | Assets | Rule |
|---|---|---|
| **Approved — do not alter** | Bird logo, Gusty wordmark, primary and stacked lockups, icon, "Hey Gusty!" lockup, symbol library (11) and symbol set (8) | Use the files in `public/brand/` only. Never redraw, recolour, distort or regenerate them. |
| **Preferred direction** | Display hand lettering, UI sans, spaced accent copy, black pill button, palette | Implemented as tokens (below). |
| **Experimental references** | Example compositions, pebble image | Inspiration only. |
| **Proposed — needs founder approval** | Bottom nav, idea box, step cards, placeholder pages, focus styles | Built in stage 0–1; awaiting review. |

### How the vectors were made
`public/brand/**` was traced from the images embedded in the founder's PDF (pages 18–19) with
`potrace`. Nothing was redrawn: each shape is the original artwork's outline, smoothed only by tracing.
Reproduce with `scripts/brand/trace.py` (see the header of that file). The "Gustyyy" lockup on the symbol
page was deliberately not traced. **If original high-resolution or vector artwork exists, replace these
files with it** — the traces are faithful to the source, but the source images were only ~150–950 px wide.

All SVGs use `fill="currentColor"`. Logos are shown as images (always Ink). Symbols are rendered with
`<BrandSymbol>` (a CSS mask), so they take the surrounding text colour.

## Typography
The fonts in the reference sheet were suggestions without names, so these are the closest free matches
(both SIL Open Font License, self-hosted at build time via `next/font`):

| Role | Font | Usage |
|---|---|---|
| Display hand | **Caveat Brush**, uppercase, bolded with a 0.035em stroke and a −5° slant (`.type-display`) | Headlines and key brand moments only |
| Hand accent | Caveat Brush, uppercase, spaced (`.type-accent-hand`) | Short overlines and brand messages |
| UI sans | **Google Sans Flex** | Everything functional: body, forms, navigation |
| Label | Google Sans Flex, uppercase, 0.2em tracking (`.type-label`) | Section labels, metadata |

Both fonts cover Latin and Latin Extended (most European languages). Neither covers Cyrillic, Greek,
Arabic or Hebrew: when such a language is added, choose fallbacks then.

## Colour
Palette: Ink `#111111` · Paper `#F7F6F0` · Oat `#E8E6DA` · Sage `#B8C3AB` · Signal `#E4E6AB` ·
Sky `#DEEBF0` · Water `#93B5BE` · Lilac `#E8DFF4` · Stone `#777671`.

Foundation is Ink on Paper (17.4:1). Accents are **backgrounds only**, always with Ink text, and each has
one job: Signal = recommended next step · Sky = information / "coming next" · Lilac = AI suggestion ·
Sage = confirmed. Meaning is never carried by colour alone.

Accessibility adjustments (checked in `tests/unit/contrast.test.ts`):
- Stone on Paper is 4.2:1 — below AA for body text. Stone is for decoration, large text and input borders
  (meets the 3:1 non-text minimum). Secondary text uses **Stone-strong `#5F5E59`** (6.0:1), a proposed addition.
- Water and Sage are too light for text (1.7–2:1); use them only as fills.

Tokens live in `src/app/globals.css`. Components use semantic roles (`--text-muted`, `--highlight`…),
not palette names, so a white-label theme only overrides tokens.

## Layout and interaction
- Mobile (<768px): compact header and a fixed bottom bar with the three destinations, safe-area aware.
- Tablet and desktop: destinations in the header.
- Visible focus ring on everything; skip link; reduced motion respected; targets at least 44px.

## Quality check for new screens (directive §11)
Distinctive to Gusty? Next action obvious? Less cognitive effort? Excellent hierarchy? Works on mobile,
tablet and desktop? Accessible? Every element has a purpose?
