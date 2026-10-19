-- Gang wars (server/gangs.ts): an active gang challenges another; when its
-- founder accepts, the four members of each meet on four boards at once (a
-- one-round tournament, server/tournament.ts), a win 1, a draw 1/2.
CREATE TABLE gang_wars (
  id TEXT PRIMARY KEY,
  challenger TEXT NOT NULL,
  defender TEXT NOT NULL,
  time_control TEXT NOT NULL,
  -- 'pending' (waiting for an answer), 'live', 'finished', 'declined', 'cancelled'.
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  challenger_score REAL,
  defender_score REAL,
  -- The winning gang's id, NULL for a draw (or before the end).
  winner TEXT,
  tournament_id TEXT
);
CREATE INDEX gang_wars_challenger ON gang_wars(challenger, created_at);
CREATE INDEX gang_wars_defender ON gang_wars(defender, created_at);
