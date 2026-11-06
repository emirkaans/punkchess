-- Daily quests (server/quests.ts, rules in src/quests/rules.ts): one row per player and day. The
-- day's three quests follow from the player and the day (and the slot changed, if one was); the
-- row keeps how far each one got. `complete` marks a day all three were done (the streak).
CREATE TABLE quest_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  swapped INTEGER NOT NULL DEFAULT -1,
  progress TEXT NOT NULL DEFAULT '0,0,0',
  complete INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
