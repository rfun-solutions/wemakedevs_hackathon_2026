## Ownership

Creates: `web/src/styles/` (tokens.css, global.css), `web/src/i18n/index.ts` (replaces C0's minimal loader, keeping `t(key, params?)`), `web/src/i18n/{en,es,pt-BR,ar}/access.json` (D1: `access.promise.*`, display settings, language switcher), `web/src/i18n/{en,es,pt-BR,ar}/access-cards.json` (D2: `access.card.*`, badge, `access.calm.*`, `access.hood.*`; a separate file so D1 and D2 never edit the same file) and `web/src/i18n/{pt-BR,ar}/app.json` (smoke-level translations of C0's `app.*` shell keys), `web/src/a11y/`, `web/src/prefs/`, `web/src/features/access/` (Cards, ShowToPerson, Badge, Settings), `web/public/fonts/` (Atkinson woff2 and licence), `docs/accessibility.md`, tests under `web/tests/` and `web/e2e/access/`.
Also creates `web/src/styles/token-pairs.ts`, the unopened branch `bugfix/KC-<n>-card-contrast`, `ACCESS-PROMISES.md` (the promise content; F, G and H only reference its ids), `web/src/features/access/{promises.ts,calm-places.ts,CalmPlaces.tsx}` and `web/src/under-the-hood/entries/d-access-kit.json`.
Edits: `web/index.html` (pre-paint prefs script), app shell (mount live regions), and the content of `.gitar/review/inclusion.md`, `demo-data.md` and `accessibility.md` (C0 creates these files; D creates no rule file). Inserts route and nav lines in `web/src/routes.ts` and `web/src/nav.ts` only under its own markers: `// >> d-access-kit` (D1: Settings) and `// >> d-access-kit-cards` (D2: Cards, Badge, Calm places). No API, database or migration changes. D never touches `web/public/sw.js` (cache-first hashed assets already cover calm places offline).

