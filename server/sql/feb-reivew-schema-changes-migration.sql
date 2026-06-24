-- feb review - db schema changes


-- delete 14 and rename 16
 UPDATE monthly_reports                                                                                                                             
  SET report_data = report_data - 'ongoing_projects'                                                                                                 
  WHERE report_data ? 'ongoing_projects';

  DELETE FROM section_metadata WHERE section_key = 'ongoing_projects';
  
   SELECT section_key, display_name FROM section_metadata WHERE section_key = 'ongoing_projects';
   
   
   
   UPDATE section_metadata  
  SET display_name = '16. Applied/Sanctioned Consultancy Projects',
      updated_at = NOW()     
   WHERE section_key = 'consultancy_projects';
   
   
    SELECT section_key, display_name FROM section_metadata WHERE section_key = 'consultancy_projects';       


    
    
     UPDATE monthly_reports
  SET report_data = jsonb_set(
      report_data,
      '{dept_achievements}',
      (
          SELECT jsonb_agg(
              jsonb_build_object(
                  'faculty_info',
                      TRIM(
                          COALESCE(elem->>'faculty_name', '') ||
                          CASE WHEN (elem->>'designation') IS NOT NULL AND (elem->>'designation') != ''
                               THEN ', ' || (elem->>'designation') ELSE '' END ||
                          CASE WHEN (elem->>'dept') IS NOT NULL AND (elem->>'dept') != ''
                               THEN ', ' || (elem->>'dept') ELSE '' END
                      ),
                  'event',       COALESCE(elem->>'event', ''),
                  'date',        COALESCE(elem->>'date_range', ''),
                  'description', COALESCE(elem->>'description', '')
              )
          )
          FROM jsonb_array_elements(report_data->'dept_achievements') AS elem
      )
  )
  WHERE report_data ? 'dept_achievements'
    AND jsonb_array_length(report_data->'dept_achievements') > 0;
    
 
      UPDATE section_metadata
  SET columns = '[
      {"name": "faculty_info",  "display_name": "Faculty Name, Designation & Dept", "type": "TEXTAREA", "required": true},
      {"name": "event",         "display_name": "Event",                            "type": "TEXT",     "required": true},
      {"name": "date",          "display_name": "Date",                             "type": "TEXT",     "required": true},
      {"name": "description",   "display_name": "Brief Description",                "type": "TEXTAREA", "required": true}
  ]'::jsonb,
  updated_at = NOW()
  WHERE section_key = 'dept_achievements';
      
      
        SELECT section_key, columns FROM section_metadata WHERE section_key = 'dept_achievements';
        
        
        
        
        UPDATE monthly_reports                                                                                                                               SET report_data = jsonb_set(                                                                                                                       
      report_data,
      '{faculty_achievements}',
      (
          SELECT jsonb_agg(
              jsonb_build_object(
                  'faculty_info',
                      TRIM(
                          COALESCE(elem->>'faculty_name', '') ||
                          CASE WHEN (elem->>'designation') IS NOT NULL AND (elem->>'designation') != ''
                               THEN ', ' || (elem->>'designation') ELSE '' END ||
                          CASE WHEN (elem->>'dept') IS NOT NULL AND (elem->>'dept') != ''
                               THEN ', ' || (elem->>'dept') ELSE '' END
                      ),
                  'event',       COALESCE(elem->>'event', ''),
                  'date',        COALESCE(elem->>'duration', ''),
                  'description', COALESCE(elem->>'description', '')
              )
          )
          FROM jsonb_array_elements(report_data->'faculty_achievements') AS elem
      )
  )
  WHERE report_data ? 'faculty_achievements'
    AND jsonb_array_length(report_data->'faculty_achievements') > 0;
        
        
        
        
        
        
          UPDATE section_metadata
  SET display_name = '7. Faculty Major Achievements:',
      columns = '[
      {"name": "faculty_info",  "display_name": "Faculty Name, Designation & Dept", "type": "TEXTAREA", "required": true},
      {"name": "event",         "display_name": "Event",                            "type": "TEXT",     "required": true},
      {"name": "date",          "display_name": "Date",                             "type": "TEXT",     "required": true},
      {"name": "description",   "display_name": "Brief Description",                "type": "TEXTAREA", "required": true}
  ]'::jsonb,
      updated_at = NOW()
  WHERE section_key = 'faculty_achievements';
          
          
          
