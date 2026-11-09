# Time zones

Scope: any code that formats, compares or schedules times (api and web).

- The venue time zone is `America/Denver`. It is always explicit (for example `Intl.DateTimeFormat` with `timeZone: 'America/Denver'`), never derived from the device or server local zone.
- Never use `new Date()` local-time math (`getHours()`, `setDate()`, local `toLocaleString()` without a `timeZone`) for agenda, schedule or thread logic. Store instants in UTC and convert at the edge.
- Tests pin the zone and cover a day boundary.
