

-- 1. departments

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);



-- 2. users

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','hod','reports-incharge','faculty')),
  department_id INTEGER REFERENCES departments(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);



-- 3. account locks

CREATE TABLE account_locks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    last_failed_at TIMESTAMP,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_account_locks_user_id ON account_locks(user_id);
CREATE INDEX idx_account_locks_locked_until ON account_locks(locked_until);


-- 4. section_metadata
 

CREATE TABLE IF NOT EXISTS section_metadata (
    id SERIAL PRIMARY KEY,
    section_key VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    section_type VARCHAR(50) NOT NULL
        CHECK (section_type IN ('records', 'single_value', 'rich_text', 'fixed_table')),
    columns JSONB DEFAULT '[]',
    fixed_rows JSONB DEFAULT NULL,
    accessible_by JSONB DEFAULT '["academic"]',
    report_visibility VARCHAR(20) DEFAULT 'none'
        CHECK (report_visibility IN ('none', 'department', 'institute')),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_metadata_accessible ON section_metadata USING GIN (accessible_by);



--5. monthly_reports

CREATE TABLE IF NOT EXISTS monthly_reports (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    report_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_lookup ON monthly_reports(department_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_data ON monthly_reports USING GIN (report_data);




-- inserting data
-- -- departments


INSERT INTO departments (id, name) VALUES (0, 'TEST');

INSERT INTO departments (name) VALUES
('ADMIN'),
('CE'),
('EEE'),
('ME'),
('ECE'),
('CSE'),
('EIE'),
('IT'),
('AE'),
('CSE (AIML & IoT)'),
('CSE (CS, DS) AI&DS'),
('Physics'),
('Chemistry'),
('English'),
('M&MS'),
('HR'),
('MTP'),
('ALUMNI'),
('ED CELL'),
('RDC'),
('LIBRARY');

select * from departments;

-- users


INSERT INTO users (id, name, password, role, department_id)
VALUES ('ADMIN', 'ADMIN', 'vnrvjiet', 'admin', 1);

INSERT INTO users (id, name, password, role, department_id)
VALUES ('TEST-0', 'TEST-HOD', 'vnrvjiet', 'hod', 0);


INSERT INTO users (id, name, password, role, department_id)
VALUES ('TEST-1', 'TEST-FACULTY', 'vnrvjiet', 'faculty', 0);

INSERT INTO users (id, name, password, role, department_id)
VALUES (
    '00CSE008',
    'Dr. Talluri Sunil Kumar',
    'vnrvjiet',
    'hod',
    (SELECT id FROM departments WHERE name = 'CSE (CS, DS) AI&DS')
);




INSERT INTO users (id, name, password, role, department_id)
VALUES 
('ALUMNI.ADMIN', 'Alumni Incharge', 'vnrvjiet', 'hod', (SELECT id FROM departments WHERE name = 'ALUMNI')),
('EDCELL.ADMIN', 'ED Cell Incharge', 'vnrvjiet', 'hod', (SELECT id FROM departments WHERE name = 'ED CELL')),
('RDC.ADMIN', 'RDC Incharge', 'vnrvjiet', 'hod', (SELECT id FROM departments WHERE name = 'RDC')),
('LIBRARY.ADMIN', 'Library Incharge', 'vnrvjiet', 'hod', (SELECT id FROM departments WHERE name = 'LIBRARY'));


SELECT * FROM users;



-- section_metadata

-- 1. faculty details


INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    columns,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'faculty_details',
    '1. Faculty Details',
    'single_value',
    '[
        {"name": "joined", "display_name": "No. of Faculty Joined", "type": "NUMBER", "required": true},
        {"name": "left", "display_name": "No. of Faculty Left", "type": "NUMBER", "required": true},
        {"name": "required", "display_name": "No. of Faculty required", "type": "NUMBER", "required": true},
        {"name": "promoted", "display_name": "No. of Faculty Promoted", "type": "NUMBER", "required": true},
        {"name": "total", "display_name": "Total No. of Faculty", "type": "NUMBER", "required": true},
        {"name": "phd_awarded", "display_name": "Ph.D Awarded", "type": "NUMBER", "required": true},
        {"name": "phd_with", "display_name": "No. of Faculty with Ph.D", "type": "NUMBER", "required": true},
        {"name": "phd_without", "display_name": "No. of Faculty without Ph.D", "type": "NUMBER", "required": true}
    ]'::jsonb,
    '["dept:HR"]',
    1,
    'ADMIN'
);


-- 2. CONFERENCES/ FDPs / WORKSHOPS/ SEMINARS/WEBINARS/ GUEST LECTURES conducted at VNR VJIET:

INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    columns,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'events_conducted',
    '2. CONFERENCES/ FDPs / WORKSHOPS/ SEMINARS/WEBINARS/ GUEST LECTURES conducted at VNR VJIET:',
    'records',
    '[
        {"name": "event_type", "display_name": "Event Type", "type": "SELECT", "options": ["Conference", "FDP", "Workshop", "Seminar/Webinar", "Guest Lecture", "Others"], "required": true},
        {"name": "description", "display_name": "Event Description/Title", "type": "TEXTAREA", "required": true}
    ]'::jsonb, 
    '["academic"]',
    2,
    'ADMIN'
);


