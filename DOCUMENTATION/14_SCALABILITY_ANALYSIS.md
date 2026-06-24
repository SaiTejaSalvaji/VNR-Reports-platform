# 14 Scalability Analysis

As the VNR Reports portal grows—handling more departments, years of historical data, and concurrent users (e.g., end-of-month submission deadlines)—the architecture will face new stresses.

## 1. What Breaks First at Scale?

### Bottleneck A: The Serverless Cold Start & Timeout Limit
* **Scenario**: It's the 30th of the month. The Admin requests a 5-year aggregated Snapshot Report across all 20 departments.
* **Failure**: The backend must pull massive amounts of JSONB data, parse it in Node.js, and generate a huge Excel file. Serverless functions (like Vercel API routes or Firebase) usually have strict timeouts (e.g., 10 seconds or 60 seconds). If the generation takes 65 seconds, the cloud provider will brutally kill the process, returning a 504 Gateway Timeout to the frontend.
* **Solution**: Move heavy Snapshot Generation to an asynchronous background job. 
  1. Admin clicks "Generate".
  2. API pushes a job to a Queue (Redis/Google PubSub) and returns `202 Accepted`.
  3. A dedicated Worker processes the queue, generates the file, saves it to Google Cloud Storage.
  4. The frontend polls for completion and downloads the URL.

### Bottleneck B: JSONB Bloat
* **Scenario**: Over 5 years, the `monthly_reports` table accumulates thousands of rows. Each row's `report_data` JSONB payload becomes megabytes in size due to rich-text data and hundreds of records.
* **Failure**: Simple queries fetching the report to render the UI become slow because Postgres has to pull massive JSON payloads from the disk into memory just to return one small section.
* **Solution**: Vertical partitioning or sharding. We might need to break `report_data` down so that each section (Publications, Events) has its own JSONB row rather than one massive blob per department/month.

### Bottleneck C: Concurrent Writes (Race Conditions)
* **Scenario**: Two faculty members in the CSE department edit the "Publications" table at the exact same millisecond.
* **Failure**: Because the backend does a `JSONB` merge/overwrite, User B's save might overwrite User A's save if they fetched the initial state at the same time.
* **Solution**: Implement Optimistic Concurrency Control (Version tracking). Add a `version` integer to the `monthly_reports` table. When the frontend saves, it sends the version. If the DB version is higher than the frontend's version, the API rejects it with a `409 Conflict`, forcing the user to refresh and merge.

## 2. Horizontal vs. Vertical Scaling

### Horizontal Scaling (Scaling Out)
The current architecture is highly conducive to Horizontal Scaling.
* Because the Express backend is **stateless** and uses JWTs, we can spin up 10,000 instances of the backend API behind a load balancer, and they will all function perfectly.
* **Limitation**: The database connections. We must use a robust Pooler (PgBouncer) to ensure the 10,000 instances don't crash Postgres by asking for 10,000 simultaneous TCP connections.

### Vertical Scaling (Scaling Up)
* Upgrading the Neon PostgreSQL instance to have more RAM and CPU. This is the easiest first step if database queries become sluggish.

## 3. Caching Strategy
Currently, there is no Redis or Memcached layer.
* **Improvement**: Cache the `section_metadata` (Schema) queries. The schema rarely changes, but it is fetched constantly. Storing this in an in-memory cache on the backend would instantly remove a large percentage of database load.
