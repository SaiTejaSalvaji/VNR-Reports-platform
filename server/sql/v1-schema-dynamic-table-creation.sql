--deleting all tables
--DROP SCHEMA public CASCADE;

--check tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public';

create schema public;


-- drop table table_metadata;

-- drop table users;

-- drop table departments;


-- departments table
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);




INSERT INTO departments (id,name) VALUES (0,'ADMIN');

INSERT INTO departments (name) VALUES ('TEST'),('DS,CS&AIDS');

SELECT * FROM departments;


-- users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','hod','faculty')),
  department_id INTEGER REFERENCES departments(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);



select * from users;





--adding admin user with 0 as id
insert into users (id,name,password,role,department_id) values ('ADMIN','ADMIN','vnrvjiet','admin',0);

--adding test department users
insert into users (id,name,password,role,department_id) values ('test-0','test-user-hod','vnrvjiet','hod',1),('test-1','test-user-faculty','vnrvjiet','faculty',1);




SELECT * FROM users;


select * from departments;

select * from table_metadata;

select * from faculty_details;





CREATE TABLE table_metadata (
  id SERIAL PRIMARY KEY,
  table_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL, 
  description TEXT, 
  columns JSONB NOT NULL,-- Column definitions: [{"name":"title","type":"TEXT","required":true}]
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);



INSERT INTO table_metadata (table_name, display_name, description, columns, created_by)
VALUES (
  'research_papers',
  'Research Papers',
  'Faculty research publications and papers',
  '[
    {"name": "title", "display_name": "Paper Title", "type": "TEXT", "required": true},
    {"name": "authors", "display_name": "Authors", "type": "TEXT", "required": true},
    {"name": "journal_name", "display_name": "Journal Name", "type": "TEXT", "required": true},
    {"name": "publication_date", "display_name": "Publication Date", "type": "DATE", "required": true},
    {"name": "impact_factor", "display_name": "Impact Factor", "type": "NUMERIC", "required": false},
    {"name": "doi_url", "display_name": "DOI/URL", "type": "TEXT", "required": false}
  ]'::jsonb,
  'ADMIN'
);

CREATE TABLE dyn_research_papers (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  journal_name TEXT NOT NULL,
  publication_date DATE NOT NULL,
  impact_factor NUMERIC,
  doi_url TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Sample data in the real table
INSERT INTO dyn_research_papers (title, authors, journal_name, publication_date, impact_factor, doi_url, created_by)
VALUES
  ('Machine Learning in Education', 'Dr. John Smith, Dr. Jane Doe', 'IEEE Transactions on Education', '2024-01-15', 4.5, 'https://doi.org/10.1234/example', 'CSDS-001'),
  ('Data Science Applications', 'Dr. Alice Brown', 'Journal of Computer Science', '2024-02-20', 3.8, 'https://doi.org/10.5678/example', 'CSDS-002');


-- =========================================== =
-- QUERY EXAMPLES
-- ============================================

-- View all tables metadata
SELECT id, table_name, display_name, description, created_by, created_at
FROM table_metadata
ORDER BY created_at;

-- View columns for a specific table (extracting from JSONB)
SELECT
  table_name,
  display_name,
  jsonb_array_elements(columns) as column_definition
FROM table_metadata
WHERE table_name = 'research_papers';

-- Extract specific column info from JSONB
SELECT
  table_name,
  jsonb_array_elements(columns)->>'name' as column_name,
  jsonb_array_elements(columns)->>'display_name' as column_display_name,
  jsonb_array_elements(columns)->>'type' as column_type,
  jsonb_array_elements(columns)->>'required' as is_required
FROM table_metadata
WHERE table_name = 'research_papers';

-- Count how many dynamic tables exist
SELECT COUNT(*) as total_tables FROM table_metadata;


-- testing dbcon
select * from users where lower(name) like 'dr%';

select * from table_metadata;

-- List all dynamic tables with their column count
SELECT
  table_name,
  display_name,
  jsonb_array_length(columns) as column_count,
  created_at
FROM table_metadata
ORDER BY created_at DESC;





--- account locks

CREATE TABLE account_locks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    last_failed_at TIMESTAMP,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


--Index for performance on login checks
CREATE INDEX idx_account_locks_user_id ON account_locks(user_id);
CREATE INDEX idx_account_locks_locked_until ON account_locks(locked_until);
