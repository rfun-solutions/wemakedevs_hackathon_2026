-- c-evening-threads: note membership. note_id has no FK on purpose (B owns notes); a note is in at most one thread.
CREATE TABLE IF NOT EXISTS thread_notes (
  thread_id    uuid        NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
  note_id      uuid        NOT NULL,
  device_id    text        NOT NULL,
  assigned_run uuid        NOT NULL,
  unlinked     boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (thread_id, note_id),
  UNIQUE (note_id)
);
CREATE INDEX IF NOT EXISTS thread_notes_device_idx ON thread_notes (device_id);
