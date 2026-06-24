# 02 Folder Structure Explanation

Understanding the repository structure is critical for navigating the codebase. The project is organized as a Monorepo containing both `client` and `server` directories.

## Root Directory
```text
/vnr-reports
├── client/         # React SPA Frontend
├── server/         # Express REST API Backend
├── docs/           # You are here (Technical Documentation)
├── package.json    # Optional root package.json for concurrently running dev scripts
└── README.md
```

---

## Frontend (`/client`)

```text
/client
├── public/         # Static assets (images, icons) copied directly to build folder
├── src/            # Main React source code
│   ├── components/ # Reusable UI components
│   │   ├── ui/     # Base UI elements (buttons, inputs) - often from Shadcn/Radix
│   │   └── ...     # Complex components (Sidebar, Topbar, Modals)
│   ├── contexts/   # React Context providers (Global State)
│   │   ├── AuthContext.tsx       # Manages JWT, login state, user object
│   │   ├── SidebarContext.tsx    # Manages UI state for the sidebar
│   │   └── MonthYearContext.tsx  # Global filter for the selected report period
│   ├── libs/       # Utility libraries
│   │   ├── api.ts                # Axios instance with interceptors for JWT
│   │   └── utils.ts              # Helper functions (class merging, formatting)
│   ├── pages/      # Route-level components (Views)
│   │   ├── ReportEditor.tsx      # Main workspace for faculty
│   │   ├── AdminStats.tsx        # Dashboard for admins
│   │   └── Settings.tsx          # User profile settings
│   ├── App.tsx     # Root React component, defines Router and suspense
│   ├── main.tsx    # React DOM render entry point
│   └── index.css   # Global Tailwind CSS imports and custom variables
├── vite.config.ts  # Vite bundler configuration
└── package.json    # Frontend dependencies
```

### Key Frontend Folders
* **`components/ui/`**: This folder usually contains "dumb" components. They don't fetch data; they just render UI based on props.
* **`contexts/`**: This replaces Redux for state management. Since the state isn't massively complex, Context API is sufficient and prevents prop-drilling.

---

## Backend (`/server`)

```text
/server
├── src/
│   ├── configs/       # Environment variables and DB connection strings
│   ├── controllers/   # Request/Response handlers
│   │   ├── auth.controller.ts
│   │   ├── report.controller.ts
│   │   └── ...
│   ├── middleware/    # Express middleware functions
│   │   └── auth.middleware.ts # Verifies JWTs and roles
│   ├── routes/        # API endpoint definitions (Express Router)
│   │   ├── auth.route.ts
│   │   └── ...
│   ├── services/      # (Optional) Core business logic separated from controllers
│   ├── utils/         # Helper functions (Logging, formatting)
│   │   └── logger.utils.ts    # Custom logger for request tracking
│   ├── app.ts         # Express app initialization and middleware binding
│   ├── index.ts       # Local development entry point (app.listen)
│   └── firebaseIndex.ts # Serverless entry point for Firebase Functions
├── sql/               # Database schemas and migration scripts
│   ├── v0-schema.sql
│   ├── v2-schema-jsonb-final-implementation.sql
│   └── ...
├── package.json       # Backend dependencies
└── tsconfig.json      # TypeScript compiler options
```

### Key Backend Folders
* **`routes/` vs `controllers/`**: The `routes/` files *only* define the URL paths and attach middleware. They immediately pass the request to a function in `controllers/`. This separates routing logic from business execution.
* **`sql/`**: Contains raw `.sql` files. Because the project doesn't use a heavy ORM with built-in migration tools (like Prisma), schema changes are documented here. It serves as the source of truth for database structure.
* **`app.ts` vs `index.ts`**: `app.ts` exports the configured Express app. `index.ts` imports it and binds it to a port. This is an excellent testing and deployment pattern (allowing serverless functions to just import `app`).
