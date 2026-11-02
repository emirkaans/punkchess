-- The store (server/store.ts, goods in src/avatar/outfit.ts): the items a player bought with
-- punk coins (the payment is the coin ledger's 'store' entry), and what they wear.
CREATE TABLE user_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  bought_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
-- The worn outfit as a JSON of item ids per slot; NULL: nothing.
ALTER TABLE users ADD COLUMN outfit TEXT;
