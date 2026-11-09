## ADDED Requirements

### Requirement: Preset communication cards
The app SHALL provide a Cards screen listing preset phrases including "I'm deaf, please type", "Slower please", "Can you repeat that?", "Please face me when you speak", "I stutter, please give me time to finish" and "Thank you". Each preset SHALL be a native button with a target of at least 44 px height.

#### Scenario: Open a preset on a phone
- **WHEN** Kay opens Cards on a 390 px wide viewport and taps "I'm deaf, please type"
- **THEN** the card opens in show-to-person mode with that phrase

#### Scenario: Speech-diversity card
- **WHEN** Kay's friend, who stutters, opens Cards on a phone and taps the stutter preset
- **THEN** "I stutter. Please give me time to finish." opens in show-to-person mode in the chosen card language

#### Scenario: Cards work offline
- **WHEN** the device is offline
- **THEN** all presets are listed and openable

### Requirement: Free-text card
The app SHALL let the user type a custom phrase and show it in show-to-person mode.

#### Scenario: Custom phrase
- **WHEN** the user enters "Where is room 260A?" and taps Show
- **THEN** that text is displayed full-screen

#### Scenario: Empty text
- **WHEN** the text field is empty
- **THEN** the Show button is disabled and a hint is announced to assistive technology

### Requirement: Show-to-person mode
Show-to-person mode SHALL fill the viewport with the phrase at the largest size that fits, in maximum-contrast colours, with a visible Close button reachable by touch and the Escape key. It SHALL keep the screen awake when the browser supports a wake lock.

#### Scenario: Text fits
- **WHEN** a long phrase is shown on a 360 px wide viewport
- **THEN** the text is fully visible without scrolling and the Close button remains visible

#### Scenario: Close
- **WHEN** the user taps Close or presses Escape
- **THEN** focus returns to the card that opened it

### Requirement: Optional text-to-speech
The app SHALL offer a Speak button that reads the card aloud with the browser speech synthesis in the card's language, only when the browser supports it, and only after a user action.

#### Scenario: Supported browser
- **WHEN** the user taps Speak
- **THEN** the phrase is spoken once

#### Scenario: Unsupported browser
- **WHEN** speech synthesis is unavailable
- **THEN** the Speak button is not rendered and the rest of the card works

### Requirement: Card language
The user SHALL be able to choose the language of a card independently of the UI language.

#### Scenario: Show a card in English while the UI is Spanish
- **WHEN** the UI is ES and the card language is EN
- **THEN** the show-to-person text is English and tagged `lang="en"`

### Requirement: Local-only communication-preference badge
The app SHALL provide a badge screen with optional pronouns, name, and toggles such as "I prefer text" and "Quiet please". Badge data SHALL be stored only in the browser and SHALL NOT be sent to the API or recorded in telemetry.

#### Scenario: Persisted locally
- **WHEN** the user saves a badge and reloads
- **THEN** the badge shows the saved values

#### Scenario: No network traffic
- **WHEN** the user saves the badge
- **THEN** no network request containing badge fields is made

#### Scenario: Show badge
- **WHEN** the user taps Show badge
- **THEN** the badge opens in show-to-person mode
