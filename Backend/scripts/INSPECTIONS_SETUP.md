# Inspections Table Setup

## Problem
The frontend was getting a 404 error when trying to fetch inspections because the `inspections` table didn't exist in the PostgreSQL database.

## Solution
The inspections route has been updated with auto-initialization logic, and a standalone initialization script has been created.

### Option 1: Automatic (Recommended)
The `inspections` route will automatically create the table on the first request. Simply reload your frontend and the table will be created automatically when the API is called.

### Option 2: Manual Initialization
Run the initialization script directly:

```bash
cd Backend
node scripts/initInspectionsTable.js
```

## Table Schema
The `inspections` table is created with the following columns:

- `id` - SERIAL PRIMARY KEY
- `reference` - VARCHAR(255) UNIQUE NOT NULL - Unique inspection reference number
- `inspection_type` - VARCHAR(255) NOT NULL
- `property` - INTEGER
- `service_user` - INTEGER
- `inspector_name` - VARCHAR(255) NOT NULL
- `inspection_date` - DATE NOT NULL
- `findings` - TEXT
- `issues_found` - INTEGER (default: 0)
- `action_required` - BOOLEAN (default: FALSE)
- `status` - VARCHAR(50) (default: 'pending')
- `priority` - VARCHAR(50) (default: 'Medium')
- `created_at` - TIMESTAMP (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP (default: CURRENT_TIMESTAMP)

Two indexes are created for performance:
- `idx_inspections_status` on the `status` column
- `idx_inspections_inspection_date` on the `inspection_date` column

## API Endpoints
- `GET /api/inspections` - List all inspections
- `GET /api/inspections/:id` - Get a specific inspection
- `POST /api/inspections` - Create a new inspection
- `PUT /api/inspections/:id` - Update an inspection
- `DELETE /api/inspections/:id` - Delete an inspection
