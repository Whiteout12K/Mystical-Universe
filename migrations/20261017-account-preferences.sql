-- Add website preferences without changing users or game saves.
CREATE TABLE IF NOT EXISTS user_account_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wiki_theme TEXT NOT NULL DEFAULT 'cookie' CHECK(wiki_theme IN ('cookie','light','dark')),
    avatar INTEGER NOT NULL DEFAULT 1,
    background INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
