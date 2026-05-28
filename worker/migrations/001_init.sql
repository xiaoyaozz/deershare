CREATE TABLE IF NOT EXISTS sessions (
  client_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recv_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  files TEXT NOT NULL,
  message TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_client_id TEXT NOT NULL,
  src_client_id TEXT NOT NULL,
  signal_type TEXT DEFAULT '',
  signal_payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_codes (
  code TEXT PRIMARY KEY,
  expire_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
