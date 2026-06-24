-- DEPARTMENTS TABLE -> always use CASCADE
CREATE TABLE departments (
  department TEXT PRIMARY key,
  password TEXT NOT NULL
);

-- faculty stats TABLE
CREATE TABLE public. (
  id SERIAL PRIMARY KEY,
  department TEXT NOT NULL REFERENCES public.users(department)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12), -- 1 = Jan, 12 = Dec
  year INTEGER NOT NULL CHECK (year >= 2000), -- or another lower bound
  faculty_joined INTEGER NOT NULL,
  faculty_left INTEGER NOT NULL,
  faculty_required INTEGER NOT NULL,
  faculty_promoted INTEGER NOT NULL,
  total_faculty INTEGER NOT NULL,
  phd_awarded INTEGER NOT NULL,
  faculty_with_phd INTEGER NOT NULL,
  faculty_without_phd INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Department Events TABLE
CREATE TABLE public.department_events (
  id SERIAL PRIMARY KEY,
  department TEXT NOT NULL REFERENCES public.users(department)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2000),
  conference INTEGER NOT NULL DEFAULT 0,
  fdp INTEGER NOT NULL DEFAULT 0,
  workshop INTEGER NOT NULL DEFAULT 0,
  seminar_webinar INTEGER NOT NULL DEFAULT 0,
  guest_lecture INTEGER NOT NULL DEFAULT 0,
  others INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Faculty Research Papers Table
CREATE TABLE public.faculty_research_papers (
  id SERIAL PRIMARY KEY,
  faculty_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  department TEXT NOT NULL REFERENCES public.users(department)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12), -- 1=Jan ... 12=Dec
  year INTEGER NOT NULL CHECK (year >= 2000),             -- to allow reports

  authors TEXT[] NOT NULL,
  paper_title TEXT NOT NULL,

  conference_name TEXT NOT NULL,
  organizing_institution TEXT NOT NULL,

  proceeding_details TEXT,
  presentation_date DATE NOT NULL,


  indexed_in TEXT CHECK (
    indexed_in IN ('SCOPUS', 'Web of Science', 'Google Scholar', 'Others')
  ) NOT NULL,

  recorded_at TIMESTAMPTZ DEFAULT now()
);


