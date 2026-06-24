# 00 Project Overview

## What the Project Does
The **VNR Reports (Institute Monthly Report Portal)** is a comprehensive campus automation tool designed for VNRVJIET to streamline the submission, management, and tracking of monthly faculty and department reports. It transitions the institution from manual, disjointed report collection (like Excel or paper) to a centralized, digital, role-based platform.

## Business Purpose
To ensure accurate, timely, and organized data collection for academic and administrative reporting. It empowers faculty to submit activity reports, gives Heads of Departments (HODs) and Reports-Incharges the ability to review and consolidate these reports, and provides Admins with global analytics and data snapshots.

## Target Users & Roles
1. **Faculty**: The primary data entry users. They fill out their monthly activities in dynamic tables.
2. **HOD (Head of Department)**: Oversees department-level reports, reviews faculty submissions, and manages users within their department.
3. **Reports-Incharge**: Similar to HODs, they are delegated to handle department report aggregation.
4. **Admin**: Has global visibility. Can view analytics across all departments, generate global snapshots, and manage system-wide settings.

## Core Workflows
1. **Authentication & Authorization**: Users login using their credentials, and the system routes them to the appropriate dashboard based on their role (e.g., Faculty go to Editor, Admins go to Stats).
2. **Dynamic Report Data Entry**: Users enter data into dynamically generated tables and rich-text sections corresponding to specific report categories.
3. **Snapshot Generation**: Admins and HODs can generate comprehensive report snapshots (often consolidating data across date ranges or departments).
4. **Bulk Uploads**: Admins/HODs can upload users in bulk via CSV/Excel.

## Tech Stack
* **Frontend**: React 19 (via Vite), TypeScript, Tailwind CSS, React Router DOM, Recharts (analytics), Tiptap (rich text editor), Radix UI.
* **Backend**: Node.js, Express.js, TypeScript.
* **Database**: PostgreSQL (hosted on Neon Database).
* **Storage**: Google Cloud Storage (via Firebase Admin SDK) for handling file uploads/report documents.
* **Deployment**: Configured for Vercel / Firebase Functions (Serverless).

---

## Explanations for Different Audiences

### "Explain Like I'm 5"
Imagine a giant school where every teacher needs to write down what they did every month—like which classes they taught or which events they went to. Instead of everyone writing it on different pieces of paper and the principal trying to read all of them, they use this website. Everyone logs in, types in their stuff into neat boxes, and the principal can just click a button to see a beautiful summary of everything!

### "Intermediate Engineer Explanation"
This is a standard MERN-like stack but using PostgreSQL instead of MongoDB. The frontend is a React Single Page Application (SPA) bundled with Vite, using Tailwind for styling and React Router for navigation. It makes RESTful HTTP calls via Axios to an Express.js backend. The backend handles role-based access control (RBAC) via JWTs, talks to a Postgres DB (using pg) to store structured report data and user info, and interacts with Google Cloud Storage to save files. 

### "Senior Engineer Explanation"
The architecture is a decoupled client-server model built for serverless deployment. The client is a heavily componentized React application leveraging Context API for state (Auth, Sidebar, Date filters) and lazy loading for route-based code splitting to optimize performance. The backend is a stateless Express REST API applying standard middleware patterns (request logging, CORS, error boundaries, auth guards). Database interactions are raw SQL over the `pg` driver to a Neon Postgres instance, heavily utilizing `JSONB` columns for dynamic table row structures to avoid schema migrations every time a report format changes.

### "Interview Explanation"
"In this project, I architected a role-based reporting system for an educational institute. I chose React and Vite for a fast, modern frontend, and Express with PostgreSQL for the backend. A key engineering decision was how to handle dynamic report formats: instead of creating heavily normalized, fragile SQL tables for every new report type, I leveraged PostgreSQL's `JSONB` capabilities to store dynamic row data while keeping metadata strongly typed. I also implemented a robust RBAC middleware to securely separate Faculty, HOD, and Admin routes, and integrated Google Cloud Storage for handling large document uploads securely without bloating the database."