select * from section_metadata;

-- 3. FACULTY SPONSORED TO CONFERENCES / FDPs/ WORKSHOPS/ SEMINARS/ WEBINARS:

INSERT INTO section_metadata (
    section_key, 
    display_name, 
    section_type, 
    columns, 
    accessible_by, 
    display_order, 
    created_by
) VALUES (
    'faculty_sponsored', 
    '3. FACULTY SPONSORED TO CONFERENCES / FDPs/ WORKSHOPS/ SEMINARS/ WEBINARS:', 
    'records',
    '[
        {"name": "event_type", "display_name": "Event Type", "type": "SELECT", "options": ["Conference", "FDP", "Workshop", "Seminar/Webinar", "Others"], "required": true},
        {"name": "description", "display_name": "Details of Faculty & Event", "type": "TEXTAREA", "required": true}
    ]'::jsonb, 
    '["academic"]', 
    3, 
    'ADMIN'
);


-- Section 4: Faculty Research Papers

INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('conference_papers', '4. FACULTY RESEARCH PAPERS PRESENTED IN INTERNATIONAL/NATIONAL CONFERENCE:', 'records',
'[
    {"name": "faculty_info", "display_name": "Faculty Name, Designation & Department", "type": "TEXTAREA", "required": true},
    {"name": "authors", "display_name": "List of Authors in the order that appears on the paper", "type": "TEXTAREA", "required": true},
    {"name": "title", "display_name": "Full Title of the Paper", "type": "TEXTAREA", "required": true},
    {"name": "conf_details", "display_name": "Conference details in which the Paper is presented. (Name, organizing institution)", "type": "TEXTAREA", "required": true},
    {"name": "proceeding", "display_name": "Proceeding Details", "type": "TEXT"},
    {"name": "date", "display_name": "Date/ Month & Year of Presentation", "type": "TEXT", "required": true},
    {"name": "index", "display_name": "Indexed in SCOPUS / Web of Science / Google Scholar", "type": "TEXT"}
]'::jsonb, '["academic"]', 4, 'ADMIN');


-- Section 5: Faculty Publications (Detailed Table)
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('journal_publications', '5. FACULTY PUBLICATIONS IN INTERNATIONAL/NATIONAL JOURNALS:', 'records',
'[
    {"name": "faculty_info", "display_name": "Faculty Name, Designation & Department", "type": "TEXTAREA", "required": true},
    {"name": "authors", "display_name": "List of Authors in the order that appears on the paper", "type": "TEXTAREA", "required": true},
    {"name": "title", "display_name": "Full Title of the Paper", "type": "TEXTAREA", "required": true},
    {"name": "journal_name", "display_name": "Journal Name", "type": "TEXT", "required": true},
    {"name": "vol_issue", "display_name": "Volume, Issue, Page Numbers", "type": "TEXT"},
    {"name": "date", "display_name": "Month & Year of Publication", "type": "TEXT", "required": true},
    {"name": "issn", "display_name": "ISSN No./ ISBN No.", "type": "TEXT"},
    {"name": "citations", "display_name": "No. of Citations", "type": "NUMBER"},
    {"name": "impact_factor", "display_name": "Impact Factor", "type": "NUMBER"},
    {"name": "index", "display_name": "Indexed in SCOPUS / WOS/ Google Scholar", "type": "TEXT"}
]'::jsonb, '["academic"]', 5, 'ADMIN');





-- Section 6: Institute/Department Achievements
INSERT INTO section_metadata (section_key, display_name, section_type, accessible_by, display_order, created_by)
VALUES ('dept_achievements', '6. Institute/Department Achievements:', 'rich_text', '["academic"]', 6, 'ADMIN');

