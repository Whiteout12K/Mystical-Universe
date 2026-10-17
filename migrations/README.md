# Production D1 migrations

## 2026-10-17: account preferences

Applied `20261017-account-preferences.sql` to the configured **remote** `mystical-data` D1 database using Wrangler, following the requested production database update.

Verified the table with `PRAGMA table_info(user_account_preferences)`. Columns: `user_id` (primary key), `wiki_theme` (default `cookie`), `avatar` (default 1), `background` (default 1), and `updated_at`.

The migration only creates the account-preferences table if it does not already exist. It does not modify users or game saves. This database update does not deploy website code.

## Baseline schema

The complete idempotent database schema is in `migrations/schema.sql`. Run Wrangler commands from the website root. `20261017-account-preferences.sql` is the targeted production migration; the baseline schema is intended for initial setup.
