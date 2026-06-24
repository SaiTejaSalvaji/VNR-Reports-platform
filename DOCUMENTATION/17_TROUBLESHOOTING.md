# 17 Troubleshooting Guide

This guide covers common issues encountered during development, deployment, and daily usage of VNR Reports.

## Backend / Database Issues

### Issue 1: "Max Connections Reached" or Database Timeouts
* **Symptoms**: Backend logs show `FATAL: remaining connection slots are reserved for non-replication superuser connections` or API calls hang and timeout.
* **Cause**: Serverless functions are rapidly spinning up and opening direct connections to PostgreSQL without closing them.
* **Fix**: Ensure your `PG_CONN_STRING_PROD` points to the Neon **Pooler URL** (which usually contains `pooler` in the host string), not the direct URL. Ensure `pg.Pool` is initialized outside the request handler so it acts as a singleton per container.

### Issue 2: CORS Errors on Login
* **Symptoms**: Browser console shows "Blocked by CORS policy" when trying to log in. Network tab shows a failed OPTIONS request.
* **Cause**: The frontend URL (e.g., `http://localhost:5173`) is not listed in the `allowedOrigins` array in `app.ts`.
* **Fix**: Check `server/src/app.ts`. If in development, ensure `app.use(cors())` is active. If in production, ensure the exact origin (without trailing slashes) is in the array.

### Issue 3: Schema Changes Not Reflecting
* **Symptoms**: An admin modified the JSON schema in `section_metadata` in the DB, but the frontend table isn't showing the new column.
* **Cause**: Frontend caching or incorrect JSON syntax in the DB.
* **Fix**: 
  1. Hard refresh the frontend.
  2. Query the DB directly. If the `columns` field is invalid JSON, Postgres might have accepted it (if stored as TEXT instead of JSONB) but the frontend fails to parse it. Ensure it is valid JSON.

## Frontend Issues

### Issue 1: White Screen on Load / Infinite Spinner
* **Symptoms**: The app loads, shows a spinner, and never resolves.
* **Cause**: The `AuthContext` is trying to validate a stale or malformed JWT with the backend, and the backend is hanging or throwing an unhandled error.
* **Fix**: Clear `localStorage` via browser DevTools -> Application -> Local Storage. Refresh the page.

### Issue 2: "Unauthorized" when navigating
* **Symptoms**: User is logged in, clicks a sidebar link, and gets a 401 Unauthorized or gets booted to login.
* **Cause**: The JWT has expired, or the Axios interceptor failed to attach the token.
* **Fix**: Check the Network tab. Ensure the `Authorization: Bearer ...` header is present. Check backend `env.JWT_SECRET` to ensure it hasn't changed.

### Issue 3: Tailwind Classes Not Applying
* **Symptoms**: Added a new class like `bg-red-500` to a component, but the UI doesn't change.
* **Cause**: The Vite/Tailwind compiler didn't detect the class name, likely because it was dynamically constructed in JS (e.g., `className={"bg-" + color + "-500"}`).
* **Fix**: Tailwind cannot purge dynamically constructed strings. You must write the full class name in the file, or use a library like `clsx` or `tailwind-merge` properly.

## Deployment Issues

### Issue 1: Vercel 404 on Refresh
* **Symptoms**: App works fine when navigating via clicks, but if you refresh the page on `/editor`, Vercel returns a 404 error.
* **Cause**: Vercel is trying to find an actual file named `editor.html` on the server.
* **Fix**: Ensure `vercel.json` in the client directory contains a rewrite rule directing all traffic to `index.html`.
  ```json
  {
    "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ]
  }
  ```