## 0. Inclusion review rules, promises and token names (PR 0, merge before PR 1; G1)
- [x] 0.0 Write `ACCESS-PROMISES.md` and `web/src/features/access/promises.ts` (`PROMISES`, P1-P5) exactly as design "Access promises", with `access.promise.*` in EN and ES; unit test: five ids in order, every `titleKey` exists in EN and ES, every `ruleIds` entry with prefix IN-, DD- or A11Y- appears in a `.gitar/review/` file next to its promise id (CAP- and HP- ids are G's generated rules and are skipped, because G merges after D)
- [x] 0.1 Write the IN-1 to IN-12 rules (each sentence naming its promise id) into `.gitar/review/inclusion.md` and DD-1 to DD-4 into `.gitar/review/demo-data.md` exactly as design "Inclusion rules"; keep C0's header line
- [x] 0.2 Add the "A11Y-2 (Promise P3) fix the token, never weaken the test" line to `.gitar/review/accessibility.md` (G5 steering)
- [x] 0.2a Write `web/src/styles/tokens.css` with the **complete token name set** (colour roles, type scale, spacing, radii, elevation, focus ring, `--target-min`, `--target-comfort`, `--type-scale`, high-contrast overrides) from D0's list, which C0w's placeholder already uses. Values are neutral, or the 11:20 pick if it is ready. After this PR merges (about 12:50) token names are frozen: later PRs, including the G5 branch, change values only, and a rename or new name needs the orchestrator
- [ ] 0.3 Open after C0b merges (it creates the three rule files), let Gitar review, merge (no feature code; target about 12:50, gate G-RULES)
- [ ] 0.4 On PR 1, record the first Gitar finding that cites `inclusion.md` (link in the PR description); if none appears, note it

## 1. Design direction and tokens (PR 1, merge first)
- [ ] 1.1 (D0, outside the repo in `.scratch/kubecompanion/design/`, from 11:00) Run the Impeccable skill for KubeCompanion (mobile-first, Kay's context: bright screen, noisy hall, one-handed). Produce 2-3 directions (palette, type pairing, density, shape) with a small preview each; present them and wait for the user's pick (target about 11:05, decision by 11:20, neutral default); record the pick as token names and values, and hand the names to C0w by 11:30
- [x] 1.2 Apply the picked direction in `tokens.css` by changing values only; the names were fixed in PR 0 (task 0.2a)
- [x] 1.3 Write `global.css` (reset, base type, focus-visible, `.btn`, `.visually-hidden`, logical properties only)
- [x] 1.4 `web/src/styles/token-pairs.ts` (`TOKEN_PAIRS`); unit test: contrast ratios of token pairs for default and high-contrast sets, failure message names the pair, the ratio, the minimum and the computed colours
- [x] 1.5 Confirm C0's lint config (which installs and enables `eslint-plugin-jsx-a11y`; it works with Preact JSX) flags `div`/`span` click handlers; add a lint fixture test. Only tighten C0's rules, never remove them
- [x] 1.6 Write `docs/accessibility.md` (rules, checklist, token and `t()` usage)

## 2. i18n framework (PR 1)
- [ ] 2.1 Implement `t()`, `useLang()`, `setLang()`, EN fallback, `{param}` interpolation, `Intl` helpers with explicit time zone; set `<html lang dir>`
- [ ] 2.2 Registry loading via `import.meta.glob` of `web/src/i18n/<lang>/*.json`, merged by key, never by file name (split agents own separate files such as `access-cards.json`, `translate.json`, `status-health.json`); unit test: a key defined in two files fails
- [ ] 2.3 Language switcher in Settings; persist; announce change; AI-assisted disclosure text
- [ ] 2.4 Claude-assisted strings in `access.json`: EN and ES complete for D1's `access.*` keys (C0 ships EN/ES `app.*`); PT-BR and AR for `app.*` and D1's `access.*` keys (display settings, promises). Cards, badge and calm-places strings are D2's, in `access-cards.json`
- [ ] 2.5 Unit tests: fallback, missing key, interpolation, ES-covers-EN, RTL attribute switching

## 3. Display modes and a11y plumbing (PR 2)
- [ ] 3.1 `prefs/display.ts`: type scale, font, contrast, motion; export `PREFS_STORAGE_KEYS` (F's Synthetic Kay seeds through it); localStorage in try/catch; honour `prefers-contrast` and `prefers-reduced-motion` as defaults
- [ ] 3.2 Pre-paint inline script in `index.html`
- [ ] 3.3 Self-host Atkinson Hyperlegible (woff2 plus OFL licence), lazy load on selection
- [ ] 3.4 Settings screen controls (slider, three toggles) with labels, keyboard support and announcements; insert its route and nav line under the `// >> d-access-kit` marker
- [ ] 3.5 `announce()` helper and shell live regions
- [ ] 3.6 Unit tests for prefs and announce; Playwright mobile: 200% has no horizontal scroll, prefs persist across reload, storage-blocked fallback

## 4. Communication cards and badge (PR 3)
- [x] 4.1 Cards screen with presets from i18n (`access.card.*` in `web/src/i18n/{en,es,pt-BR,ar}/access-cards.json`), custom text card, card-language selector; insert its route and nav line under the `// >> d-access-kit-cards` marker
- [x] 4.2 `<ShowToPerson>`: full-screen, fit-text, wake lock when available, Close and Escape, focus return, `lang` tagging
- [x] 4.3 Optional TTS with feature detection and voice picking by language; no autoplay
- [x] 4.4 Badge screen: pronouns, name, preference toggles, localStorage `kc.badge.v1`, show in `<ShowToPerson>`; strings in `access-cards.json` (EN, ES, PT-BR, AR); route and nav line under `// >> d-access-kit-cards`
- [ ] 4.5 Browser telemetry events `kc.access.card_shown`, `kc.access.display_mode_changed`, `kc.access.lang_changed` with no free text or badge data
- [x] 4.6 Playwright mobile (iPhone 15 and Pixel 7): open preset, custom card, close restores focus, badge persists, no network request carries badge fields
- [x] 4.7 axe matrix: shell, Cards, Settings, Badge in default, 200%, high contrast and AR RTL; confirm the `a11y` job runs it
- [ ] 4.8 Manual check on a real iPhone in Safari: card legibility, TTS, 200% type
- [x] 4.9 Stutter preset `access.card.stutter` ("I stutter. Please give me time to finish.") in EN and ES (PT-BR, AR smoke) in `access-cards.json`; add it to the Playwright preset test
- [x] 4.10 Calm places: `calm-places.ts` and `CalmPlaces.tsx` exactly as design "Calm places", route `/calm` and one nav line under `// >> d-access-kit-cards`, `access.calm.*` EN and ES in `access-cards.json`, source link and checked date; event `kc.access.calm_places_viewed`; Playwright mobile (iPhone 15, Pixel 7): 260A listed, offline reload still lists it, no request carries location; axe clean
- [x] 4.11 Add your registry entry: `web/src/under-the-hood/entries/d-access-kit.json` (cards, display modes, promises, calm places; tech: `inclusion.md` IN-2, G5 token rule, `a11y` axe check, Synthetic Kay `live: promise:P3` and `promise:P4`) with `access.hood.*` EN and ES in `access-cards.json`

## 5. Staged accessibility regression (G5, after group 4; branch only; THE on-stage Gitar fix, decided 2026-11-08; G3 is a prepared evidence PR)
- [x] 5.1 Make the axe e2e failure in `web/e2e/access/` print the failing element's `TOKEN_PAIRS` name and computed colours
- [ ] 5.2 Create branch `bugfix/KC-<n>-card-contrast` from `main`: change one `<ShowToPerson>` token so the pair is 3.9:1; confirm locally that the contrast test and `a11y` fail with the token named; push the branch, do NOT open the PR. Push an identical second branch `bugfix/KC-<n>-card-contrast-rehearsal` for G's dress rehearsal, so the stage branch is still broken on stage
- [ ] 5.3 Hand the branch name to G's `docs/runbooks/a11y-regression.md`; after the stage run, confirm Gitar's fix touched only `tokens.css`

## Split (three agents, from the start; parallel-plan §1, §4.6)
- **D0** (11:00-11:45, outside the repo, no repo writes): task 1.1 (Impeccable), the user's pick, and the prepared text for 0.0-0.2 and the token name list (handed to C0w by 11:30 and to D1).
- **D1** (from 12:20): groups 0-3. PR 0 (rules, promises, token names) opens after C0b merges and gates every feature PR (G-RULES).
- **D2** (from 12:50, after D PR 0): groups 4-5 (cards, `<ShowToPerson>`, badge, calm places, registry entry, the G5 branch). Its strings live in `access-cards.json` and its routes under `// >> d-access-kit-cards`, so it shares no file with D1. E does not block on `<ShowToPerson>`. D2 hands the G5 branch name to G's runbook (task 5.3).

## Out of scope
- Live captions and caption translation (E); `<ShowToPerson>` is reused there but captions are not built here.
- Server-side translation, a translation service, or professional/native review of strings.
- Accounts, syncing preferences across devices, any server storage of badge or preferences.
- Crowd levels, an indoor map or floor-plan images (only the static calm-places list is in scope); session access tags (A); sign-language resources.
- Rendering the promise lights or computing their state (F).
- Name-pronunciation recording (decided 2026-11-08: left out; the badge holds text only).
- Languages beyond EN, ES, PT-BR, AR; full PT-BR and AR coverage of other changes' strings.
- Screen-reader audit with VoiceOver beyond one smoke pass; full WCAG conformance statement.
