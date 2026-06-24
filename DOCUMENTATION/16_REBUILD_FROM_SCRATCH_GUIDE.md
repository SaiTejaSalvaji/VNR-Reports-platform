# 16 Rebuild from Scratch Guide

If you lose this codebase or want to rebuild a system with the exact same architecture, follow these steps in order.

## 1. Architecture Planning & Stack Selection
* **Frontend**: React (Vite) for fast HMR. Tailwind CSS for rapid styling without massive stylesheet files. React Router for SPA navigation. Context API for lightweight global state.
* **Backend**: Node.js + Express for a fast, RESTful API. `pg` driver for raw SQL.
* **Database**: PostgreSQL (specifically for its superior `JSONB` capabilities, which are essential for the dynamic forms).

## 2. Setup Sequence

1. **Initialize the Monorepo**:
   ```bash
   mkdir vnr-reports && cd vnr-reports
   npx create-vite client --template react-ts
   mkdir server && cd server
   npm init -y
   npm i express cors pg dotenv jsonwebtoken bcryptjs
   npm i -D typescript @types/express @types/node ts-node nodemon
   npx tsc --init
   ```

2. **Configure TypeScript**: Ensure `server/tsconfig.json` outputs to a `dist/` folder and resolves modules correctly.

## 3. Implementation Order

### Phase 1: Database & Core Models
1. Spin up a local Postgres instance or a Neon DB.
2. Create the `departments` and `users` tables.
3. Create the `section_metadata` table (id, key, columns as JSONB).
4. Create the `monthly_reports` table (dept_id, month, year, data as JSONB).
5. Insert test data (1 admin user, 1 faculty user).

### Phase 2: Backend Authentication
1. Build `POST /auth/login`. Verify password with `bcrypt`.
2. Sign a JWT and return it.
3. Write `auth.middleware.ts` to extract the `Bearer Token` from headers and attach `req.user`.

### Phase 3: Frontend Scaffolding & Auth
1. Setup React Router in `App.tsx` with a Login route and a protected Dashboard route.
2. Build `AuthContext` to store the JWT in `localStorage` and provide it to the app.
3. Setup an Axios interceptor to automatically attach the token to all requests.

### Phase 4: The Dynamic Engine (The Hard Part)
1. **Backend**: Write `GET /sections/schema` that returns the `columns` array from `section_metadata`.
2. **Backend**: Write `GET /tables/rows` that pulls the JSONB data for a specific month.
3. **Frontend**: Build `ReportEditor.tsx`.
   * State 1: Fetch Schema.
   * State 2: Fetch Data.
   * Render a table. Iterate over the Schema array to create table headers. Iterate over Data array to create table rows.
4. **Backend**: Write `POST /tables/rows` that performs an `INSERT ... ON CONFLICT DO UPDATE` (or merge) into the JSONB column.

### Phase 5: Snapshot Generation
1. Build an admin view on the frontend to select a month.
2. Write a backend endpoint that pulls *all* `monthly_reports` for that month.
3. Use a library like `exceljs` to parse the JSONB trees and format them into spreadsheet rows.
4. Stream the spreadsheet back to the frontend.

## 4. Production Hardening
* Wrap all async Express routes in `express-async-handler` to prevent unhandled promise crashes.
* Implement a Global Error Handler middleware to catch those crashes and return a clean 500 JSON.
* Ensure CORS is locked down to only your production frontend URL.
* Move from standard connection strings to PgBouncer/Pooler URLs if deploying to Serverless (Vercel/Firebase).
