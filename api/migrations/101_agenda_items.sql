-- A: personal agenda keyed by anonymous device id (X-Device-Id), no account.
CREATE TABLE IF NOT EXISTS agenda_items (
  device_id  uuid NOT NULL,
  session_id text NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, session_id)
);
