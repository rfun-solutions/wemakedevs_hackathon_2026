## Context

Mobile-first Preact PWA scaffolded by C0. Kay is on a phone, often one-handed, in a noisy hall, with a brightly lit screen. Everything in D is client-side; there is no server work.

## Interfaces

Consumed (from C0): `web/src/routes.ts`, `web/src/nav.ts`, `web/src/i18n/<lang>/<change>.json` registries; `@dash0/sdk-web` browser SDK; CI jobs `a11y` and `e2e-mobile`; `.gitar/review/{accessibility,inclusion,demo-data}.md` (C0 creates them; D creates no rule file and writes their content, see decision G1).

Provided:
| Interface | Detail |
|---|---|
| `web/src/styles/tokens.css` | CSS custom properties: colour roles, type scale, spacing, radii, `--target-min: 24px`, `--target-comfort: 44px`, focus ring. Other changes never hard-code colours or sizes |
| `web/src/styles/global.css` | Reset, base typography, focus-visible, `.visually-hidden`, `.btn` base, reduced-motion rules |
| `t(key, params?)` | `web/src/i18n/index.ts`; key format `<change>.<key>`; falls back to EN, then to the key. `useLang()` hook, `setLang()` |
| `announce(text, politeness?)` | `web/src/a11y/announce.ts`; single shared polite/assertive live region mounted in the app shell |
| Display prefs | `web/src/prefs/display.ts`: sets `data-` attributes on `<html>` (`data-type-scale`, `data-font`, `data-contrast`, `data-motion`) |
| `<ShowToPerson>` | Full-screen component taking `text` and optional `lang`; E reuses it |
| `PREFS_STORAGE_KEYS` | Exported from `web/src/prefs/display.ts` and `web/src/i18n/index.ts` (language key). F's Synthetic Kay spec seeds the persona through these, never through hard-coded strings |
| `TOKEN_PAIRS` | `web/src/styles/token-pairs.ts`: the named foreground/background token pairs and their minimum ratio; used by the contrast unit test and the axe e2e failure message |

## Decisions

- **Own i18n, not i18next.** Flat JSON per language per change, a 40-line `t()` with `{param}` interpolation and `Intl` for plurals/dates. Smaller bundle, no dependency, enough for 4 languages. Registry files are merged at build via Vite `import.meta.glob`, by key, never by file name, so split agents each own a file (`access.json` for D1, `access-cards.json` for D2); a key defined in two files fails the unit test.
- **Languages.** EN and ES have every key. PT-BR and AR cover the shell, cards, display settings and badge only (smoke level); missing keys fall back to EN. AR sets `dir="rtl"` and `lang="ar"` on `<html>`; layout uses CSS logical properties only (`margin-inline-start`, etc.).
- **Disclosure.** Settings shows "Translations are AI-assisted and not yet reviewed by native speakers", itself translated.
- **Display modes as attributes, not classes per component.** Tokens react to `html[data-*]`; components stay unaware. A tiny inline script in `index.html` reads localStorage and sets attributes before first paint to avoid flash.
- **Type scale.** Slider 100-200% in 10% steps sets `--type-scale`; all text uses `rem` tied to it. Layout must reflow at 200% with no horizontal scroll (WCAG 1.4.4, 1.4.10).
- **Font.** Atkinson Hyperlegible self-hosted (woff2, OFL) and loaded only when selected, to keep the shell small. System font stack is default.
- **High contrast.** Token override set targeting 7:1 for text and 3:1 for UI boundaries. Also honours `prefers-contrast: more` as the initial default.
- **Reduced motion.** Honours `prefers-reduced-motion` as default; user toggle overrides. No essential information is conveyed by animation.
- **TTS.** `speechSynthesis`, feature-detected; button hidden when unavailable. Voice chosen by card language. Never auto-plays; always a user gesture.
- **Show-to-person mode.** Uses full-screen CSS (not the Fullscreen API, which is unreliable on iOS), maximises text to fit via a CSS clamp plus a fit-text step, requests a screen wake lock when available, and exits via a large Close button and Escape. Text is `lang`-tagged.
- **Cards data.** Presets (including `access.card.stutter`: "I stutter. Please give me time to finish.") live in i18n JSON (`access.card.*`), so the card is shown in the viewer's chosen language and Kay can show it in EN even when the UI is ES (card language selector).
- **No name-pronunciation recording** (decided 2026-11-08). The badge holds text only.
- **Lint.** `eslint-plugin-jsx-a11y` is installed and enabled by C0 (it works with Preact JSX); D only tightens rules.
- **Badge.** Stored in localStorage key `kc.badge.v1`. Never sent to the API. No telemetry attribute may contain badge fields.
- **Impeccable checkpoint.** Task 1 runs the Impeccable skill, produces 2-3 mobile-first directions (palette, type pairing, density, shape), and stops for the user's pick at about 11:05. Until then tokens use a neutral default. The complete token name set lands in PR 0 (about 12:50) and is then frozen, because token names are an interface every UI change codes against; C0w's placeholder uses the same names. The pick changes only `tokens.css` values.
- **Unit-test seam.** Contrast ratios are computed in a unit test over the token values for the default and high-contrast sets, so a bad direction fails CI, not a manual review.

