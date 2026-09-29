-- ECOVENT Operations — create app role (run as postgres superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ecovent') THEN
    CREATE ROLE ecovent LOGIN PASSWORD 'ecovent_dev';
  ELSE
    ALTER ROLE ecovent WITH LOGIN PASSWORD 'ecovent_dev';
  END IF;
END
$$;
