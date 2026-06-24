# Hono Migration Guide — vnr-reports backend

## What is Hono

Hono is a lightweight web framework like Express, but runs on any JS runtime —
Node.js, Cloudflare Workers, Vercel, Firebase Functions, Deno, Bun.
Same app code, different entry point per platform.

Official docs: https://hono.dev

---

## 1. Core Concepts to Learn First

### 1.1 App & Routing

Express way:
```ts
import express from 'express'
const app = express()
app.get('/users', (req, res) => res.json({ users: [] }))
```

Hono way:
```ts
import { Hono } from 'hono'
const app = new Hono()
app.get('/users', (c) => c.json({ users: [] }))
```

Key difference: instead of `(req, res)` you get a single `c` (Context) object.

| Express        | Hono                        |
|----------------|-----------------------------|
| `req.body`     | `await c.req.json()`        |
| `req.params.id`| `c.req.param('id')`         |
| `req.query.month` | `c.req.query('month')`   |
| `req.headers.authorization` | `c.req.header('authorization')` |
| `res.json(data)` | `return c.json(data)`     |
| `res.status(400).json(data)` | `return c.json(data, 400)` |
| `res.status(201).json(data)` | `return c.json(data, 201)` |

**Learn:** https://hono.dev/docs/api/context

---

### 1.2 Router (sub-routing)

Express way:
```ts
const router = Router()
router.get('/login', handler)
app.use('/auth', router)
```

Hono way:
```ts
const auth = new Hono()
auth.get('/login', handler)
app.route('/auth', auth)
```

Almost identical. Just `new Hono()` instead of `Router()`, and `app.route()` instead of `app.use()`.

**Learn:** https://hono.dev/docs/api/routing

---

### 1.3 Middleware

Express way:
```ts
app.use((req, res, next) => {
  console.log(req.method)
  next()
})
```

Hono way:
```ts
app.use('*', async (c, next) => {
  console.log(c.req.method)
  await next()
})
```

Same idea — `next()` but it must be `await next()` in Hono.

**For specific routes:**
```ts
app.use('/admin/*', adminMiddleware)
```

**Learn:** https://hono.dev/docs/concepts/middleware

---

### 1.4 Context Variables (replaces req.user)

In Express you do `(req as any).user = decoded` to pass data between middleware.
In Hono you use typed context variables:

```ts
// Define the variable type on the app
const app = new Hono<{ Variables: { user: TokenPayload } }>()

// Set in middleware
c.set('user', decoded)

// Get in route handler
const user = c.get('user')
```

This is cleaner and fully typed — no more `(req as any).user`.

**Learn:** https://hono.dev/docs/api/context#contextvariables

---

### 1.5 Built-in Middleware (replaces cors, express.json)

Express used separate packages. Hono has them built-in:

```ts
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

app.use('*', cors())
app.use('*', logger())
```

No need for `body-parser` or `express.json()` — Hono parses JSON automatically
via `c.req.json()`.

**Learn:** https://hono.dev/docs/middleware/builtin/cors

---

### 1.6 Error Handling (replaces express-async-handler + global error handler)

No need for `express-async-handler`. Hono handles async errors automatically.

Global error handler:
```ts
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))
```

**Learn:** https://hono.dev/docs/api/hono#error-handling

---

## 2. File Upload (replaces Multer)

Multer doesn't work in Hono/Workers. Use native FormData:

```ts
app.post('/bulk-upload', async (c) => {
  const body = await c.req.formData()
  const file = body.get('file') as File

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Use bytes the same way you used req.file.buffer
})
```

**Learn:** https://hono.dev/docs/guides/helpers#body

---

## 3. SSE Streaming (replaces res.write / res.setHeader)

This is the biggest change. Express used raw `res.write()`.
Hono uses the web standard `ReadableStream`:

```ts
import { streamSSE } from 'hono/streaming'

app.get('/reports/generate', (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: 'progress', data: JSON.stringify({ percentage: 10 }) })
    await stream.writeSSE({ event: 'progress', data: JSON.stringify({ percentage: 50 }) })
    await stream.writeSSE({ event: 'complete', data: JSON.stringify({ fileName: 'report.docx' }) })
  })
})
```

