# Firebase to MySQL Migration Plan (TDH ERP)

This plan is based on the current code paths that use Firebase Auth + Firestore collections:

- users
- arrival_records
- weighing_records
- quality-check_records
- dispatch_records
- Any additional stage collection in the format <stageId>_records

## 1) Target Architecture

- Frontend (existing Vite React app): unchanged UI/components.
- Backend API (new): Node.js + Express (or NestJS) + MySQL 8.
- Auth options:
  - Option A (recommended for fast migration): keep Firebase Auth temporarily, exchange Firebase ID token at backend, and map users in MySQL.
  - Option B: full migration to JWT with password + PIN verification in backend.
- Data store: MySQL with schema in database/mysql_schema.sql.

## 2) Code Areas to Replace First

### Current Firebase-heavy module
- contexts/AuthContext.tsx

### Current read listeners per stage
- components/GateEntryActivityTable.tsx
- components/WeighingActivityTable.tsx
- components/QualityCheckActivityTable.tsx
- components/DispatchActivityTable.tsx

### Current Firestore fallback reads in forms
- components/DispatchForm.tsx
- components/WeighingForm.tsx
- components/QualityCheckForm.tsx

## 3) API Contract to Introduce

Create these endpoints in the backend first:

- POST /auth/login
- POST /auth/logout
- GET /auth/me
- GET /users
- POST /users
- PATCH /users/:id
- DELETE /users/:id

- GET /arrival-records
- POST /arrival-records
- PATCH /arrival-records/:id/soft-delete

- GET /weighing-records
- POST /weighing-records
- PATCH /weighing-records/:id/soft-delete

- GET /quality-check-records
- POST /quality-check-records
- PATCH /quality-check-records/:id/soft-delete

- GET /dispatch-records
- POST /dispatch-records
- PATCH /dispatch-records/:id/soft-delete

- GET /stage-records?stageId=<value>
- POST /stage-records

## 4) Data Mapping Rules (Firestore -> MySQL)

### Common fields
- Firestore document id -> firestore_doc_id
- timestamp -> created_at
- userId -> created_by_user_id
- userName -> created_by_user_name
- deleted -> deleted
- details object -> details_json

### users collection
- id (doc id) -> users.id
- pin should be stored as pin_hash (bcrypt/argon2), not plain text
- auth password should be stored as password_hash if moving away from Firebase Auth

### arrival_records
- details.vehicle_number -> vehicle_number
- details.driver_name -> driver_name
- details.phone_number -> phone_number
- details.serial_number -> serial_number
- details.gate_mode -> gate_mode
- keep original object in details_json

### weighing_records
- details.vehicle_number -> vehicle_number
- details.ticket_no -> ticket_no
- details.gross_weight -> gross_weight
- details.tare_weight -> tare_weight

### quality-check_records
- details.vehicle_number -> vehicle_number
- details.transaction_id -> transaction_id
- numeric quality fields -> decimal columns
- details.upload_report (base64 today) -> upload_report (or move to file storage URL)

### dispatch_records
- details.vehicle_number -> vehicle_number
- details.client_name -> client_name
- details.destination -> destination
- Parse item_1..item_N fields into dispatch_items rows.

## 5) Migration Sequence (Low Risk)

1. Create backend + MySQL schema.
2. Export Firestore data (JSON export per collection).
3. Run one-time ETL script into MySQL.
4. Add dual write in backend (or temporary frontend adapter):
   - write to MySQL as primary
   - optionally mirror to Firestore for rollback window
5. Switch read paths in UI tables from onSnapshot to paginated GET endpoints.
6. Switch submitStageData calls to POST endpoints.
7. Remove Firestore reads from forms and replace with GET queries.
8. After stable period, disable Firestore writes.

## 6) Component Migration Checklist

### AuthContext.tsx
- Replace Firebase onAuthStateChanged with token/session-based /auth/me polling or init call.
- Replace Firestore users listener with GET /users (with role filtering in backend).
- Replace submitStageData with API POSTs by stage.

### Activity tables
- Replace onSnapshot queries with GET endpoints supporting:
  - time filter
  - search
  - soft-delete visibility by role

### Forms
- Replace arrival_records vehicle lookup with GET /arrival-records?gateMode=in&deleted=0
- Keep existing sanitization logic in UI; backend validates again.

## 7) Security Changes Needed

- Move authorization checks from Firestore rules to backend middleware.
- Enforce role-based access on every endpoint.
- Hash both password and PIN; never store raw PIN.
- Add audit_logs entries for login, create/update/delete records, user management.

## 8) Performance Baseline

Indexes to verify immediately after import:

- arrival_records(vehicle_number, created_at)
- weighing_records(vehicle_number, created_at)
- quality_check_records(vehicle_number, created_at)
- dispatch_records(vehicle_number, created_at)
- all deleted columns

## 9) Cutover Gate

Switch production reads to MySQL only when all are true:

- Row counts match Firestore export for each migrated collection.
- Spot checks of 50+ records per stage pass.
- User login + role permissions pass UAT.
- Dashboard and filters return expected records within acceptable latency.

## 10) Runbook Commands

1. Install root dependencies:
  - npm install

2. Install API dependencies:
  - npm --prefix api install

3. Create the MySQL schema:
  - mysql -u root -p < database/mysql_schema.sql

4. Export Firestore collections:
  - set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\firebase-service-account.json
  - set FIREBASE_PROJECT_ID=tdh-erp-asquare
  - npm run export:firestore

5. Import exported JSON into MySQL:
  - set MYSQL_HOST=127.0.0.1
  - set MYSQL_PORT=3306
  - set MYSQL_USER=root
  - set MYSQL_PASSWORD=your_password
  - set MYSQL_DATABASE=tdh_erp
  - npm run import:mysql

6. Start API server:
  - npm run api:dev

7. Start frontend in MySQL mode:
  - set VITE_USE_MYSQL=true
  - set VITE_API_BASE_URL=http://127.0.0.1:4000
  - npm run dev