-- Section 7: Faculty Achievements
INSERT INTO section_metadata (section_key, display_name, section_type, accessible_by, display_order, created_by)
VALUES ('faculty_achievements', '7. Faculty Achievements:', 'rich_text', '["academic"]', 7, 'ADMIN');

-- Section 8: Students Achievements
INSERT INTO section_metadata (section_key, display_name, section_type, accessible_by, display_order, created_by)
VALUES ('student_achievements', '8. Students Achievements:', 'rich_text', '["academic"]', 8, 'ADMIN');



-- Section 9: Guest Lectures organized
INSERT INTO section_metadata (
    section_key, 
    display_name, 
    section_type, 
    columns, 
    accessible_by, 
    display_order, 
    created_by
) VALUES (
    'guest_lectures', 
    '9. Guest Lectures organized:', 
    'records',
    '[
        {"name": "resource_person", "display_name": "Name & Details of the resource person", "type": "TEXT", "required": true},
        {"name": "topic", "display_name": "Topic of the Guest Lecture", "type": "TEXT", "required": true},
        {"name": "dates", "display_name": "Dates of the Lecture", "type": "TEXT", "required": true},
        {"name": "beneficiaries", "display_name": "Beneficiaries", "type": "TEXT"},
        {"name": "participants_count", "display_name": "No. of participants", "type": "NUMBER"},
        {"name": "impact", "display_name": "Impact of the lecture", "type": "TEXTAREA"}
    ]'::jsonb, 
    '["academic"]', 
    9, 
    'ADMIN'
);


-- Section 10: Students sponsored for Events
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('students_sponsored', '10. Students sponsored for Seminars/Workshops/ Training Programmes/ Hackathons/ Coding Contests/ Conferences / Paper presentation/ Project Presentation/ Sports / Extracurricular activities etc.', 'records', 
'[
    {"name": "topic", "display_name": "Name of the Topic", "type": "TEXT", "required": true},
    {"name": "date", "display_name": "Date of Event", "type": "TEXT", "required": true},
    {"name": "beneficiaries", "display_name": "Beneficiaries", "type": "TEXT"},
    {"name": "impact", "display_name": "Impact", "type": "TEXTAREA"}
]'::jsonb, '["academic"]', 10, 'ADMIN');

-- Section 11: Seminars/workshops/training Programmes organized
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('events_organized', '11. Seminars/workshops/training Programmes organized:', 'records', 
'[
    {"name": "resource_person", "display_name": "Name & Details of the resource person", "type": "TEXT", "required": true},
    {"name": "topic", "display_name": "Topic", "type": "TEXT", "required": true},
    {"name": "dates", "display_name": "Dates", "type": "TEXT", "required": true},
    {"name": "beneficiaries", "display_name": "Beneficiaries", "type": "TEXT"},
    {"name": "participants_count", "display_name": "No. of participants", "type": "NUMBER"},
    {"name": "impact", "display_name": "Impact of the lecture", "type": "TEXTAREA"}
]'::jsonb, '["academic"]', 11, 'ADMIN');

-- Section 12: Hackathons/coding contests/others organized
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('hackathons_organized', '12. Hackathons/coding contests/others organized:', 'records', 
'[
    {"name": "event_details", "display_name": "Particulars of the event", "type": "TEXT", "required": true},
    {"name": "beneficiaries", "display_name": "Beneficiaries", "type": "TEXT"},
    {"name": "duration", "display_name": "Duration with dates", "type": "TEXT"},
    {"name": "participants_internal", "display_name": "No. of Participants from VNRVJIET", "type": "NUMBER"},
    {"name": "participants_external", "display_name": "No. of Participants from outside VNRVJIET", "type": "NUMBER"},
    {"name": "evaluators", "display_name": "Resource Person(s)/ Evaluators", "type": "TEXT"}
]'::jsonb, '["academic"]', 12, 'ADMIN');

-- Section 13: Industrial Visits/ THUB/WeHUB/MSME etc.
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('industrial_visits', '13. Industrial Visits/ THUB/WeHUB/MSME etc. :', 'records', 
'[
    {"name": "year", "display_name": "Year", "type": "TEXT", "required": true},
    {"name": "industry", "display_name": "Industry Visited", "type": "TEXT", "required": true},
    {"name": "date", "display_name": "Date of the Visit", "type": "TEXT", "required": true},
    {"name": "location", "display_name": "Location of the Industry", "type": "TEXT"},
    {"name": "count", "display_name": "No. of students Visited", "type": "NUMBER"},
    {"name": "impact", "display_name": "Impact", "type": "TEXTAREA"}
]'::jsonb, '["academic"]', 13, 'ADMIN');

