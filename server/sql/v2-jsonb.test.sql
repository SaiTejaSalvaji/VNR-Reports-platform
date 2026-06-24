-- testing jsonb
create table products (id serial primary key, name text, specs jsonb);

insert into products (name,specs) values ('laptop','{"brand":"Apple","cpu":"M4","tags":["work","tech"]}'),('Phone', '{"brand": "Samsung", "color": "Blue", "tags": ["mobile"]}');;


select specs->'tags' from products;

select * from products;


-- searching using containment operator , meaning, does the json on left contain the json on right
select * from products where specs->>'brand' = 'Apple';

select * from products where specs->'tags' @> '["work"]';

-- existence operator

select * from products where not specs->'tags' ? 'tech';

drop table products;


select tablename from pg_tables where schemaname= 'public';

-- end of testing jsonb