-- Shop-floor production track fields on customer_orders (run once if GET /api/orders or
-- GET /api/enquiries returns 500 with "straight_ducts_status does not exist"):
--   cd server && npx prisma db execute --file prisma/migrate-production-track-columns.sql --schema prisma/schema.prisma
-- Or: npm run db:push

ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS straight_ducts_status TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS straight_ducts_active_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS straight_ducts_run_started_at TIMESTAMP(3);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS straight_ducts_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS straight_ducts_completed_at TIMESTAMP(3);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS straight_ducts_completed_by TEXT;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS plasma_ducts_status TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS plasma_ducts_active_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS plasma_ducts_run_started_at TIMESTAMP(3);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS plasma_ducts_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS plasma_ducts_completed_at TIMESTAMP(3);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS plasma_ducts_completed_by TEXT;