-- Section 14: Ongoing Research Projects
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('ongoing_projects', '14. Ongoing Research Projects:', 'records', 
'[
    {"name": "title", "display_name": "List of R&D Projects Title", "type": "TEXT", "required": true},
    {"name": "pi_name", "display_name": "PI Name", "type": "TEXT", "required": true},
    {"name": "institute_level", "display_name": "Institute / Dept. Level", "type": "TEXT"},
    {"name": "amount_sanctioned", "display_name": "Estimated Amount Sanctioned / Approved (in Lakhs)", "type": "NUMBER"},
    {"name": "expenditure", "display_name": "Expenditure Incurred Lakhs", "type": "NUMBER"},
    {"name": "remarks", "display_name": "Remarks", "type": "TEXT"}
]'::jsonb, '["dept:RDC"]', 14, 'ADMIN');

-- Section 15: Project Proposals submitted
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('project_proposals', '15. Project Proposals submitted:', 'records', 
'[
    {"name": "title", "display_name": "List of R&D Projects Title", "type": "TEXT", "required": true},
    {"name": "pi_name", "display_name": "PI Name", "type": "TEXT", "required": true},
    {"name": "funding_scheme", "display_name": "Funding Scheme, Date of Submission & File Number", "type": "TEXTAREA"},
    {"name": "institute_level", "display_name": "Institute / Dept. Level", "type": "TEXT"},
    {"name": "amount_approved", "display_name": "Estimated Amount Sanctioned / Approved (in Lakhs)", "type": "NUMBER"}
]'::jsonb, '["dept:RDC"]', 15, 'ADMIN');

-- Section 16: Ongoing Consultancy Projects
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('consultancy_projects', '16. Ongoing Consultancy Projects:', 'records', 
'[
    {"name": "title", "display_name": "List of R&D Projects Title", "type": "TEXT", "required": true},
    {"name": "pi_name", "display_name": "PI Name", "type": "TEXT", "required": true},
    {"name": "institute_level", "display_name": "Institute / Dept. Level", "type": "TEXT"},
    {"name": "amount_approved", "display_name": "Estimated Amount Sanctioned / Approved (in Lakhs)", "type": "TEXT"},
    {"name": "received_amount", "display_name": "Received in Lakhs", "type": "NUMBER"}
]'::jsonb, '["dept:RDC"]', 16, 'ADMIN');

-- Section 17: PATENTS FILED/PUBLISHED/GRANTED
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('patents', '17. PATENTS FILED/PUBLISHED/GRANTED:', 'records', 
'[
    {"name": "dept", "display_name": "Dept.", "type": "TEXT", "required": true},
    {"name": "title", "display_name": "Title of the Patent", "type": "TEXT", "required": true},
    {"name": "applicant", "display_name": "Name of the Applicant", "type": "TEXT", "required": true}
]'::jsonb, '["academic"]', 17, 'ADMIN');

-- Section 18: CENTRAL LIBRARY INFORMATION & RESOURCE CENTRE
INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
VALUES ('library_info', '18. CENTRAL LIBRARY INFORMATION & RESOURCE CENTRE:', 'single_value', 
'[
    {"name": "question_papers", "display_name": "Total No. of Question Papers of B. Tech and M. Tech added to Knimbus E-Library", "type": "NUMBER"},
    {"name": "plagiarism_checks", "display_name": "Plagiarism conducted for staff and students Publications", "type": "NUMBER"},
    {"name": "knimbus_users", "display_name": "Knimbus online E-Library total users", "type": "NUMBER"},
    {"name": "library_utilization", "display_name": "Online Library Utilization of Staff and Students, Searched Articles, E-books referred/downloaded", "type": "NUMBER"},
    {"name": "titles_added", "display_name": "Total No. of Titles added", "type": "NUMBER"},
    {"name": "volumes_added", "display_name": "Total No. of Volumes added", "type": "NUMBER"},
    {"name": "books_cost", "display_name": "Total Cost of Books", "type": "TEXT"}
]'::jsonb, '["dept:LIBRARY"]', 18, 'ADMIN');





 -- Section 19: MTP Placement Activities with Fixed Departments

  INSERT INTO section_metadata (
      section_key,
      display_name,
      section_type,
      columns,
      fixed_rows,
      accessible_by,
      display_order,
      created_by
  ) VALUES (
      'mtp_activities',
      '19. Placement Activities:',
      'fixed_table',
      '[
          {"name": "on_rolls", "display_name": "On Rolls (A)", "type": "NUMBER"},
          {"name": "registered", "display_name": "Registered for placements (B)", "type": "NUMBER"},
          {"name": "eligible", "display_name": "Eligible (without Backlogs) (C)", "type": "NUMBER"},
          {"name": "placed", "display_name": "No. of Students placed (D)", "type": "NUMBER"},
          {"name": "offers", "display_name": "Total no of Offers (E)", "type": "NUMBER"},
          {"name": "percentage", "display_name": "Percentage (%) (D/C)", "type": "NUMBER"},
          {"name": "avg_package", "display_name": "Average package in Lakhs", "type": "NUMBER"}
      ]'::jsonb,
      '["CSE", "CSBS", "AIML", "IOT", "DS", "CYS", "AI & DS", "IT", "ECE", "EEE", "EIE", "ME", "CE", "AE"]'::jsonb,
      '["dept:MTP"]',
      19,
      'ADMIN'
  );
 