This is the cleanest replacement for your current SSE implementation.

**Learn:** https://hono.dev/docs/helpers/streaming#streamsse

---

## 4. Platform Entry Points

Once your `app.ts` is written in Hono, you just change the entry point per platform:

### Node.js (local dev / Vercel)
```ts
// index.ts
import { serve } from '@hono/node-server'
import app from './app'
serve({ fetch: app.fetch, port: 3033 })
```

### Cloudflare Workers
```ts
// worker.ts
import app from './app'
export default app  // Workers calls app.fetch() automatically
```

### Firebase Functions
```ts
// firebaseIndex.ts
import { onRequest } from 'firebase-functions/v2/https'
import app from './app'
export const api = onRequest((req, res) => app.fetch(req as any, res as any))
```

### Vercel
```ts
// api/index.ts
import { handle } from '@hono/vercel'  // or just use node-server
import app from './app'
export default handle(app)
```

**Learn:** https://hono.dev/docs/getting-started/nodejs

---

## 5. Packages to Replace

| Remove                    | Replace with               |
|---------------------------|----------------------------|
| `express`                 | `hono`                     |
| `express-async-handler`   | nothing (Hono handles it)  |
| `cors`                    | `hono/cors` (built-in)     |
| `multer`                  | native `FormData`          |
| `@types/express`          | nothing (Hono has own types)|
| `@types/cors`             | nothing                    |
| `@types/multer`           | nothing                    |
| `firebase-functions`      | keep for Firebase entry point|

Keep everything else: `pg`, `jsonwebtoken`, `xlsx`, `csv-parse`, `docx`, `@google-cloud/storage`

---

## 6. TypeScript Setup for Hono

Define your app type once with variables:

```ts
// types.ts
export type AppVariables = {
  user: {
    id: string
    name: string
    role: string
    department_id: number | null
    department_name?: string
  }
}

// app.ts
import { Hono } from 'hono'
import type { AppVariables } from './types'

const app = new Hono<{ Variables: AppVariables }>()
export default app
```

Pass this type to sub-routers too:
```ts
const auth = new Hono<{ Variables: AppVariables }>()
```

---

## 7. Migration Order (recommended)

Do it in this order to avoid breaking everything at once:

1. **Set up Hono app skeleton** — `app.ts` with cors, logger, maintenance middleware
2. **Migrate auth routes** — login, users, departments (no SSE, no file upload)
3. **Migrate table + section + document routes** — straightforward GET/PUT
4. **Migrate report routes (non-SSE)** — get report, save report
5. **Replace Multer** — bulk upload with FormData
6. **Migrate SSE endpoints** — report generate + snapshot generate (use streamSSE)
7. **Swap entry points** — Node.js for local, keep Firebase + add Workers/Vercel

---

## 8. Key Things That Stay Exactly The Same

- All `pool.query()` database calls — zero changes
- JWT sign/verify logic — zero changes
- All controller business logic — zero changes
- GCS storage service — zero changes
- DOCX generation — zero changes
- CSV/Excel parsing — zero changes
- env.config.ts — zero changes

The migration is mostly **replacing Express plumbing** (req/res/middleware syntax),
not rewriting business logic.

---

## Quick Reference Card

```ts
// ROUTE
app.get('/path/:id', async (c) => {
  const id = c.req.param('id')
  const { month } = c.req.query()
  const body = await c.req.json()
  const token = c.req.header('authorization')
  const user = c.get('user')

  return c.json({ data: result })         // 200
  return c.json({ error: 'bad' }, 400)    // 400
  return c.json({ data: result }, 201)    // 201
})

// MIDDLEWARE
app.use('*', async (c, next) => {
  c.set('user', decoded)
  await next()
})

// ERROR HANDLER
app.onError((err, c) => c.json({ error: err.message }, 500))

// SSE
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ event: 'progress', data: JSON.stringify({ pct: 50 }) })
})

// FILE UPLOAD
const form = await c.req.formData()
const file = form.get('file') as File
const buffer = await file.arrayBuffer()
```
