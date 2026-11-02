-- The wardrobe (server/store.ts, src/ui/WardrobePage.tsx): a player's saved outfits, a JSON
-- array of 3 entries (each clothes by slot, or null for an empty place).
ALTER TABLE users ADD COLUMN kombins TEXT;
