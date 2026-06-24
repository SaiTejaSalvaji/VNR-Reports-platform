# 09 Authentication and Security

Security in VNR Reports is managed through a combination of standard hashing, JWTs, and strict middleware authorization checks.

## 1. Authentication Flow (JWT)

The system uses **JSON Web Tokens (JWT)** for stateless authentication.
1. When a user logs in, the backend compares the submitted password against the `bcrypt` hash stored in the database.
2. If successful, `jsonwebtoken` creates a signed token containing the user's `id`, `role`, and `department_id`.
3. The JWT Secret (`env.JWT_SECRET`) is stored securely in the server environment. If this secret is ever compromised, all currently issued tokens must be considered compromised.
4. The client stores the token in `localStorage` (XSS vulnerable, but standard for basic SPAs without complex SameSite HttpOnly cookie setups).

## 2. Authorization (RBAC)

Role-Based Access Control (RBAC) is enforced at the API level via custom Express middlewares located in `server/src/middleware/auth.middleware.ts`.

* **`authenticateToken`**: 
  - Verifies the JWT signature.
  - Attaches the decoded payload to `req.user`.
  - Rejects with `401 Unauthorized` if invalid or expired.
* **`requireAdmin`**: 
  - Passes only if `req.user.role === 'admin'`.
  - Rejects with `403 Forbidden` otherwise.
* **`requireAdminOrHOD`**:
  - Allows `admin` or `hod`.

**Frontend Enforcement**: The frontend also uses the `user.role` from `AuthContext` to hide sidebar links and admin buttons. However, *frontend hiding is a UX feature, not a security feature*. The backend middleware is the actual security barrier.

## 3. Password Security & Rate Limiting

* **Hashing**: Passwords are never stored in plaintext. They are hashed using `bcrypt` (with standard salt rounds).
* **Account Locking**: The schema contains an `account_locks` table.
  ```sql
  CREATE TABLE account_locks (
      user_id VARCHAR(50) NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP
  )
  ```
  This defends against brute-force attacks. After `X` failed login attempts, the account is temporarily locked (e.g., `locked_until = NOW() + 15 mins`).

## 4. SQL Injection Protection

The application uses the `pg` driver to connect to PostgreSQL.
**Vulnerability Defense**: The backend heavily relies on parameterized queries.
```typescript
// SECURE
await pool.query('SELECT * FROM users WHERE id = $1', [req.body.id]);

// INSECURE (Never do this)
await pool.query(`SELECT * FROM users WHERE id = '${req.body.id}'`);
```
Because user inputs are passed in the array (`[req.body.id]`), the PostgreSQL engine treats them strictly as strings/values, preventing SQL injection commands from executing.

## 5. Security Risks & Recommendations

1. **localStorage vs HttpOnly Cookies**: Currently, JWTs are likely stored in `localStorage` by the client SPA. This makes them vulnerable to Cross-Site Scripting (XSS). If an attacker manages to inject JS into a Tiptap Rich Text field that isn't sanitized, they could steal tokens.
   * *Recommendation*: Move JWTs to Secure, HttpOnly, SameSite cookies managed by the backend.
2. **CORS Configuration**: In `app.ts`, CORS might be fully open during development (`app.use(cors())`).
   * *Recommendation*: Ensure the production CORS block is uncommented so only verified origins (like the Vercel app domain) can make API requests.
3. **Rate Limiting**: There is no global IP rate limiting middleware (like `express-rate-limit`).
   * *Recommendation*: Implement IP-based rate limiting to protect against DDoS attacks on the `/auth/login` endpoint.
