# 06 Frontend Deep Dive

The frontend is a React 19 Single Page Application (SPA) built with Vite and TypeScript. It prioritizes a highly dynamic UI capable of rendering complex tables from JSON schemas.

## Component Architecture

The application uses a Context-driven, heavily modular architecture.

### 1. Global Contexts (State Management)
Instead of Redux, the app uses React Context to prevent prop-drilling:
* **`AuthContext`**: Manages the logged-in user state (`user`, `token`, `role`) and intercepts Axios requests to inject JWTs.
* **`SidebarContext`**: Manages the open/close state of the mobile sidebar.
* **`MonthYearContext`**: Since all reports are tied to a specific month and year, this context holds the globally selected Date filter. When a user changes the month in the top bar, this context updates, causing all child components (like `ReportEditor`) to re-fetch data for the new month.

### 2. Layout & Routing (`App.tsx` & `Layout.tsx`)
* **Lazy Loading**: Major routes (`ReportEditor`, `AdminStats`, `Settings`) are loaded via `React.lazy()`. They are suspended while their JavaScript chunks download.
* **`Layout.tsx`**: A Higher Order Component-like wrapper that includes the `Sidebar` and `Topbar`. The main content area uses `<Outlet />` from `react-router-dom` to inject the routed components.

## Deep Dive: The Report Editor (`ReportEditor.tsx`)

This is the most complex component in the system. It is responsible for reading the section schema from the backend and rendering an interactive form/table.

### Rendering Lifecycle
1. User clicks "Faculty Publications" on Sidebar.
2. URL updates to `/section/journal_publications`.
3. `useEffect` in `ReportEditor` detects the `:sectionKey` change.
4. **Fetch Schema**: Calls API to get the metadata for `journal_publications` (which columns are TEXT, NUMBER, SELECT, etc.).
5. **Fetch Data**: Calls API to get existing rows for this section for the current `MonthYearContext`.
6. **Render Table**:
   * Iterates through columns defined in schema to build `<th>` headers.
   * Iterates through fetched rows to build `<tr>` elements.

### Field Types & Dynamic Components
The schema dictates the input components used:
* `TEXT` / `NUMBER`: Renders a standard `<input>`.
* `TEXTAREA`: Renders a `<textarea>` or expands visually.
* `SELECT`: Renders a customized dropdown (often using Radix UI/Shadcn primitives).
* `RICH_TEXT`: Integrates the `Tiptap` editor for WYSIWYG editing, mapping HTML output to the database.

### Memoization & Optimization
Because dynamic tables can have dozens of rows and columns, re-rendering the entire table every time a user types a single character in one cell would cause massive lag.
* **`React.memo`**: Row components are likely memoized. 
* **Local vs Global State**: Edits to a specific cell are kept in local component state until the user clicks "Save" or clicks away (blur), rather than updating a massive JSON context on every keystroke.

## Styling & Theming

* **Tailwind CSS**: Used extensively for all styling. It ensures a small CSS footprint by purging unused utility classes.
* **Radix UI / Shadcn**: The `client/src/components/ui/` folder contains accessible, unstyled primitives from Radix UI, wrapped with Tailwind CSS (the Shadcn pattern). This provides highly accessible dropdowns, dialogs, and tooltips without massive third-party library overhead.