-- Section 21: Alumni
INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'alumni_activities',
    '21. Alumni:',
    'rich_text',
    '["dept:ALUMNI"]',
    21,
    'ADMIN'
);



-- Section 22: ED Cell Activities
INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'ed_cell_activities',
    '22. ED Cell Activities:',
    'rich_text',
    '["dept:ED CELL"]',
    22,
    'ADMIN'
);


-- Section 23: Research & Development Cell
INSERT INTO section_metadata (
    section_key, 
    display_name, 
    section_type, 
    accessible_by, 
    display_order, 
    created_by
) VALUES (
    'rdc_activities', 
    '23. Research & Development Cell:', 
    'rich_text', 
    '["dept:RDC"]', 
    23, 
    'ADMIN'
);


-- for storing MTP docs (GCS-based storage)
  CREATE TABLE uploaded_documents (
      id SERIAL PRIMARY KEY,
      department_id INTEGER REFERENCES departments(id),
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
      section_key VARCHAR(100) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      gcs_path VARCHAR(500) NOT NULL,
      content_type VARCHAR(100) DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploaded_by TEXT REFERENCES users(id) ON UPDATE CASCADE,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(department_id, month, year, section_key)
  );

  CREATE INDEX idx_uploaded_docs_lookup ON uploaded_documents(department_id, year, month, section_key);



  
  
  UPDATE section_metadata
  SET accessible_by = '["academic", "dept:MTP"]'::jsonb
  WHERE section_key = 'dept_achievements';

-- deleting sections metadata records what are not needed:

  select * from section_metadata;

    select * from monthly_reports;


    select * from USERS;
select * from DEPARTMENTS;

SELECT *
  FROM section_metadata;




SELECT *
  FROM monthly_reports
;

-- fixing reference for uploaded doc table:




  INSERT INTO users (id, name, password, role, department_id) VALUES                                                                                ('CE.ADMIN', 'CE Incharge', 'vnrvjiet', 'reports-incharge', 2),
  ('EEE.ADMIN', 'EEE Incharge', 'vnrvjiet', 'reports-incharge', 3),                                                                                 ('ME.ADMIN', 'ME Incharge', 'vnrvjiet', 'reports-incharge', 4),
  ('ECE.ADMIN', 'ECE Incharge', 'vnrvjiet', 'reports-incharge', 5),
  ('EIE.ADMIN', 'EIE Incharge', 'vnrvjiet', 'reports-incharge', 7),
  ('IT.ADMIN', 'IT Incharge', 'vnrvjiet', 'reports-incharge', 8),
  ('AE.ADMIN', 'AE Incharge', 'vnrvjiet', 'reports-incharge', 9),
  ('CSEAIML.ADMIN', 'CSE (AIML & IoT) Incharge', 'vnrvjiet', 'reports-incharge', 10),
  ('PHYSICS.ADMIN', 'Physics Incharge', 'vnrvjiet', 'reports-incharge', 12),
  ('CHEMISTRY.ADMIN', 'Chemistry Incharge', 'vnrvjiet', 'reports-incharge', 13),
  ('ENGLISH.ADMIN', 'English Incharge', 'vnrvjiet', 'reports-incharge', 14),
  ('MMS.ADMIN', 'M&MS Incharge', 'vnrvjiet', 'reports-incharge', 15);


  SELECT * FROM users ORDER BY department_id;

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  -- migrating achivement tables:
  -- Step 1: Delete old data for these sections from monthly_reports
