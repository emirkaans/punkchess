-- Punk coins (server/coins.ts, rules in src/coins/rules.ts): every coin a player earned, one
-- row per (player, reason, ref) so nothing pays twice; the balance is the sum. `day` is the
-- daily puzzle's day, for the daily ceilings.
CREATE TABLE coin_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, reason, ref)
);
CREATE INDEX coin_ledger_user_day ON coin_ledger(user_id, day);
