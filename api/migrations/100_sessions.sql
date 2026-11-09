-- A (a-schedule-agenda): conference sessions derived from the Sessionize feed. No speaker data.
CREATE TABLE IF NOT EXISTS sessions (
  id             text PRIMARY KEY,
  title          text NOT NULL,
  description    text,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  venue_tz       text NOT NULL DEFAULT 'America/Denver',
  building       text,
  level          text,
  room           text,
  room_raw       text,
  track          text,
  audience_level text,
  is_service     boolean NOT NULL DEFAULT false,
  access_tags    text[] NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_starts_at_idx ON sessions (starts_at);
CREATE INDEX IF NOT EXISTS sessions_track_idx ON sessions (track);
