-- Username changes (server/rename.ts): who was called what until when. An old name is held for
-- its owner for a while and its profile link leads to the new name; staff can see the history.
CREATE TABLE username_history (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_name TEXT NOT NULL COLLATE NOCASE,
  new_name TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  -- Punk coins paid (0: the free first change).
  paid INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX username_history_old ON username_history(old_name, changed_at);
CREATE INDEX username_history_user ON username_history(user_id, changed_at);
