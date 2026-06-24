# 08 API Documentation

This document provides a high-level overview of the primary REST endpoints in the system. All endpoints (except Login) require an `Authorization: Bearer <token>` header.

## Authentication Routes (`/auth`)

### `POST /auth/login`
* **Purpose**: Authenticates a user and issues a JWT.
* **Body**: `{ "id": "00CSE008", "password": "securepassword" }`
* **Response**: 
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbG...",
    "user": {
      "id": "00CSE008",
      "name": "Dr. Talluri",
      "role": "hod",
      "department_id": 10
    }
  }
  ```

### `GET /auth/users`
* **Purpose**: Fetches all users.
* **Role**: Admin only.
* **Response**: Array of User objects without passwords.

---

## Metadata & Section Routes (`/sections`)

### `GET /sections/sidebar`
* **Purpose**: Determines which sidebar navigation items the current user has access to.
* **Response**:
  ```json
  {
    "sections": [
      { "section_key": "faculty_details", "display_name": "1. Faculty Details" },
      { "section_key": "events_conducted", "display_name": "2. Events Conducted" }
    ]
  }
  ```

### `GET /sections/:sectionKey/schema`
* **Purpose**: Fetches the JSON definition of columns for dynamic form rendering.
* **Params**: `sectionKey` (e.g., `events_conducted`)

---

## Data Operations Routes (`/tables`)

### `GET /tables/:sectionKey/rows`
* **Purpose**: Fetch existing data for a specific section and month.
* **Query Params**: `?month=2&year=2026`
* **Response**: 
  ```json
  {
    "data": [
      { "event_type": "Workshop", "description": "React Training" }
    ]
  }
  ```

### `POST /tables/rows`
* **Purpose**: Submit or update data for a section. Because data is stored in a JSONB blob in `monthly_reports`, this acts as an upsert/merge.
* **Body**:
  ```json
  {
    "sectionKey": "events_conducted",
    "month": 2,
    "year": 2026,
    "rowData": [ ... array of row objects ... ]
  }
  ```

---

## Report & Snapshot Routes (`/reports`)

### `GET /reports/snapshot`
* **Purpose**: Generates global excel/word aggregates.
* **Query Params**: `?month=2&year=2026&type=excel`
* **Role**: Admin / HOD.
* **Response**: Binary data stream (File Download).

---

## Document & File Upload Routes (`/documents`)

### `POST /documents/upload`
* **Purpose**: Uploads physical files to Google Cloud Storage.
* **Headers**: `Content-Type: multipart/form-data`
* **Form Data**:
  * `file`: (Binary File)
  * `sectionKey`: `mtp_activities`
  * `month`: `2`
  * `year`: `2026`
* **Response**: JSON containing the public or signed GCS URL for the uploaded file.
