-- Add username for login (run once on existing databases before prisma db push):
--   npx prisma db execute --file prisma/migrate-add-username.sql --schema prisma/schema.prisma

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE users
SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE username IS NULL OR username = '';

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);
