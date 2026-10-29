-- Messages sent from the contact page (/contact, server/contact.ts), read by
-- staff on the admin page. Kept a year at most.

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  -- 'bug' | 'idea' | 'account' | 'other'
  topic TEXT NOT NULL,
  name TEXT,
  -- Where to answer; optional.
  email TEXT,
  -- The signed-in sender, if any (kept when the account is deleted).
  username TEXT,
  message TEXT NOT NULL,
  -- SHA-256 of the sender's IP address, only to limit how often one sender writes.
  ip_hash TEXT,
  read_at INTEGER
);
CREATE INDEX contact_messages_at ON contact_messages(at);
CREATE INDEX contact_messages_ip ON contact_messages(ip_hash, at);
