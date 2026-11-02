-- Site analytics (server/analytics.ts), without cookies: a page view keeps the page's kind
-- (never its address), a visitor is a hash that changes every day, the country and city come
-- from Cloudflare. Kept 180 days.
CREATE TABLE page_views (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  page TEXT NOT NULL,
  visitor TEXT NOT NULL,
  country TEXT,
  city TEXT,
  device TEXT NOT NULL,
  -- The site a visit came from (its host), when another one.
  referrer TEXT
);
CREATE INDEX page_views_at ON page_views(at);
-- Who is on the site now: each visitor's last sign of life (open pages send one every 2 minutes).
CREATE TABLE presence (
  visitor TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
-- Every 5 minutes: visitors on the site and games being played.
CREATE TABLE live_samples (
  at INTEGER PRIMARY KEY,
  online INTEGER NOT NULL,
  games INTEGER NOT NULL
);
