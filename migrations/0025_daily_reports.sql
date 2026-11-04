-- The daily report (server/report.ts) as it stood at 23:00 Turkey time, one row a day, so the
-- reporting routines can read the days before (GET /api/report/history).
CREATE TABLE daily_reports (
  day TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  report TEXT NOT NULL
);
