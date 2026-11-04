-- The weekly review's suggestions (server/report.ts), numbered within their week, so the owner
-- can approve one by number ("Öneri 2") and the next review does not repeat them.
CREATE TABLE suggestions (
  week TEXT NOT NULL,
  n INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  size TEXT,
  risk TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (week, n)
);
-- The last time each alert (server/alerts.ts) was sent, so one problem sends one message an hour.
CREATE TABLE alerts_sent (
  kind TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
