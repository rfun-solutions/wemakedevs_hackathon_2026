# 09 · Kay character style options

Made 2026-11-08 in Gemini (gemini.google.com, Pro model, user's logged-in browser) via Claude in Chrome. Style options only; no scenes yet. Each style ran in its own new Gemini chat so styles don't bleed into each other.

Gemini chats (for regenerating or downloading full-resolution originals yourself):
- A: https://gemini.google.com/app/93da9a460aa47ddb
- B: https://gemini.google.com/app/157ef00f3a5d4c5e
- C: https://gemini.google.com/app/e10ffa1c3dade167

## Screenshots

Captured with the Chrome zoom screenshot (not Gemini's download button), so they are **566×317 preview captures, not the full-resolution originals**. Fine for choosing a style; for the reference sheet used in scene prompts, download the chosen original from the Gemini chat above.

Copied into `research/09-character-options/` (originals are in the temp folder `/var/folders/69/wx495wmn6b1cnbm2q_gv02300000gp/T/claude-chrome-screenshots-YuED1U/`):

| Option | First result | Variation |
|---|---|---|
| A flat vector | `09-character-options/A1-flat-vector.png` | `09-character-options/A2-flat-vector-variation.png` |
| B comic ink | `09-character-options/B1-comic-ink.png` | `09-character-options/B2-comic-ink-variation.png` |
| C clay 3D | `09-character-options/C1-clay-3d.png` | `09-character-options/C2-clay-3d-variation.png` |

## Prompts (exact)

Shared character block (repeated inside each prompt; A1 used slightly different hair and backpack wording, which is why A2 fixes the hair):
> Kay, a gender-neutral young adult (they/them), a first-time tech conference attendee. Medium-length tousled dark hair just over the ears, warm medium-brown skin, round friendly face, a small teal hearing aid visible behind the right ear. Wears a mustard-yellow hoodie, dark jeans, white sneakers, a navy backpack, and a lanyard with a blank conference badge (no text, no logos). Holds a smartphone.

### A1 flat vector
```
Generate an image: an original cartoon character sheet in a flat vector style, bold and friendly, with clean geometric shapes, thick uniform outlines, flat color fills and no gradients. Character: Kay, a gender-neutral young adult (they/them), a first-time tech conference attendee. Short tousled dark hair, warm medium-brown skin, round friendly face, a small teal hearing aid visible behind the right ear. Wears a mustard-yellow hoodie, dark jeans, white sneakers, a navy backpack, and a lanyard with a blank conference badge (no text, no logos). Holds a smartphone. Layout on a plain off-white background: full-body front view, full-body side view (profile), and three head-and-shoulders expressions labeled confused, focused, relieved. Same proportions, colors and outfit in every view. No real logos, no text other than the three expression labels.
```
### A2 follow-up
```
Make a variation of this same sheet: keep the outfit and colors, but make Kay read clearly gender-neutral (slightly softer jaw, medium-length tousled hair just over the ears), make the shapes more geometric and simplified with thicker uniform outlines, and make the teal hearing aid visible in the front view and all three expressions. Keep the plain off-white background and the three labels.
```
### B1 comic ink
```
Generate an image: an original cartoon character sheet in a comic ink style with a limited palette: confident black brush-ink linework with varied line weight, spot blacks, simple halftone dot shading, and only four colors (black ink, off-white paper, mustard yellow, teal). Character: Kay, a gender-neutral young adult (they/them), a first-time tech conference attendee. Medium-length tousled dark hair just over the ears, medium-brown skin, round friendly face, a small teal hearing aid visible behind the right ear. Wears a mustard-yellow hoodie, dark jeans, white sneakers, a dark backpack, and a lanyard with a blank conference badge (no text, no logos). Holds a smartphone. Layout on a plain off-white paper background: full-body front view, full-body side view (profile), and three head-and-shoulders expressions labeled confused, focused, relieved. Same proportions, colors and outfit in every view. No real logos, no text other than the three expression labels.
```
### B2 follow-up
```
Make a variation of this same sheet with a stronger comic-ink look: heavier black brush outlines, solid spot-black shadows on the jeans, backpack and hair, visible halftone dot shading on the hoodie, and use teal as the accent color on the hearing aid, the lanyard and the phone case. Keep the same character, outfit, layout, plain paper background and the three labels.
```
### C1 clay 3D
```
Generate an image: an original cartoon character sheet as a soft 3D clay-like render: rounded sculpted forms, matte clay material with subtle fingerprint texture, soft studio lighting, gentle shadows, slightly chunky toy-like proportions. Character: Kay, a gender-neutral young adult (they/them), a first-time tech conference attendee. Medium-length tousled dark hair just over the ears, warm medium-brown skin, round friendly face, a small teal hearing aid visible behind the right ear. Wears a mustard-yellow hoodie, dark jeans, white sneakers, a navy backpack, and a teal lanyard with a blank conference badge (no text, no logos). Holds a smartphone. Layout on a plain light-grey seamless background: full-body front view, full-body side view (profile), and three head-and-shoulders expressions labeled confused, focused, relieved. Same proportions, colors and outfit in every view. No real logos, no text other than the three expression labels.
```
### C2 follow-up
```
Make a variation of this same clay sheet: make the side view a true 90-degree profile facing right with the hearing aid visible, make the jeans dark navy, and exaggerate the three expressions so they are clearly different at a glance (confused: raised brow, tilted head, mouth to one side; focused: narrowed eyes, slight frown; relieved: closed eyes, wide smile, shoulders dropped). Keep the same clay material, lighting, colors, plain background and the three labels.
```

## Notes per style

### A flat vector
- **Consistency:** Strong. Outfit, colors, badge and backpack match across all five views in both versions; A2 kept everything from A1 and only changed what was asked. Hearing aid: A1 shows it only in the side view; A2 shows it in every view.
- **Gender read:** A1 reads as a boy (short hair, boyish face). A2's longer hair and softer face read more neutral. Prefer A2.
- **Style accuracy:** Closer to a clean cartoon with thin sketchy outlines than to true geometric flat vector; there is still light shading.
- **Slide readability:** Best of the three. Flat fills and a strong yellow/navy silhouette read at thumbnail size, and the face reads at a distance. The teal hearing aid is small; in scenes where it matters (beat 3a), frame it as a close-up.

### B comic ink
- **Consistency:** Good within a sheet. B2 drifted on the jeans (dark navy became grey) while adding the teal accents (lanyard, phone, hearing aid). Expressions are stacked in a column, a different layout from A and C.
- **Gender read:** Most clearly gender-neutral of the three in both versions.
- **Style accuracy:** Reads as a lightly inked illustration rather than bold comic ink; halftone and spot blacks stayed subtle even after the follow-up.
- **Slide readability:** Good. Ink outlines hold up when scaled down and the limited palette lets HTML speech bubbles stand out. Hatching detail will be lost at small panel size. Best fit for a comic-strip deck.

### C soft 3D clay
- **Consistency:** Weakest on the brief. Both versions drew the "side view" as a three-quarter rear view, not a profile, and the jeans stayed mid-blue despite the follow-up. C1's confused and focused faces were nearly the same; C2 fixed that (expressions now clearly different).
- **Gender read:** Neutral.
- **Style accuracy:** Convincing clay/toy render with soft lighting and texture.
- **Slide readability:** Most appealing at full size, but the low-contrast light-grey background and soft shading lose edges at small panel sizes. 3D renders also tend to drift more between scenes (pose and lighting change the look), so they need the reference image every time.

## Recommendation (for the user to decide)

A2 (flat vector) is the safest for a consistent multi-panel deck and slide readability. B is the strongest gender-neutral read and the most "comic". C looks best but follows the sheet brief least reliably. Next step after a pick: download that sheet's full-resolution original from its Gemini chat and use it as the reference image for each scene prompt (research/07 section 4.2 beats).

## Chosen: A2 (user, 2026-11-08)
Full-size original: `research/09-character-options/kay-A2-reference.jpeg` (downloaded by the user from Gemini). This is the reference image for every scene.
