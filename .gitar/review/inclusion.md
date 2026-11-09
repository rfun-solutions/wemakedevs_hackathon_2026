# Inclusion

Scope: every user-visible string in `web/src`. Content owned by change D (d-access-kit).

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
