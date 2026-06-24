
  UPDATE section_metadata
  SET display_order = display_order + 2
  WHERE section_key IN (
      'industrial_visits',    -- 13 → 15
      'project_proposals',    -- 14 → 16
      'consultancy_projects', -- 15 → 17
      'patents',              -- 16 → 18
      'library_info',         -- 17 → 19
      'mtp_activities',       -- 18 → 20
      'alumni_activities',    -- 20 → 22
      'ed_cell_activities',   -- 21 → 23
      'rdc_activities'        -- 22 → 24
  );

  
  

  UPDATE section_metadata SET display_name = '15. Industrial Visits/ THUB/WeHUB/MSME etc. :'
  WHERE section_key = 'industrial_visits';

  UPDATE section_metadata SET display_name = '16. Project Proposals submitted:'
  WHERE section_key = 'project_proposals';

  UPDATE section_metadata SET display_name = '17. Applied/Sanctioned Consultancy Projects'
  WHERE section_key = 'consultancy_projects';

  UPDATE section_metadata SET display_name = '18. PATENTS FILED/PUBLISHED/GRANTED:'
  WHERE section_key = 'patents';

  UPDATE section_metadata SET display_name = '19. CENTRAL LIBRARY INFORMATION & RESOURCE CENTRE:'
  WHERE section_key = 'library_info';

  UPDATE section_metadata SET display_name = '20. Placement Activities:'
  WHERE section_key = 'mtp_activities';

  UPDATE section_metadata SET display_name = '22. Alumni:'
  WHERE section_key = 'alumni_activities';

  UPDATE section_metadata SET display_name = '23. ED Cell Activities:'
  WHERE section_key = 'ed_cell_activities';

  UPDATE section_metadata SET display_name = '24. Research & Development Cell:'
  WHERE section_key = 'rdc_activities';
  
  
  
  
    INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
  VALUES (
      'prof_societies',
      '13. Professional Societies / Student Clubs Activities Organized:',
      'records',
      '[
          {"name": "society_name", "display_name": "Name of the Professional Society", "type": "TEXT", "required": true},
          {"name": "nature", "display_name": "Nature of Event Conducted", "type": "TEXTAREA", "required": true},
          {"name": "dates", "display_name": "Dates on which the Event was Held", "type": "TEXT", "required": true},
          {"name": "topic", "display_name": "Topic", "type": "TEXT", "required": true},
          {"name": "participants_count", "display_name": "No. of Participants", "type": "NUMBER"},
          {"name": "impact", "display_name": "Impact", "type": "TEXTAREA"}
      ]'::jsonb,
      '["academic"]',
      13,
      'ADMIN'
  );

    
      INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
  VALUES (
      'certificate_courses',
      '14. Certificate Courses Conducted:',
      'records',
      '[
          {"name": "title", "display_name": "Title of Certificate Course", "type": "TEXT", "required": true},
          {"name": "prerequisite", "display_name": "Pre-requisite", "type": "TEXT"},
          {"name": "benefits", "display_name": "Benefits", "type": "TEXTAREA"},
          {"name": "targeted_students", "display_name": "Targeted Students", "type": "TEXT"},
          {"name": "dates_duration", "display_name": "Dates & Duration of the Course (no. of days)", "type": "TEXT", "required": true},
          {"name": "course_fee", "display_name": "Course Fee (Rs.)", "type": "TEXT"},
          {"name": "participants_certified", "display_name": "No. of Participants to whom Certificate Issued", "type": "NUMBER"}
      ]'::jsonb,
      '["academic"]',
      14,
      'ADMIN'
  );

      
      
      
        INSERT INTO section_metadata (section_key, display_name, section_type, columns, accessible_by, display_order, created_by)
  VALUES (
      'book_chapters',
      '21. Book Chapters / Books Published:',
      'records',
      '[
          {"name": "faculty_info", "display_name": "Faculty Name, Designation & Dept", "type": "TEXTAREA", "required": true},
          {"name": "authors", "display_name": "List of Authors in the order that appears on the paper", "type": "TEXTAREA", "required": true},
          {"name": "title", "display_name": "Full Title of the Paper / Book Chapter", "type": "TEXTAREA", "required": true},
          {"name": "publisher", "display_name": "Publisher", "type": "TEXT"},
          {"name": "vol_isbn", "display_name": "Volume, Proceeding Nos. / ISBN", "type": "TEXT"},
          {"name": "date", "display_name": "Date / Month & Year of Publication", "type": "TEXT", "required": true},
          {"name": "index", "display_name": "Indexed", "type": "TEXT"}
      ]'::jsonb,
      '["academic"]',
      21,
      'ADMIN'
  );

    
  SELECT display_order, section_key, display_name
  FROM section_metadata
  WHERE display_order < 100
  ORDER BY display_order;

