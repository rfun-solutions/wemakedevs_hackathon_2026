# 06 - Design (anti-slop) and Presentation research (information only, no decisions)

Compiled 2026-11-08. Web figures come largely from third-party aggregators; prices are flagged where sources conflict. Verify on vendor pages before spending.

## A. Design without AI slop

### A1. Locally installed (verified by reading files)
| Skill | Location | What it offers |
|---|---|---|
| frontend-design (Anthropic) | `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md` (also in `anthropic-agent-skills/skills/frontend-design`) | Already installed. Frames Claude as a design lead; ground design in the subject matter; deliberate type choices (avoid default families, <80 char lines); explicit "tells" to avoid (single accented headline word, ALL CAPS labels, 01/02/03 numbering without meaning, fade-up on every section, cream+serif+terracotta #D97757, near-black + acid-green accent); process = plan, review against brief, build, critique. Aimed at web pages; less app-oriented. |
| ui-design | `~/.claude/skills/ui-design/SKILL.md` (plus commands ui-design:init / audit / critique / extract / status) | Interface design for dashboards, apps, tools, HTML slides (NOT marketing pages). Sections: "Where Defaults Hide", "Intent First", "Sameness Is Failure", product-domain exploration, subtle layering/elevation, borders, token architecture (named tokens evoke a world, not `gray-700`), spacing, depth, radius, typography, controls, states, dark mode, "Avoid" list. `init` builds with a stated direction and saves `.interface-design/system.md`; `audit` checks code against it; `critique` rebuilds what defaulted. Good fit for a phone-first app. |
| artifact-design, dataviz | Listed as available skills in the session; no SKILL.md found on disk under ~/.claude (built-in/hosted) | artifact-design: page contract for published Artifacts (tokens on :root, dark mode, phone-width layout, 16px gutters). dataviz: chart/dashboard color, accessibility, light/dark consistency (use if the app charts anything). |
| pptx (Anthropic) | `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/pptx` | Create/read/edit .pptx. |
| pptx-generator | `~/.claude/skills/pptx-generator` (bundles pptxgenjs) | HTML presentation to PPTX with themes, styled boxes, two-column layouts. |
| chg-brand | `~/.claude/plugins/synced/.../chg-general~g2/skills/chg-brand` | CHG Healthcare corporate brand decks/docs (Guardian Egyptian + Avenir, brushstrokes, logo rules). Relevance to a KubeCon hackathon demo: low, unless the user is presenting as CHG; it would impose corporate styling. Note its description says it triggers on any unqualified "make a deck". |
| Image-gen MCP | none installed (no image MCP in installed_plugins; OPENAI env var not set in this shell: `env | grep -ci openai` = 0) | User must supply keys. |

### A2. Well-known external options
| Tool | What it does | Install | How it fights generic AI look |
|---|---|---|---|
| Impeccable (Paul Bakaus), Apache-2.0, built on Anthropic's frontend-design | Design vocabulary + ~20 slash commands: steer (bolder, quieter, distill, colorize, typeset, layout, animate, delight, overdrive), review (critique, audit), finish (polish, harden, clarify, adapt, optimize, onboard), `shape`, `init`, `live` | `/plugin marketplace add pbakaus/impeccable` then install via `/plugin`; or `npx impeccable install` then `/impeccable init`. Other reported: `npx -y skills add pbakaus/impeccable --skill impeccable --agent claude-code` | 62 rule-based (non-LLM) anti-pattern checks (default sans fonts, purple-blue gradients, nested cards, cramped padding, skipped headings); optional hook scans UI files as edited; CLI + Chrome extension run same checks |
| Anthropic frontend-design | See A1 | Already present; also `/plugin install frontend-design@claude-plugins-official` | Opinionated "avoid these tells" list and subject-grounding step |
| shadcn/ui + official MCP | Component source you own (Radix/Tailwind), registry browsing via MCP | `pnpm dlx shadcn@latest mcp init --client claude`, restart, `/mcp` to verify. Community alt: `claude mcp add shadcn -- bunx -y @jpisnice/shadcn-ui-mcp-server` | Not a design skill; default shadcn look is itself widely recognizable, so theming/tokens matter. No official shadcn "skills" package found. |
| Others seen in a "top 5 Claude Code front-end skills" newsletter and directories (unverified): bejranonda/frontend-aesthetics | Aesthetic guidance skills | via smithery / mdskills | Not verified |

### A3. Mobile-first / PWA / accessibility pairings
- WCAG 2.2 (W3C Rec, 5 Oct 2023, 9 new criteria). Most relevant: 2.5.8 Target Size Minimum (AA) = 24x24 CSS px or spacing; iOS guidance 44x44 pt, Material 48x48 dp. Dragging actions need a single-pointer alternative (2.5.7). Level assignments in secondary sources conflict; check W3C page.
- PWA basics (web.dev): HTTPS, valid manifest, service worker with fetch handler, icons 192 and 512 px, custom offline page precached on install (relevant for conference wifi).
- Pair: ui-design `audit` or impeccable `audit`/`adapt`/`harden` for contrast and states; dataviz for chart accessibility; Lighthouse for PWA/a11y check.

Sources: [Impeccable repo](https://github.com/pbakaus/impeccable), [claudemarketplaces](https://claudemarketplaces.com/skills/pbakaus/impeccable/impeccable), [mdskills](https://www.mdskills.ai/plugins/impeccable), [shadcn MCP docs](https://ui.shadcn.com/docs/mcp), [W3C WCAG 2.2 new](https://w3.org/WAI/standards-guidelines/wcag/new-in-22/), [web.dev PWA checklist](https://web.dev/pwa-checklist), [web.dev PWA getting started](https://web.dev/learn/pwa/getting-started)

## B. Presentation: consistent cartoon character

### B1. Image models: consistency, cost, access
| Model/service | Reference-image consistency | Approx cost per image | Notes |
|---|---|---|---|
| Google Gemini image ("Nano Banana" family) | Strongest reported; multi-image refs (up to 14 cited by MCP READMEs) | Official page (aistudio.google.com/docs/pricing): Nano Banana 2.1 $0.034 (1K) / $0.050 (2K) / $0.113 (4K); Nano Banana 2 (3.1 Flash Image) $0.067 (1K); Nano Banana Pro (Gemini 3 Pro Image) $0.134 (1K/2K), $0.24 (4K); 2.5 Flash Image $0.039, deprecated, shutdown 2027-03-15. Batch ~half. No free tier listed for image models | Needs GEMINI_API_KEY (paid). Outputs carry invisible SynthID watermark. |
| OpenAI gpt-image (1-mini, 1.5, 2, 2.5/2.6 variants) | Image edit endpoint accepts multiple input images (docs example uses 4); no documented max or `input_fidelity` on the fetched page | Token priced (gpt-image-2: $8/M image-in, $30/M image-out; 1.5: $32/M out; 1-mini: $8/M out). Per-image 1024x1024 reported by aggregators for gpt-image-2: ~$0.006 low / $0.053 medium / $0.211 high (not confirmed on OpenAI page; token-based estimates run higher) | May require API Organization Verification first (do before the hackathon). User's $50 credit goes far: ~900 medium images. Hackathon credit applicability to image models not verified. |
| FLUX.1 Kontext (via fal / Replicate) | Built for in-context edit with a reference image | ~$0.04 per image Pro (sources vary up to $0.08); Dev ~$0.03; fal bills per megapixel | Good alternative if Gemini/OpenAI drift. |
| Ideogram 3.0 | Character Reference feature | ~$0.03-0.09 without; ~$0.10-0.20 with character reference (sources conflict; official page figures differ) | Strong at text in images (speech bubbles/signs). |
| Midjourney | Omni Reference (V7); V8.x status unsettled (an "Edit Model" reportedly replaces it) | Subscription | No official API as of Aug 2026; only unofficial wrappers (ToS risk). Discord/web workflow works manually. |
| Recraft | Not researched in depth | not found | Gap. |
| Local Stable Diffusion/FLUX on Mac | Possible (IP-Adapter/LoRA/Kontext-dev), more setup | Free compute | Not researched in depth; slow on Mac; a gap. |

### B2. MCP servers / install
- shinpr/mcp-image (MIT, Node 22+): `claude mcp add mcp-image --env GEMINI_API_KEY=KEY --env IMAGE_OUTPUT_DIR=/abs/path -- npx -y mcp-image` (add `--scope user` for global). Providers: Gemini (default), OpenAI (`IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`), Seedream. Has `maintainCharacterConsistency` flag and `inputImagePaths` (PNG/JPEG/WebP, 10 MiB each). Quality presets fast/balanced/quality. Prompt-enhancement step uses Gemini API (set `SKIP_PROMPT_ENHANCEMENT=true` to disable).
- michaeljabbour/imagen-mcp: multi-provider incl. gpt-image-1 and Gemini; reference images (up to 14) listed under Gemini. Config via `claude mcp add -s user imagen` with both keys.
- Legorobotdude/mcp-image-gen: Gemini, reference images up to 14.
- fal.ai official remote MCP: `claude mcp add --transport http --scope user fal https://mcp.fal.ai/mcp-relay`, then `/mcp` to OAuth. Unofficial: raveenb/fal-mcp-server (FAL_KEY).
- Replicate official hosted MCP: `claude mcp add replicate https://mcp.replicate.com/sse --transport sse --scope user`, then `/mcp` to authenticate (endpoint not verified live).
- No MCP needed alternative: a small script calling the API directly with the reference sheet, orchestrated by Claude Code via Bash.
- Typical consistency method (general practice, not source-verified here): generate one character sheet (front/side/expressions), pass it as a reference with every scene prompt, keep a fixed written character description, regenerate on drift.

### B3. Licensing for public use (secondary sources only)
- OpenAI: terms assign output rights to the user; commercial use allowed subject to content policy.
- Google Gemini: Google does not claim ownership; sources disagree on wording (one cites a worldwide non-exclusive license retained by Google). SynthID watermark invisible.
- Copyright protectability of AI output is legally unsettled in general. Midjourney/Ideogram/FLUX Dev licenses not checked (FLUX Dev is non-commercial per BFL license, from general knowledge, not verified here).

### B4. Assembling the story
- Slidev: Markdown + Vue, Vite, best for technical talks with code and presenter tooling; exports PDF/PNG; not editable PPTX. `npm init slidev` (install steps not verified by search).
- reveal.js: full HTML control, no build needed.
- Marp: simplest Markdown slides, CLI export to PDF/PPTX (image-based).
- Claude artifact slides: `quickstart` intent "slides" in this environment gives a hosted shareable deck.
- PPTX: local `pptx` and `pptx-generator` skills produce real .pptx with images; good for offline/backup.
- Comic/storyboard: no dedicated tool researched; options are full-bleed image slides with speech-bubble text in HTML/CSS, or ask the image model for multi-panel layouts (Ideogram strong at lettering). Gap.
- Optional animation: image-to-video prices reported per second, widely inconsistent: Veo 3.1 $0.03-0.75/s depending on tier, Kling ~$0.03-0.17/s (aggregators; verify on official pages). Short 5-8s loops only.
- Voice: not researched (gap).

Sources: [shinpr/mcp-image](https://github.com/shinpr/mcp-image), [Gemini pricing](https://aistudio.google.com/docs/pricing), [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation), [Opper gpt-image-2](https://opper.ai/openai/gpt-image-2), [Segmind comparison](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/), [mcpservers.org mcp-image](https://mcpservers.org/servers/shinpr/mcp-image), [glama imagen-mcp](https://glama.ai/mcp/servers/@michaeljabbour/imagen-mcp/tree/dc900837cd0353f0f4b8ad6159087befcbe261a2), [fal MCP docs](https://fal.ai/docs/documentation/model-apis/mcp.md), [Replicate MCP](https://mcp.replicate.com/), [Kontext pricing](https://pricepertoken.com/image/model/black-forest-labs-flux-kontext-pro), [Ideogram API pricing](https://ideogram.ai/api-pricing/), [Midjourney Oref/API](https://piapi.ai/midjourney-api/oref), [Slidev/Marp/reveal comparison](https://www.pkgpulse.com/guides/slidev-vs-marp-vs-revealjs-code-first-presentations-2026), [AI video pricing](https://invideo.io/blog/ai-video-model-pricing), [terms.law output rights](https://terms.law/ai-output-rights/), [Gemini terms summary](https://www.terms.law/ai-output-rights/gemini/)

## Gaps / not verified
Recraft, local Mac diffusion, voice, comic-layout tools, OpenAI hackathon-credit eligibility for image models, whether the user has an OpenAI key (none in shell env), Slidev install steps, Replicate endpoint liveness.
