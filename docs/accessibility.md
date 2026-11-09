# Accessibility rules (change d-access-kit)

Promise P3: every button and screen works with text at 200% and in high contrast. Review rules live in `.gitar/review/{inclusion,accessibility}.md` (IN-1..12, A11Y-1, A11Y-2).

## Checklist for every screen
- Real `<button>`, `<a>` or `<input>`. Never a `div` or `span` with a click handler (IN-4; lint enforces it).
- Targets at least `--target-min` (24 px); primary controls `--target-comfort` (44 px) or more (IN-5).
- Every user-visible string goes through `t('key')` with an EN and an ES key (IN-1, IN-2). Text in another language carries `lang` (IN-8).
- Dynamic text (saved, status, caption lines) is announced with `announce()` or an `aria-live` region (IN-3).
- Nothing is conveyed by colour, sound or motion alone (IN-7). Focus is always visible.
- Layout survives 200% text: no clipping, no horizontal scroll. Use logical properties (`inline-size`, `padding-inline`, `margin-block`), never `left`/`right`, so Arabic RTL works.

## Tokens
- Use `var(--token)` from `web/src/styles/tokens.css`; never a raw colour or size in a component. Token names are frozen; change values only.
- Display modes set attributes on `<html>`: `data-type-scale` (1 to 2), `data-contrast="high"`, `data-motion="reduced"`.
- `--color-accent` (mustard) is 1.9:1 on white: use it as a fill with `--color-text-on-accent`, never as text.
- Contrast is tested in `web/src/styles/token-pairs.test.ts` for the default and high-contrast sets. If it fails, fix the token (A11Y-2). Never relax a threshold, add an exclusion or skip a test.

## Fonts
Atkinson Hyperlegible 400 and 700 are self-hosted in `web/public/fonts/` (OFL, see `README.txt` there). No third-party font request at runtime.

## Display preferences and language (web/src/prefs, web/src/i18n)
- `setPrefs({ typeScale, font, contrast, motion })` applies the `html[data-*]` attributes and saves to `localStorage` key `kc.display.v1` (`PREFS_STORAGE_KEYS`). Saved choices beat `prefers-contrast` and `prefers-reduced-motion`. Blocked storage means defaults for this visit, never an error.
- The inline script in `web/index.html` applies the same attributes and `<html lang dir>` before first paint. Keep it in step with `prefs/display.ts` and `i18n/index.ts`.
- Languages: EN, ES, PT-BR, AR. AR sets `dir="rtl"`. PT-BR and AR fall back to EN per key. `formatTime(date, timeZone)` and `formatDate` always take an explicit time zone.
- `announce(text, 'polite' | 'assertive')` writes to the live regions mounted by `<LiveRegions />` in the shell.
