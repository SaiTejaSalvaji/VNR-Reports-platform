# 03 Setup and Installation

This guide explains how to get the VNR Reports application running on your local machine from scratch.

## Prerequisites

Before starting, ensure you have the following installed:
1. **Node.js**: Version 20 or higher recommended.
2. **npm**: Comes with Node.js.
3. **Git**: For version control.
4. **PostgreSQL**: Either running locally or a cloud instance (like Neon).

---

## 1. Environment Configuration

You will need `.env` files for both the frontend and backend.

### Backend (`server/.env`)
Create a `.env` file in the `server` directory. Look at `server/src/configs/env.config.ts` for expected values.
```env
IS_DEV_DB=true
PORT=3000
JWT_SECRET=your_super_secret_jwt_key
PG_CONN_STRING_DEV=postgresql://user:password@localhost:5432/vnrreports
# If using Firebase Storage:
GCS_PROJECT_ID=your_project_id
GCS_CLIENT_EMAIL=your_service_account_email
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GCS_BUCKET_NAME=your_bucket_name
```

### Frontend (`client/.env`)
Create a `.env` file in the `client` directory.
```env
VITE_API_URL=http://localhost:3000
```
*(Vite requires environment variables to be prefixed with `VITE_` to expose them to the browser).*

---

## 2. Database Initialization

Since the project uses raw SQL and Postgres, you must execute the schema scripts manually to initialize the database.

1. Connect to your PostgreSQL instance using `psql`, pgAdmin, or DBeaver.
2. Create the database: `CREATE DATABASE vnrreports;`
3. Navigate to `server/sql/`.
4. Execute the latest schema script. You should execute `v2-schema-jsonb-final-implementation.sql` or the equivalent latest version.
5. Create a default admin user by manually inserting a record into the `users` table with an encrypted password (or use the backend API if there is a bootstrap route).

---

## 3. Installing Dependencies

You can install dependencies for both client and server simultaneously if you are in the root directory.

```bash
# Navigate to client and install
cd client
npm install

# Navigate to server and install
cd ../server
npm install
```

---

## 4. Running the Application Locally

The project uses `concurrently` (defined in the root or client package.json) to run both servers.

### Method 1: Running together
From the `client` directory (or root if configured):
```bash
npm run dev:all
```
*This starts the Vite dev server and the Node/Nodemon backend simultaneously.*

### Method 2: Running separately (Recommended for debugging)

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```
*Server runs on `http://localhost:3000`*

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 5. Verification

1. Open your browser and navigate to `http://localhost:5173`.
2. You should see the login screen.
3. Check the network tab in developer tools to ensure requests to `http://localhost:3000/auth/login` are succeeding (or returning expected 401s if credentials are wrong, not 500s or CORS errors).

## Troubleshooting Setup

* **CORS Errors**: Ensure the backend `app.ts` CORS configuration allows `http://localhost:5173`.
* **DB Connection Refused**: Verify your PostgreSQL service is running and the `PG_CONN_STRING_DEV` is perfectly accurate.
* **JWT Errors**: Ensure `JWT_SECRET` is defined in the backend `.env`.
