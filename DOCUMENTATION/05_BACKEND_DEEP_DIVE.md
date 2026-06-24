# 05 Backend Deep Dive

The backend of VNR Reports is an Express.js application written in TypeScript. It is designed to be completely stateless, allowing it to scale effortlessly in a serverless environment (like Firebase Functions or Vercel) while interacting with a remote PostgreSQL database on Neon.

## Core Concepts & Lifecycle

### 1. The `app.ts` Paradigm
Unlike traditional Node.js apps where `app.listen()` is called directly inside the main application file, `app.ts` only configures middleware and routes, and exports the `app` object.
* **Why?** This decoupling allows `index.ts` to attach the server to a local port for development (`npm run dev`), while `firebaseIndex.ts` wraps the `app` object using `functions.https.onRequest(app)` for Google Cloud deployment, without modifying the core logic.

### 2. Middleware Chain
The Express pipeline is structured strictly:
1. **CORS Middleware**: Defines which origins are allowed.
2. **Body Parsers**: `express.json()` and `express.urlencoded()`.
3. **Request Logger Middleware**: Intercepts `res.on('finish')` to log the exact execution time, HTTP status, and User ID.
4. **Maintenance Mode Middleware**: Blocks requests with a 503 if `env.MAINTENANCE_MODE` is true.
5. **Static Routing**: `express.static('public')`.
6. **Business Routes**: `/auth`, `/tables`, `/reports`, etc.
7. **Global Error Handler**: Catches any unhandled errors from routes to prevent server crashes, returning standard 500 JSON payloads.

### 3. Controller Pattern (`express-async-handler`)
Every route uses `express-async-handler`. 
```typescript
authRouter.post('/login', expressAsyncHandler(async (req, res) => {
    await authController.login(req, res);
}));
```
**Why?** In Express 4.x/5.x, unhandled promise rejections within async route handlers do not automatically propagate to the global error middleware, which can lead to hanging requests. `express-async-handler` wraps the execution and passes `catch(err)` directly to `next(err)`.

## Deep Dive: Complex Endpoints

### Snapshot Generation (`reports.controller.ts`)
The Snapshot Generation is the most compute-heavy endpoint in the application.
1. **Request Validation**: Ensures the requesting user is an Admin or HOD.
2. **Data Aggregation**: Queries the `monthly_reports` table joining with `departments`.
3. **Parsing JSONB**: Because report data is stored as `JSONB`, the Node backend parses the massive JSON tree.
4. **Mapping to Files**: The application uses `exceljs` and `docx` to procedurally generate documents in memory (RAM).
5. **Streaming vs Blobs**: Instead of saving the file to disk (which is restricted in Serverless environments), the backend converts the workbook to a Buffer and pipes it directly into the Express `res` object with `Content-Disposition: attachment`.

### File Uploads (`document.route.ts`)
For reports that require actual file attachments (like Word docs for MTPs):
1. **Multer Middleware**: Used temporarily to parse `multipart/form-data` and store the file in memory buffer (`multer.memoryStorage()`).
2. **GCS Upload**: The buffer is piped to Google Cloud Storage using `@google-cloud/storage`.
3. **DB Reference**: A record is created in the `uploaded_documents` table with the GCS URL, associating it with a specific department and month.

## Performance Bottlenecks & Tradeoffs
* **JSONB Processing**: The backend bears the brunt of processing JSONB fields during report generation. In very high-volume scenarios, doing heavy data mapping in Node.js instead of via SQL functions can lock the event loop.
* **Connection Pooling**: Since the app is designed for serverless, `pg` connection pooling must be carefully managed. If a serverless function spins up 1000 concurrent instances, it could exhaust the Neon Postgres connection limit. The `env.PG_CONN_STRING_PROD` points to a Pooler URL provided by Neon to mitigate this.
