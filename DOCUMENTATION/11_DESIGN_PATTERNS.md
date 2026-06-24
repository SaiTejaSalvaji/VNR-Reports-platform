# 11 Design Patterns

VNR Reports utilizes several established software design patterns to maintain clean, scalable, and readable code.

## 1. Model-View-Controller (MVC) - Backend API
While there are no traditional "Views" (HTML templates) rendered by the backend, it strictly adheres to the Controller pattern for REST APIs.
* **Routes (`routes/`)**: Act as the router. They map paths to controllers.
* **Controllers (`controllers/`)**: Handle the HTTP layer (req/res, status codes).
* **Models (`sql/`)**: Represented by the schema and raw SQL queries.

## 2. The Context Pattern (Frontend)
As discussed in the State Management section, React Context is used to provide implicit data to the component tree without prop drilling. This is an implementation of the **Provider Pattern**.

## 3. The Metadata-Driven UI Pattern (Dynamic Forms)
This is the most crucial pattern in the project.
* **The Problem**: Hardcoding React forms for 20+ different types of reports (which change frequently) is a maintenance nightmare.
* **The Pattern**: The backend serves a "Schema" (stored in `section_metadata`). The frontend contains a "Renderer".
* **Execution**: 
  The frontend reads: `{"name": "impact_factor", "type": "NUMBER"}`. 
  It maps `type: "NUMBER"` to a specific `<Input type="number" />` React component. 
* **Benefit**: The UI is decoupled from the business requirements. An admin can add a new column to a report via a database query, and the UI will automatically render it tomorrow without touching the React code.

## 4. Higher-Order Components (HOC) & Layout Wrappers
The `<Layout />` component acts as an HOC (or a layout wrapper). It encapsulates the Sidebar, Topbar, and the `<Outlet />` (from React Router). It ensures that all nested authenticated routes share the exact same structural shell without duplicating code in every page component.

## 5. Singleton Pattern (Database & Logger)
* **Database Pool**: The `pool` exported from `neonDb.config.ts` is initialized once and imported wherever needed. This ensures the app uses a single connection pool across all controllers, preventing connection leaks.
* **Logger**: The `winston` (or custom) logger is a singleton, ensuring logs are formatted consistently and streamed to the same destination across the app lifecycle.

## 6. Decorator / Middleware Pattern
Express middleware functions act as decorators for the route handlers.
```typescript
authRouter.get('/users', authenticateToken, requireAdmin, authController.getAllUsers);
```
The request is "decorated" or validated at each step. If `authenticateToken` fails, the chain breaks before `requireAdmin` or the controller is ever invoked. This centralizes cross-cutting concerns like security.
