-- A username changed by staff (server/admin.ts) or by a staff member themself: who did it. Such
-- changes still hold the old name and redirect its link, but are not the player's own changes
-- (they cost nothing and do not start the 30 days).
ALTER TABLE username_history ADD COLUMN by_staff TEXT;
