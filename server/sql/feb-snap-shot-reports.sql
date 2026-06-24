-- =============================================
  -- 1. CREATE section_config TABLE FIRST
  -- =============================================
  CREATE TABLE section_config (
    id          SERIAL       PRIMARY KEY,
    section_key VARCHAR(100) NOT NULL UNIQUE REFERENCES section_metadata(section_key) ON DELETE CASCADE,
    config      JSONB        NOT NULL DEFAULT '{}',
    created_by  VARCHAR(100) NOT NULL DEFAULT 'ADMIN',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_section_config_section_key ON section_config(section_key);

  -- =============================================
  -- 2. INSERT ALL section_metadata ROWS
  -- =============================================
  INSERT INTO section_metadata
    (section_key, display_name, section_type, columns, accessible_by, report_visibility, display_order, is_active, created_by)
  VALUES (
    'snapshot_review_points',
    '1. Important Points to be Reviewed:',
    'rich_text',
    '[]'::jsonb,
    '["dept:ADMIN"]'::jsonb,
    'none',
    100,
    true,
    'ADMIN'
  );

  INSERT INTO section_metadata
    (section_key, display_name, section_type, columns, accessible_by, report_visibility, display_order, is_active, created_by, fixed_rows)
  VALUES (
    'snapshot_statutory_compliance',
    '2. Relevant Statutory Compliance Issues / Status (PAAC):',
    'fixed_table',
    '[
      {"name": "status", "type": "TEXTAREA", "display_name": "Status / Compliance"}
    ]'::jsonb,
    '["dept:ADMIN"]'::jsonb,
    'none',
    101,
    true,
    'ADMIN',
    '["JNTUH", "AICTE", "NIRF", "QS I-GAUGE", "National Board of Accreditation (NBA)"]'::jsonb
  );

  INSERT INTO section_metadata
    (section_key, display_name, section_type, columns, accessible_by, report_visibility, display_order, is_active, created_by, fixed_rows)
  VALUES (
    'snapshot_placement',
    '4. Placement Support:',
    'fixed_table',
    '[
      {"name": "target",   "type": "TEXT",     "display_name": "Target"},
      {"name": "status",   "type": "TEXTAREA", "display_name": "Status"},
      {"name": "comments", "type": "TEXTAREA", "display_name": "Comments / Initiatives"}
    ]'::jsonb,
    '["dept:MTP"]'::jsonb,
    'none',
    102,
    true,
    'ADMIN',
    '[
      "Number of UG students opted for placement",
      "Number of UG students placed as on date",
      "Percentage of Placements",
      "Highest Package",
      "Median Salary",
      "Average Salary",
      "CSE & Allied: Average Salary",
      "Top MNCs (if any)"
    ]'::jsonb
  );

  INSERT INTO section_metadata
    (section_key, display_name, section_type, columns, accessible_by, report_visibility, display_order, is_active, created_by, fixed_rows)
  VALUES (
    'snapshot_research',
    '5. Research Snapshot & EC Report:',
    'fixed_table',
    '[
      {"name": "target",      "type": "TEXT",     "display_name": "Target"},
      {"name": "status",      "type": "TEXTAREA", "display_name": "Status (As on Date)"},
      {"name": "initiatives", "type": "TEXTAREA", "display_name": "Task Description / Initiatives Undertaken"}
    ]'::jsonb,
    '["dept:RDC"]'::jsonb,
    'none',
    103,
    true,
    'ADMIN',
    '[
      "Research Grants Sanctioned/Approved",
      "Research Revenues Received till date",
      "Number of Research Proposals Submitted",
      "Consultancy Projects - Ongoing",
      "Number of Patents"
    ]'::jsonb
  );

  -- =============================================
  -- 3. INSERT section_config (AFTER section_metadata)
  -- =============================================
  INSERT INTO section_config (section_key, config, created_by)
  VALUES (
    'snapshot_placement',
    '{"labels": {"batch_label": "2022-2026 Batch – B.Tech"}}'::jsonb,
    'ADMIN'
  );

  INSERT INTO section_config (section_key, config, created_by)
  VALUES (
    'snapshot_research',
    '{"labels": {"target_year": "2025-26"}}'::jsonb,
    'ADMIN'
  );
  
  select * from section_config;
  
  
  
  
  
  -- fixing text area
  
    UPDATE section_metadata                                                                                                                            
  SET columns = (                                                                                                                                    
    SELECT jsonb_agg(
      CASE
        WHEN col->>'name' IN ('status', 'comments') THEN col || '{"type": "TEXT"}'::jsonb
        ELSE col
      END
    )
    FROM jsonb_array_elements(columns) AS col
  )
  WHERE section_key = 'snapshot_placement';

  -- Fix snapshot_statutory_compliance: status TEXTAREA → TEXT (per-row)
  UPDATE section_metadata
  SET columns = (
    SELECT jsonb_agg(
      CASE
        WHEN col->>'name' = 'status' THEN col || '{"type": "TEXT"}'::jsonb
        ELSE col
      END
    )
    FROM jsonb_array_elements(columns) AS col
  )
  WHERE section_key = 'snapshot_statutory_compliance';

  -- Fix snapshot_research: initiatives TEXTAREA → SINGLE_TEXTAREA (shared below table)
  UPDATE section_metadata
  SET columns = (
    SELECT jsonb_agg(
      CASE
        WHEN col->>'name' = 'initiatives' THEN col || '{"type": "SINGLE_TEXTAREA"}'::jsonb
        ELSE col
      END
    )
    FROM jsonb_array_elements(columns) AS col
  )
  WHERE section_key = 'snapshot_research';

  -- Fix mtp_activities: highlights TEXTAREA → SINGLE_TEXTAREA (shared below table)
  UPDATE section_metadata
  SET columns = (
    SELECT jsonb_agg(
      CASE
        WHEN col->>'name' = 'highlights' THEN col || '{"type": "SINGLE_TEXTAREA"}'::jsonb
        ELSE col
      END
    )
    FROM jsonb_array_elements(columns) AS col
  )
  WHERE section_key = 'mtp_activities';
  
  
  
  ALTER TABLE section_config DROP CONSTRAINT section_config_section_key_key;
  
  
                                                                                                                                               
  -- Add month and year columns (existing rows default to Feb 2026)                                                                                  
  ALTER TABLE section_config
    ADD COLUMN month SMALLINT NOT NULL DEFAULT 2,
    ADD COLUMN year  SMALLINT NOT NULL DEFAULT 2026;

  -- New composite unique constraint
  ALTER TABLE section_config
    ADD CONSTRAINT section_config_section_key_month_year_key
    UNIQUE (section_key, month, year);

  -- Remove defaults (new inserts must supply values explicitly)
  ALTER TABLE section_config
    ALTER COLUMN month DROP DEFAULT,
    ALTER COLUMN year  DROP DEFAULT;
  
  
  