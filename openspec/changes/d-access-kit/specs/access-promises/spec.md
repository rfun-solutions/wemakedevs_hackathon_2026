## ADDED Requirements

### Requirement: Access promises content
D SHALL publish five Access promises P1-P5 in Kay's words in `ACCESS-PROMISES.md` and in `web/src/features/access/promises.ts` (`PROMISES`, ids and i18n keys), with EN and ES strings `access.promise.*`. Each promise SHALL list the review rule ids that cite it and the live signal behind its light. D SHALL NOT render the lights; F does.

#### Scenario: Promise text on a phone in Spanish
- **WHEN** F's Status screen renders `PROMISES` with the UI language set to ES on a 390 px viewport
- **THEN** every promise reads in plain Spanish from `access.promise.P1` to `P5`

#### Scenario: Every promise is enforced by a rule
- **WHEN** a reviewer reads `ACCESS-PROMISES.md`
- **THEN** each of P1 to P5 names at least one rule id, and that rule's sentence in `.gitar/review/` contains the promise id

#### Scenario: Ids are stable
- **WHEN** F, G or H reference a promise
- **THEN** they use the ids `P1` to `P5` from `PROMISES` and never copy the text
