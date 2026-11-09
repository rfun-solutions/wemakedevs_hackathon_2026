# Accessibility

Scope: every `.tsx` and `.css` change in `web/`.

A11Y-1 (Promise P3) Every control works at 200% text and in high contrast.

- WCAG 2.2 AA. Interactive targets are at least 24 by 24 CSS px.
- Use real `<button>`, `<a>`, `<input>`; never a `div` or `span` with a click handler.
- Dynamic status and results are announced through a live region.
- Colour is never the only signal; focus is always visible; layout survives 200% text without clipping or horizontal scroll.
- Do not weaken or skip an axe or Playwright accessibility test to make CI pass.