SELECT section_key, display_name, columns FROM section_metadata WHERE section_key = 'faculty_achievements';
          
          
          
          
          
          
                                                                                                                            
  UPDATE monthly_reports                                                                                                                             
  SET report_data = jsonb_set(
      report_data,
      '{student_achievements}',
      (
          SELECT jsonb_agg(
              jsonb_build_object(
                  'student_info',
                      TRIM(
                          COALESCE(elem->>'student_name', '') ||
                          CASE WHEN (elem->>'dept') IS NOT NULL AND (elem->>'dept') != ''
                               THEN ', ' || (elem->>'dept') ELSE '' END ||
                          CASE WHEN (elem->>'roll') IS NOT NULL AND (elem->>'roll') != ''
                               THEN ', ' || (elem->>'roll') ELSE '' END
                      ),
                  'event',       COALESCE(elem->>'event', ''),
                  'date',        COALESCE(elem->>'duration', ''),
                  'description', COALESCE(elem->>'description', '')
              )
          )
          FROM jsonb_array_elements(report_data->'student_achievements') AS elem
      )
  )
  WHERE report_data ? 'student_achievements'
    AND jsonb_array_length(report_data->'student_achievements') > 0;
  
  
  
  
  UPDATE section_metadata
  SET display_name = '8. Students Major Achievements:',
      columns = '[
      {"name": "student_info",  "display_name": "Student Name, Branch & Roll No.", "type": "TEXTAREA", "required": true},
      {"name": "event",         "display_name": "Event",                           "type": "TEXT",     "required": true},
      {"name": "date",          "display_name": "Date",                            "type": "TEXT",     "required": true},
      {"name": "description",   "display_name": "Brief Description",               "type": "TEXTAREA", "required": true}
  ]'::jsonb,
      updated_at = NOW()
  WHERE section_key = 'student_achievem
ents';
  
  
    -- Verify
  SELECT section_key, display_name, columns FROM section_metadata WHERE section_key = 'student_achievements';
    
     UPDATE monthly_reports
  SET report_data = jsonb_set(                                                                                                                       
      report_data,                                                                                                                                   
      '{student_achievements}',
      (
          SELECT jsonb_agg(
              jsonb_build_object(
                  'student_info',
                      TRIM(
                          COALESCE(elem->>'student_name', '') ||
                          CASE WHEN (elem->>'dept') IS NOT NULL AND (elem->>'dept') != ''
                               THEN ', ' || (elem->>'dept') ELSE '' END ||
                          CASE WHEN (elem->>'roll') IS NOT NULL AND (elem->>'roll') != ''
                               THEN ', ' || (elem->>'roll') ELSE '' END
                      ),
                  'event',       COALESCE(elem->>'event', ''),
                  'date',        COALESCE(elem->>'duration', ''),
                  'description', COALESCE(elem->>'description', '')
              )
          )
          FROM jsonb_array_elements(report_data->'student_achievements') AS elem
      )
  )
  WHERE report_data ? 'student_achievements'
    AND jsonb_array_length(report_data->'student_achievements') > 0;

 
  UPDATE section_metadata
  SET display_name = '8. Students Major Achievements:',
      columns = '[
      {"name": "student_info",  "display_name": "Student Name, Branch & Roll No.", "type": "TEXTAREA", "required": true},
      {"name": "event",         "display_name": "Event",                           "type": "TEXT",     "required": true},
      {"name": "date",          "display_name": "Date",                            "type": "TEXT",     "required": true},
      {"name": "description",   "display_name": "Brief Description",               "type": "TEXTAREA", "required": true}
  ]'::jsonb,
      updated_at = NOW()
  WHERE section_key = 'student_achievements';

    
UPDATE section_metadata
  SET display_name = '6. Institute/Department Major Achievements:',
      updated_at = NOW()                                                                                                                               WHERE section_key = 'dept_achievements';
  

  SELECT section_key, display_name FROM section_metadata WHERE section_key = 'dept_achievements';
  
  UPDATE section_metadata SET display_order = 14, display_name = '14. Project Proposals submitted:',                        updated_at = NOW() WHERE 
  section_key = 'project_proposals';
  UPDATE section_metadata SET display_order = 15, display_name = '15. Applied/Sanctioned Consultancy Projects',             updated_at = NOW() WHERE 
  section_key = 'consultancy_projects';
  UPDATE section_metadata SET display_order = 16, display_name = '16. PATENTS FILED/PUBLISHED/GRANTED:',                   updated_at = NOW() WHERE  
  section_key = 'patents';
  UPDATE section_metadata SET display_order = 17, display_name = '17. CENTRAL LIBRARY INFORMATION & RESOURCE CENTRE:',     updated_at = NOW() WHERE  
  section_key = 'library_info';
  UPDATE section_metadata SET display_order = 18, display_name = '18. Placement Activities:',                              updated_at = NOW() WHERE  
  section_key = 'mtp_activities';
  UPDATE section_metadata SET display_order = 20, display_name = '20. Alumni:',                                            updated_at = NOW() WHERE  
  section_key = 'alumni_activities';
  UPDATE section_metadata SET display_order = 21, display_name = '21. ED Cell Activities:',                                updated_at = NOW() WHERE  
  section_key = 'ed_cell_activities';
  UPDATE section_metadata SET display_order = 22, display_name = '22. Research & Development Cell:',                       updated_at = NOW() WHERE  
  section_key = 'rdc_activities';
  
  
  SELECT section_key, display_name, display_order FROM section_metadata ORDER BY display_order;
  
  
