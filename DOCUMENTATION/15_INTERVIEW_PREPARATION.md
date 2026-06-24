# 15 Interview Preparation

This document provides sample questions and answers based on the architecture of VNR Reports, designed to help you prepare for technical system design and full-stack interviews.

## Resume Project Summary
**VNR Reports: Enterprise Campus Automation Portal**
*Architected and developed a full-stack, serverless-ready monthly reporting portal for an educational institution using React, Node.js, Express, and PostgreSQL. Engineered a dynamic UI engine driven by JSON schemas stored in a Postgres database, allowing administrators to modify complex reporting forms without altering frontend code. Implemented Role-Based Access Control (RBAC) via JWTs and optimized read-heavy data aggregation endpoints for generating massive institutional reports in memory.*

---

## Technical Questions & Answers

### 1. "How did you handle the fact that report requirements change constantly?"

**Beginner Answer:**
"Instead of making a new table for every new report type, we used Postgres JSON fields. The frontend just reads what columns it should show from the database."

**Senior Answer (STAR Format):**
* **Situation**: The administration frequently needed to add new columns (like 'ISSN' or 'Impact Factor') to existing reports.
* **Task**: Create a system that prevents deploying new code every time a form changes.
* **Action**: I implemented a metadata-driven architecture. I designed a `section_metadata` table that stores the schema defining the UI (input types, requirements) as JSON. The actual user data is stored in a `JSONB` column in a single `monthly_reports` table. 
* **Result**: This decoupled the UI from the business requirements. Administrators can now adjust database schemas, and the React frontend instantly renders the updated form, saving hours of development time per change.

### 2. "Why did you use raw SQL instead of an ORM like Prisma or TypeORM?"

**Interview Explanation:**
"While ORMs are fantastic for rapid prototyping and standard relational data, this project heavily leverages PostgreSQL's native `JSONB` features to maintain dynamic structures. ORMs often struggle with or poorly optimize complex operations on deep JSON structures. By using the raw `pg` driver, I maintained total control over query optimization, specifically ensuring that when we query across thousands of JSON payloads, we can precisely utilize GIN indexes without ORM abstraction overhead."

### 3. "How do you handle security and authentication?"

**Interview Explanation:**
"We use a stateless JWT (JSON Web Token) approach. When a user logs in, the backend hashes the password using `bcrypt` to verify against the DB. It then issues a signed JWT containing their ID and Role. Every subsequent API call passes this token. On the Express backend, I wrote custom middleware that verifies the token's signature. Furthermore, I implemented strict RBAC (Role-Based Access Control) middlewares—like `requireAdmin`—that check the role decoded from the JWT before allowing access to sensitive endpoints like user management or global snapshot generation. To prevent brute force, we also track failed login attempts in an `account_locks` table."

### 4. "What happens if two people edit the same report at the exact same time?"

**Tradeoff Discussion:**
"Currently, the system relies on 'Last Write Wins'. Because data is structured per department per month in a single `JSONB` cell, if two users from the same department edit different rows, there is no conflict. However, if they edit the exact same cell simultaneously, the final HTTP `PUT` request overwrites the previous one. 
*Tradeoff Analysis*: I chose not to implement WebSockets for real-time collaboration (like Google Docs) because the engineering overhead and server costs were too high for a monthly reporting tool that usually has a single designated updater per department. If concurrency became a major issue, my next step would be to implement Optimistic Concurrency Control using a `version` integer column."

### 5. "How would you scale this application to support 100 institutes instead of just one?"

**Scalability Discussion:**
"This would turn the app into a multi-tenant SaaS. 
1. **Database**: I would add an `institute_id` to every core table to partition data logically. For massive scale, I would utilize Postgres Row-Level Security (RLS) to ensure data isolation at the DB engine level.
2. **Server**: The Express backend is stateless, so it scales horizontally perfectly. We would just put it behind an AWS Application Load Balancer.
3. **Background Jobs**: Generating a snapshot for 100 institutes synchronously over HTTP would time out. I would decouple the report generation into an event-driven microservice using Kafka or Redis Queues, allowing a worker pool to generate reports and notify the user when done."

## "Explain this project in 2 minutes"
"VNR Reports is a campus automation tool I built to digitize how academic departments submit their monthly activity reports. It replaces messy Excel sheets with a web dashboard. The frontend is built in React and uses a metadata-driven approach—meaning the forms are dynamically generated based on schemas stored in a PostgreSQL database. The backend is a stateless Node.js/Express API secured with JWTs. The coolest part is that because we store the actual report data as JSONB blobs in Postgres, the administration can change the form requirements at any time, and the UI adapts automatically without any code deployments."
