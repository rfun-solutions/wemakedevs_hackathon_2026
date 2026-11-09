## ADDED Requirements

### Requirement: Translate captions
Kay SHALL be able to translate caption lines into a chosen language, using the Chrome Translator where present and the server otherwise.

#### Scenario: Chrome Translator present
- **WHEN** `Translator` is available and Kay turns on Translate
- **THEN** translation runs in the browser, no request is sent to `/api/translate`, and each segment is translated once

#### Scenario: Phone without Translator
- **WHEN** `Translator` is absent (iPhone, Android) and Kay turns on Translate
- **THEN** each segment is sent to `POST /api/translate` and the translation appears under the original line in the live region

### Requirement: Server translate endpoint
`POST /api/translate` SHALL call C0's LLM client, be rate-limited per device, be traced, and be excluded from the load test.

#### Scenario: Traced call
- **WHEN** a valid request is made
- **THEN** a `kc.translate.request` span with a child GenAI span is emitted and `kc_translate_total{path="server"}` increments

#### Scenario: Rate limit
- **WHEN** one device exceeds 15 requests per minute
- **THEN** the endpoint returns 429 and the UI shows a retry message

#### Scenario: Global daily cap
- **GIVEN** a replica has served `TRANSLATE_DAILY_CAP` translate calls today (America/Denver)
- **WHEN** any device asks for another translation
- **THEN** the endpoint returns 503 with reason `daily_cap` without calling the LLM, `kc_translate_capped_total` increments, and the phone keeps the original line with a plain "translation is unavailable right now" message

#### Scenario: Invalid input
- **WHEN** text is empty or over 1,000 characters, or the target is not an allowed language
- **THEN** the endpoint returns 400 and does not call the LLM

#### Scenario: Prompt injection in captions
- **WHEN** caption text contains instructions
- **THEN** it is translated as plain text and never executed, and the output is rendered as text only

#### Scenario: Load test exclusion
- **WHEN** the 50-user load test runs
- **THEN** its script does not call `/api/translate`
