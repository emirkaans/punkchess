-- Invites: who brought a player here (their invite link, /?ref=<username>).
-- Friends who joined and finished an online game earn the inviter the
-- "crew" spray tag (src/achievements/tags.ts).
ALTER TABLE users ADD COLUMN invited_by TEXT;
CREATE INDEX users_invited_by ON users(invited_by);
