SELECT tablename
FROM pg_tables
WHERE schemaname = 'public';


--clean db
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;