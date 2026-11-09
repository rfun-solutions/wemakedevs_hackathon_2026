-- 000_init: devices seen by the API (opaque UUID from X-Device-Id; no accounts, no personal data).
CREATE TABLE IF NOT EXISTS devices (
  id            uuid PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);