UPDATE monthly_reports
SET report_data = report_data - 'dept_achievements'
WHERE report_data ? 'dept_achievements';

UPDATE monthly_reports
SET report_data = report_data - 'faculty_achievements'
WHERE report_data ? 'faculty_achievements';

UPDATE monthly_reports
SET report_data = report_data - 'student_achievements'
WHERE report_data ? 'student_achievements';


DELETE FROM section_metadata WHERE section_key IN ('dept_achievements', 'faculty_achievements', 'student_achievements');



-- Section 6: Institute/Department Achievements
INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    columns,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'dept_achievements',
    '6. Institute/Department Achievements:',
    'records',
    '[
        {"name": "dept", "display_name": "Department", "type": "TEXT", "required": true},
        {"name": "event", "display_name": "Event", "type": "TEXT", "required": true},
        {"name": "date_range", "display_name": "Date/Date Range", "type": "TEXT", "required": true},
        {"name": "faculty_name", "display_name": "Faculty Name", "type": "TEXT", "required": true},
        {"name": "designation", "display_name": "Designation", "type": "TEXT", "required": true},
        {"name": "description", "display_name": "Description", "type": "TEXTAREA", "required": true}
    ]'::jsonb,
    '["academic"]',
    6,
    'ADMIN'
);

-- Section 7: Faculty Achievements
INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    columns,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'faculty_achievements',
    '7. Faculty Achievements:',
    'records',
    '[
        {"name": "dept", "display_name": "Department", "type": "TEXT", "required": true},
        {"name": "event", "display_name": "Event", "type": "TEXT", "required": true},
        {"name": "duration", "display_name": "Duration", "type": "TEXT", "required": true},
        {"name": "faculty_name", "display_name": "Faculty Name", "type": "TEXT", "required": true},
        {"name": "designation", "display_name": "Designation", "type": "TEXT", "required": true},
        {"name": "description", "display_name": "Description", "type": "TEXTAREA", "required": true}
    ]'::jsonb,
    '["academic"]',
    7,
    'ADMIN'
);

-- Section 8: Students Achievements
INSERT INTO section_metadata (
    section_key,
    display_name,
    section_type,
    columns,
    accessible_by,
    display_order,
    created_by
) VALUES (
    'student_achievements',
    '8. Students Achievements:',
    'records',
    '[
        {"name": "dept", "display_name": "Department", "type": "TEXT", "required": true},
        {"name": "event", "display_name": "Event", "type": "TEXT", "required": true},
        {"name": "duration", "display_name": "Duration", "type": "TEXT", "required": true},
        {"name": "student_name", "display_name": "Student Name", "type": "TEXT", "required": true},
        {"name": "roll", "display_name": "Roll Number", "type": "TEXT", "required": true},
        {"name": "description", "display_name": "Description", "type": "TEXTAREA", "required": true}
    ]'::jsonb,
    '["academic"]',
    8,
    'ADMIN'
);

-- Verify the changes
SELECT section_key, display_name, section_type, columns
FROM section_metadata
WHERE section_key IN ('dept_achievements', 'faculty_achievements', 'student_achievements')
ORDER BY display_order;



  UPDATE section_metadata
  SET accessible_by = '["academic", "dept:MTP"]'::jsonb
  WHERE section_key = 'dept_achievements';

  
  
  
  ----
  
  UPDATE section_metadata
SET columns = '[
    {"name": "dept", "display_name": "Dept.", "type": "TEXT", "required": true},
    {"name": "title", "display_name": "Title of the Patent", "type": "TEXT", "required": true},
    {"name": "applicant", "display_name": "Name of the Applicant", "type": "TEXT", "required": true},
    {"name": "remarks", "display_name": "Remarks", "type": "SELECT", "options": ["Filed", "Published", "Granted"], "required": true}
]'::jsonb,
updated_at = NOW()
WHERE section_key = 'patents';
  

SELECT section_key, display_name, columns
FROM section_metadata
WHERE section_key = 'patents';

select * from users;

UPDATE users
  SET id = 'M_MS.ADMIN'                                                                                                                             WHERE id = 'MMS.ADMIN';
  
-- Add highlights field to MTP section metadata
UPDATE section_metadata
SET columns = jsonb_set(
    columns,
    '{-1}',
    '{"name": "highlights", "display_name": "Highlights", "type": "TEXTAREA", "required": false}'::jsonb,
    true
)
WHERE section_key = 'mtp_activities';

