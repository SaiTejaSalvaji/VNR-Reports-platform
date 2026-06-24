# 10 State Management

This document details how state is maintained and synchronized between the React frontend and the PostgreSQL backend.

## Frontend State Management Philosophy

VNR Reports eschews heavy global state libraries (like Redux or MobX) in favor of **React Context API** combined with **Local Component State**. 

### Why Context over Redux?
Redux is powerful but introduces significant boilerplate. In this application, the global state is relatively flat and read-heavy:
* **Who am I?** (`AuthContext`)
* **What month are we looking at?** (`MonthYearContext`)
* **Is the sidebar open?** (`SidebarContext`)

These values change infrequently. Context API is perfect for this. If the application had highly frequent, deeply nested state updates (like a collaborative canvas or stock ticker), Redux or Zustand would be preferred to prevent unnecessary re-renders.

### 1. `MonthYearContext` (The Global Filter)
The most critical piece of business state.
* **Problem**: The user can view "Publications" or "Events". Both need to show data for a specific Month/Year. If the user changes the month in the top navigation bar, *all* data fetches across the app must reflect this change.
* **Solution**: `MonthYearProvider` wraps the app. It holds `{ month: 2, year: 2026 }`. 
* **Consumption**: Inside `ReportEditor.tsx`, a `useEffect` hook depends on `month` and `year`. When they change, it triggers a new API call to fetch the relevant `monthly_reports` row from the backend.

### 2. Local State for Form Data
When a user is typing into a dynamic table cell (e.g., changing a paper title), that state is kept *strictly local* to the table or row component.
* **Flow**: User types -> Local `useState` updates -> User clicks "Save" -> API `POST` -> Backend updates DB -> Frontend table updates with success response.
* **Why not Context?** Putting every keystroke of a massive table into a global Context would trigger a re-render of the entire application on every key press, crippling performance.

## Backend State Management (Statelessness)

The Express backend is entirely **Stateless**.
* It does not use session storage (like `express-session` with Redis).
* Every request is authenticated independently via the JWT provided in the header.
* **Advantage**: The backend can be deployed across multiple instances (or Serverless functions) behind a load balancer. Request 1 might hit Server A, and Request 2 might hit Server B, and both will succeed without needing server synchronization.

## State Synchronization (Client-Server)
The application relies on a "fetch-and-replace" synchronization model.
* The frontend fetches the `JSONB` array from the server.
* The frontend mutates the array locally when a row is edited.
* The frontend sends the *entire section array* (or specific row data) back to the server to overwrite/merge into the `JSONB` column.
* *Tradeoff*: There is no realtime WebSockets implementation. If User A and User B are editing the exact same report section simultaneously, the last one to click "Save" overwrites the data in PostgreSQL.
