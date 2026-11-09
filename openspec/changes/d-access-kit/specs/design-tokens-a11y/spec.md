## ADDED Requirements

### Requirement: Design tokens
`web/src/styles/tokens.css` SHALL define colour roles, type scale, spacing, radii, elevation and focus tokens, applied from the Impeccable direction the user selects. Other changes SHALL use these tokens and SHALL NOT hard-code colours or sizes.

#### Scenario: Direction selection
- **WHEN** the build agent starts
- **THEN** it runs the Impeccable skill, presents 2-3 mobile-first directions, and finalises tokens only after the user picks one

#### Scenario: Default before the pick
- **WHEN** no direction has been chosen
- **THEN** a neutral default token set builds and passes the contrast test

#### Scenario: Contrast gate
- **WHEN** the unit test evaluates default and high-contrast token pairs
- **THEN** text pairs are at least 4.5:1 (7:1 in high contrast) and UI boundary pairs at least 3:1

### Requirement: Target size and focus
Interactive controls SHALL be at least 24 by 24 CSS px, with primary mobile actions at least 44 px. Keyboard focus SHALL show a visible ring and SHALL NOT be hidden by sticky headers or bottom navigation.

#### Scenario: Target audit
- **WHEN** the Playwright mobile test measures all buttons and links on the shell, Cards and Settings screens
- **THEN** none is smaller than 24 by 24 px

#### Scenario: Focus not obscured
- **WHEN** the user tabs through a long page with a sticky bottom navigation
- **THEN** each focused element is fully visible

### Requirement: Live-region helper
The app SHALL mount one shared polite live region and one assertive live region in the shell and expose `announce(text, politeness)`.

#### Scenario: Announce
- **WHEN** a feature calls `announce("Saved")`
- **THEN** the polite region text becomes "Saved"

### Requirement: Semantic controls
Buttons SHALL be `<button>`, links `<a href>`, and every form control SHALL have a programmatic label. The app SHALL NOT use `div` or `span` as buttons.

#### Scenario: Lint
- **WHEN** lint runs
- **THEN** a `div` or `span` with an `onClick` and no role fails the jsx-a11y rule

### Requirement: Automated accessibility checks
The shell, Cards, Settings and Badge screens SHALL pass axe with zero violations at iPhone 15 and Pixel 7 viewports, in default, 200% type, high contrast and Arabic RTL states.

#### Scenario: axe matrix
- **WHEN** the `a11y` CI job runs
- **THEN** every screen and state above reports zero axe violations

### Requirement: Inherited accessibility rules
D SHALL publish `docs/accessibility.md` listing the WCAG 2.2 AA rules, token and `t()` usage, and the checklist that other changes follow.

#### Scenario: Reference
- **WHEN** another change adds a screen
- **THEN** its tasks can cite `docs/accessibility.md` for the checklist

### Requirement: Inclusion review rules content
D SHALL write the content of `.gitar/review/inclusion.md` (Deaf and ESL inclusion, plain language) and `.gitar/review/demo-data.md` (demo-data privacy), each rule testable in one sentence and naming the promise it protects (for example `IN-2 (Promise P4)`), and SHALL add to `.gitar/review/accessibility.md` a rule that a failing accessibility check is fixed in the tokens, never by weakening the test. The content SHALL be on `main` before D's first feature pull request.

#### Scenario: English-only string on a phone screen
- **WHEN** a pull request adds a card label with an EN key and no ES key
- **THEN** Gitar's review can cite rule IN-2 from `inclusion.md`, whose sentence names Promise P4

#### Scenario: Speaker name in a fixture
- **WHEN** a pull request adds a fixture containing a speaker name or email
- **THEN** Gitar's review can cite rule DD-1 from `demo-data.md`

#### Scenario: Rules land first
- **WHEN** D's PR 1 is opened
- **THEN** PR 0 with the rule content has already merged

### Requirement: Contrast failures name the token
The contrast unit test and the axe e2e check SHALL report a failure with the token pair name, the measured ratio, the required ratio and the computed colours.

#### Scenario: Staged regression
- **WHEN** the prepared branch lowers the show-to-person text pair to 3.9:1
- **THEN** both checks fail and the log names the token pair and `4.5:1`

#### Scenario: Branch not opened early
- **WHEN** D finishes group 5
- **THEN** the regression branch exists on the remote and no pull request is open for it
