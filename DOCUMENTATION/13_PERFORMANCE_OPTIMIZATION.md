# 13 Performance Optimization

This document outlines the strategies used to ensure VNR Reports remains fast and responsive, even when dealing with massive datasets (like end-of-year global snapshots).

## Frontend Optimizations

### 1. Route-Based Code Splitting
* **Implementation**: Uses `React.lazy()` and `<Suspense>` in `App.tsx`.
* **Impact**: The initial JavaScript bundle downloaded by the user is tiny. The heavy code for the `ReportEditor` or the complex charting library (`recharts` in `AdminStats`) is only downloaded when the user actually navigates to those pages.

### 2. Component Memoization
* Dynamic tables can contain hundreds of input cells.
* If a parent component re-renders, React by default re-renders all children. By utilizing `React.memo` or careful state placement, the app ensures that typing into one cell doesn't cause the entire massive table to re-render.

### 3. Tailwind CSS Purging
* Tailwind generates a massive CSS file in development.
* During the Vite `build` step, Tailwind scans all `.tsx` files and purges any CSS classes that are not explicitly used, resulting in a production CSS file that is often less than 20kb.

## Backend Optimizations

### 1. Database Indexing
The most critical performance layer.
* **B-Tree Indices**: The `monthly_reports` table has a composite index: `CREATE INDEX idx_monthly_reports_lookup ON monthly_reports(department_id, year, month)`. This turns the most frequent query (fetching a month's report) from a full table scan (O(N)) into an incredibly fast O(log N) lookup.
* **GIN Indices**: The `report_data` column uses `USING GIN (report_data)`. If the backend ever needs to search *inside* the JSON payload (e.g., finding all papers by "Dr. Smith"), a Generalized Inverted Index (GIN) makes JSON key-value queries dramatically faster than sequential scanning.

### 2. Memory-Efficient File Generation
When generating the Excel or Word snapshot, the backend gathers data from all departments.
* **Problem**: Generating a massive Excel file on disk might fail in Serverless environments (which have limited, ephemeral `/tmp` space).
* **Optimization**: The backend uses libraries (`exceljs`, `docx`) to generate the file as a Stream or Buffer entirely in RAM, and immediately pipes it to the Express HTTP Response. This avoids disk I/O entirely.

### 3. Connection Pooling
* As mentioned in Deployment, utilizing Neon's PgBouncer Pooler ensures that rapid, simultaneous requests from different Serverless functions share database connections efficiently, preventing connection timeouts.

## Future Performance Considerations
1. **Frontend Data Caching**: Implementing `React Query` (TanStack Query) would allow the frontend to cache table data. If a user flips between "January" and "February", React Query would serve January from cache instantly without hitting the backend again.
2. **Pagination**: Currently, sections render all rows at once. If a department adds 500 publications in a single month, the DOM will become heavy. Implementing virtualized lists (like `react-window`) or backend pagination would solve this.
