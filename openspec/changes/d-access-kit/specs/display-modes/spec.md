## ADDED Requirements

### Requirement: Large-type slider
The app SHALL provide a text size control from 100% to 200% in 10% steps that scales all text via a root token.

#### Scenario: 200% on a phone
- **WHEN** the slider is set to 200% on a 390 px viewport
- **THEN** the home, Cards and Settings screens have no horizontal scroll and no clipped text

#### Scenario: Keyboard operation
- **WHEN** the slider is focused and the user presses the arrow keys
- **THEN** the size changes by one step and the new value is announced

### Requirement: Atkinson Hyperlegible font
The app SHALL offer a toggle to use Atkinson Hyperlegible for all text. The font SHALL be self-hosted and loaded only when selected.

#### Scenario: Toggle on
- **WHEN** the user enables the font
- **THEN** `html[data-font="atkinson"]` is set and text renders in that font without any third-party request

### Requirement: High contrast
The app SHALL offer a high-contrast mode with text contrast of at least 7:1 and UI boundary contrast of at least 3:1, and SHALL default it on when the system reports `prefers-contrast: more`.

#### Scenario: System preference
- **WHEN** the OS requests more contrast and the user has no saved choice
- **THEN** high contrast is active on first load

### Requirement: Reduced motion
The app SHALL disable non-essential animation and transitions when the system requests reduced motion or the user turns the toggle on. The user toggle SHALL override the system value.

#### Scenario: Reduced motion on
- **WHEN** reduced motion is on
- **THEN** no element has a running CSS animation or transition longer than 0.01 ms

### Requirement: Persisted, flash-free preferences
Display preferences SHALL persist in localStorage and be applied before first paint. If storage is unavailable the app SHALL still render with defaults.

#### Scenario: Reload
- **WHEN** the user sets 150% and high contrast and reloads
- **THEN** the page renders with both applied and no visible flash of default styling

#### Scenario: Storage blocked
- **WHEN** localStorage throws
- **THEN** the app renders with defaults and no error is shown
