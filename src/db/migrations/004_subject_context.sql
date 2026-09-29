ALTER TABLE events ADD COLUMN subject_id TEXT;
ALTER TABLE events ADD COLUMN subject_label TEXT;

CREATE INDEX IF NOT EXISTS idx_events_subject_label ON events(subject_label);