## Access promises (P1-P5)
D owns the words; F owns the lights; rules cite the ids; G's generator and H may reference them.
- `ACCESS-PROMISES.md` (repo root): one heading per promise with Kay's sentence in EN and ES, the rule ids that cite it, the Dash0 signal behind its light and what "unknown" means. It is the file judges and Gitar can read.
- `web/src/features/access/promises.ts`:
  ```ts
  export type PromiseId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  export interface AccessPromise { id: PromiseId; titleKey: string; ruleIds: string[] }
  export const PROMISES: AccessPromise[]; // order P1..P5; titleKey = `access.promise.${id}`
  ```
- Strings `access.promise.P1` ... `P5` in EN and ES (PT-BR and AR at smoke level), plain language (IN-6).

| Id | Kay's words (EN) | Rules citing it | Live signal for F's light |
|---|---|---|---|
| P1 | Captions reach your screen within 4 seconds, or we switch and tell you. | IN-3, IN-7, IN-10, CAP-1 (G) | `kc_captions_segment_ms` p95 of the faster engine, limit 4000 ms (F poller) |
| P2 | A note saves in under half a second, or waits safely on your phone and saves later. | IN-11 (plus G's generated HP rule when `POST /api/notes` is hot) | `POST /api/notes` p95 from span metrics, limit 500 ms |
| P3 | Every button and screen works with text at 200% and in high contrast. | A11Y-1 (C0), A11Y-2 (the G5 token line), IN-4, IN-5 | Synthetic Kay (200% type, high contrast) axe result, `kc_status_kay_checks_total{promise="P3"}` over 30 min |
| P4 | Every card and screen is in your language: English and Spanish. | IN-1, IN-2, IN-6, IN-8 | Synthetic Kay in `es-ES` finds no English fallback, `kc_status_kay_checks_total{promise="P4"}` over 30 min |
| P5 | Translation is available, or we tell you plainly that it is not. | IN-12 | `POST /api/translate` share of non-5xx responses over 15 min, limit 95% |

A light is never green without data: no samples means "unknown" (grey, "not measured right now").

## Calm places (static)
`web/src/features/access/calm-places.ts` holds a fixed list from the public KubeCon NA 2026 inclusion page (research/04 §1.2), checked 2026-11-08, with a source link and that date on screen:
- All-Attendee Quiet Room, Salt Palace, level 2, room 260A
- Women + Non-Binary Quiet Room, Salt Palace, level 2, room 260B
- Prayer Room, Hyatt Regency, level 5
- Nursing room (private) and onsite child care: the page gives no room, so the entry says "ask at registration" rather than inventing one
Names and notes are i18n keys (`access.calm.*`). Route `/calm`, one nav line. It is part of the precached shell, so it works offline. Telemetry: `kc.access.calm_places_viewed` with no attributes. No crowd levels, no reports, no map images (reuse rights unverified).

## Inclusion rules and staged regression (G1, G5)
- **Rule content (G1).** Each rule is testable in one sentence, so Gitar findings are specific, not noise. Each sentence names the promise it protects in the form `IN-2 (Promise P4)`, because Gitar quotes the sentence, not the file header (T10).
  - `inclusion.md`:
    - IN-1 (Promise P4) Every user-visible string goes through `t()`; no literal text in JSX.
    - IN-2 (Promise P4) Every new key exists in both the `en/` and `es/` file of its domain.
    - IN-3 (Promise P1) Dynamic text (saved confirmations, status changes, caption lines) is announced through `announce()` or an `aria-live` region.
    - IN-4 (Promise P3) No click handler on `div` or `span`; use `<button>` or `<a>`.
    - IN-5 (Promise P3) Interactive targets use `--target-min` (24 px) or larger.
    - IN-6 (Promise P4) Plain language: EN sentences of 20 words or fewer, no idioms, and no technical term (p95, SLO, engine, RTT) without a plain gloss.
    - IN-7 (Promise P1) Nothing is conveyed by sound, colour or motion alone; every audio feature (captions, TTS) has a text path.
    - IN-8 (Promise P4) Text in a language other than the page's carries a `lang` attribute.
    - IN-9 Claude-assisted strings stay disclosed per `AI-DISCLOSURE.md`.
    - IN-10 (Promise P1) Code under `web/src/lib/speech/` keeps the slow-chunk engine switch and its live-region announcement; a caption line is never dropped without text saying so.
    - IN-11 (Promise P2) Screens save notes, people and promises only through B's queue (`enqueueNote()` and its siblings), never by calling `POST /api/notes` directly, so an offline save is never lost.
    - IN-12 (Promise P5) A translation failure keeps the original line and shows a plain message; it never shows a blank line.
  - `demo-data.md`:
    - DD-1 Fixtures and seeds carry no speaker names, emails, phone numbers, social handles or photos; schedule fixtures keep titles, times, rooms and tracks only.
    - DD-2 Seeded notes, people and promises use fictional names and `DEMO_DEVICE_ID` only.
    - DD-3 No telemetry attribute, metric label or log field contains note text, badge fields, card text or a device id.
    - DD-4 Screenshots and test snapshots use the demo device only.
  - `accessibility.md` (one line added): "A11Y-2 (Promise P3) When `a11y` or the contrast test fails, fix the token in `web/src/styles/tokens.css`. Never relax an axe rule, add an exclusion, skip a test or lower a contrast threshold."
- **Timing.** Gitar reads rules from the default branch (T1), so the content lands in PR 0 (rules only, minutes to merge) before D's PR 1. D's PR 1 and later PRs are the first ones the full rules can catch.
- **Staged regression (G5, the on-stage Gitar fix, decided 2026-11-08).** Branch `bugfix/KC-<n>-card-contrast` changes one token used by `<ShowToPerson>` so its text pair measures 3.9:1. The contrast unit test and the axe e2e check both fail with a message such as `token pair --show-fg on --show-bg is 3.90:1, needs 4.5:1 (computed #8a8a8a on #ffffff)`, so Gitar's log read points at the token. The branch is pushed but NOT opened; G's runbook opens it.

## Telemetry

Browser-only, via the C0 browser SDK. Custom events (no personal data): `kc.access.card_shown` (preset id only), `kc.access.calm_places_viewed` (no attributes), `kc.access.display_mode_changed` (mode name and on/off), `kc.access.lang_changed` (language code). Counter names `kc_access_cards_shown_total`, `kc_access_lang_total` are derived server-side by F if wanted. No SLO candidate. Free-text card content and badge fields are never recorded.

## Risks

- iOS Safari voices and wake lock vary: both are progressive enhancements.
- Machine-translated AR/PT-BR may be wrong: disclosed, smoke-level only.
- Token direction arrives late: neutral default plus single-file swap.
