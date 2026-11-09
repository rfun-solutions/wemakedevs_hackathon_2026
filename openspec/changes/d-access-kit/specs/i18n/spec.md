## ADDED Requirements

### Requirement: Translation function
The app SHALL provide `t('<change>.<key>', params?)` returning the string for the active language, falling back to English, then to the key itself. Interpolation SHALL use `{name}` placeholders.

#### Scenario: Fallback
- **WHEN** the active language is PT-BR and a key is missing there
- **THEN** the English string is returned

#### Scenario: Missing everywhere
- **WHEN** a key exists in no language
- **THEN** the key is returned and a console warning is logged in development

### Requirement: Language coverage
English and Spanish SHALL contain every key in the registry. PT-BR and Arabic SHALL contain at least the shell, Cards, Settings and badge keys.

#### Scenario: Coverage test
- **WHEN** the unit test compares ES keys to EN keys
- **THEN** it fails if any EN key is missing in ES

### Requirement: Language switcher and persistence
The user SHALL choose a language from Settings. The choice SHALL persist locally and default to the browser language when supported, otherwise EN.

#### Scenario: Switch to Spanish
- **WHEN** the user selects Español
- **THEN** visible text updates without reload, `<html lang="es">` is set, and the change is announced

### Requirement: Right-to-left support
Selecting Arabic SHALL set `dir="rtl"` and `lang="ar"` on the document, and layout SHALL use logical CSS properties so it mirrors correctly.

#### Scenario: Arabic layout on a phone
- **WHEN** the language is Arabic on a 390 px viewport
- **THEN** the navigation and Cards screens mirror, no horizontal scroll occurs, and axe reports no violations

### Requirement: Translation disclosure
The Settings screen SHALL state that translations are AI-assisted and not reviewed by native speakers, in the active language.

#### Scenario: Disclosure visible
- **WHEN** the user opens the language section of Settings
- **THEN** the disclosure text is shown

### Requirement: Locale-aware formatting
Dates and times SHALL be formatted with `Intl` using the active language and an explicit time zone passed by the caller.

#### Scenario: Explicit zone
- **WHEN** a caller formats a time with zone `America/Denver`
- **THEN** the output uses that zone regardless of the device zone
