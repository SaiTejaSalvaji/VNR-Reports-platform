
-- db schema changes

select display_order,display_name,section_key from section_metadata order by display_order;


select * from section_metadata order by display_order;



select * from section_metadata where section_key  = 'conference_papers';




select * from section_metadata where section_key  = 'snapshot_review_points';




select * from section_config;
	

select * from monthly_reports where id = 393;

select * from departments;

select * from users;


