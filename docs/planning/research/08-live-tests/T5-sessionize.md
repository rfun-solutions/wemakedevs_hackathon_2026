# T5: Sessionize schedule feed snapshot
Fetched 2026-11-08 from `https://kubecon-cloudnativecon-north-america-2026.sessionize.com/api/schedule` (HTTP 200, 1.93 MB, no key). Fixture in the test repo: `fixtures/sessionize-v1.json` (60 of 600 sessions, every 10th by start time; descriptions cut to 160 chars; 37 rooms and 5 categories verbatim; 95 speakers anonymised to "Speaker 001..", no bios, photos, links, taglines, answers). Repo: https://github.com/a throwaway test repo/tree/main/fixtures (also `sessionize-v2.json` = deliberate drift).

## Top level
`{ sessions[600], speakers[712], questions[6], categories[5], rooms[37] }`

## sessions[] (all 600 had every field)
| field | type | notes |
|---|---|---|
| id | string | numeric text e.g. "1292207" |
| title | string | |
| description | string or null | 47 of 600 null |
| startsAt, endsAt | string | `YYYY-MM-DDTHH:mm:ss`, NO offset: naive local venue time (Mountain). Never parse as UTC |
| isServiceSession, isPlenumSession | boolean | both false for all 600 (service sessions like "Coat + Bag Check" are not flagged) |
| speakers | string[] | speaker UUIDs, may be empty |
| categoryItems | number[] | up to 4; ids into `categories[].items` |
| questionAnswers | {questionId, answerValue}[] | e.g. a "Company" or event URL answer |
| roomId | number | always set; always resolves in `rooms` |
| liveUrl, recordingUrl | null today | will become strings |
| status | string | "Accepted" for all 600 |
| isInformed, isConfirmed | boolean | |

Days (by startsAt date): 2026-11-08: 4, 11-09: 78, 11-10: 194, 11-11: 203, 11-12: 121.

## rooms[]
`{ id:number, name:string, sort:number }`. Name is a `" | "`-joined path. Part counts seen: 1, 2, 3, 5, 6.
- Typical 3 parts: `Salt Palace | Level 1 | Hall DE`, `Hyatt Regency | Level 4 | Regency Ballroom B`.
- Buildings: Salt Palace, Hyatt Regency, "Hyatt Regency Lobby" (1 part), "Off-Site Location", "Room TBD" (1 part, no building).
- Irregular: `Salt Palace | 200 South Entrance (South)` (2 parts); Solutions Showcase rooms with 5-6 parts, e.g. `Salt Palace | Level 1 | Solutions Showcase | Hall 1 | Alpine Overlook Zone | Demo Theater` (also "Halls 5" vs "Hall 5" spelling variation).
- Building heuristic: first segment = building; second = level only if it starts with "Level"; the rest = room. The mapper in the test repo takes first, second and the remainder, which mis-labels 1- and 2-part names (level may hold a room name).

## categories[]
`{ id, title, sort, type, items:[{id,name,sort}] }`. Groups: "All Sessions" (30 tracks, e.g. AI Inference + Agentic, Observability, Platform Engineering), "Audience Level" (3), "End User Programming" (1), "Solutions Showcase Programming" (1), "Presentation Slides" (1).

## speakers[] (for the real feed; not stored)
`id` (uuid string), `firstName`, `lastName`, `fullName`, `bio`, `tagLine`, `profilePicture` (URL), `isTopSpeaker`, `links[]`, `sessions[]` (session ids), `categoryItems`, `questionAnswers`. Contains personal data; strip in any repo.

## questions[]
`{ id, question, questionType (e.g. Short_Text), sort }`.

## Drift variant used in T1 (v2)
`sessions[].startsAt/endsAt` renamed `starts_at/ends_at`; `rooms[].name` replaced by `building`, `level`, `room`. Gitar fixed the code to accept it (T1 PR #1).

## Notes for the data model
- Naive local times: store the IANA zone `America/Denver` separately.
- Service sessions must be filtered by title or room, not by the flags.
- 600 sessions / 1.9 MB raw; trimmed fixture 61 KB.
