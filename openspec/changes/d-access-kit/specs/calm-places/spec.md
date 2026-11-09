## ADDED Requirements

### Requirement: Static calm-places list
The app SHALL provide a Calm places screen listing the All-Attendee Quiet Room (Salt Palace L2, 260A), the Women + Non-Binary Quiet Room (260B), the Prayer Room (Hyatt Regency L5), the nursing room and child care, taken from the public KubeCon page, with the source link and the date it was checked. Places with no published room SHALL say "ask at registration".

#### Scenario: Find a quiet room on a phone
- **WHEN** Kay opens Calm places on a 390 px viewport
- **THEN** room 260A is listed with its building and level, as text, with targets of at least 24 px

#### Scenario: Offline
- **WHEN** the device is offline
- **THEN** the list still shows, because it is static data in the precached shell

#### Scenario: No invented locations
- **WHEN** the source gives no room for the nursing room
- **THEN** the screen says "ask at registration" in EN or ES

#### Scenario: No crowd data
- **WHEN** the screen is viewed
- **THEN** no request carries a location or crowd level, and only the event `kc.access.calm_places_viewed` with no attributes is sent
