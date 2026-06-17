# TDH ERP Deployment on cPanel with MySQL

This guide is for deploying the current TDH ERP application on a cPanel server using:

- a static frontend build from Vite/React
- a Node.js API from the `api` folder
- a MySQL database created in cPanel

## 1. Deployment Architecture

Use this structure:

- Frontend: deploy the Vite `dist` output to `public_html` or a domain/subdomain document root.
- Backend API: deploy the `api` folder as a Node.js application in cPanel.
- Database: create a MySQL database and user in cPanel, then import the schema from `database/mysql_schema.sql`.

Recommended production URLs:

- Frontend: `https://erp.yourdomain.com`
- API: `https://api.yourdomain.com`

Using a separate API subdomain is simpler than trying to host the API inside a frontend subfolder.

## 2. Server Requirements

Confirm your hosting account supports all of the following:

- cPanel access
- Setup Node.js App in cPanel
- MySQL database access
- SSH or Terminal access in cPanel
- Node.js 18 or newer

If your hosting provider does not allow Node.js applications, this backend cannot run correctly on that plan.

## 3. Project Parts Used in Production

This repo uses:

- Frontend root app: Vite React
- Backend API: `api/src/server.js`
- Database connector: `api/src/db.js`
- Frontend MySQL mode flags: `services/appConfig.ts`

The frontend expects these values at build time:

- `VITE_USE_MYSQL=true`
- `VITE_API_BASE_URL=https://api.yourdomain.com`

The backend expects these runtime values:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

The API now also supports cPanel/Passenger-style runtime env vars:

- `PORT`
- `IP`

## 4. Create the MySQL Database in cPanel

In cPanel:

1. Open MySQL Databases.
2. Create a database, for example `cpaneluser_tdh_erp`.
3. Create a MySQL user.
4. Add that user to the database with `ALL PRIVILEGES`.

Save these values:

- database name
- database username
- database password
- database host

On many cPanel servers the host is `localhost`.

## 5. Import the Database Schema

Use the schema file below, not the older setup script:

- `database/mysql_schema.sql`

You can import it in either of these ways.

### Option A: phpMyAdmin

1. Open phpMyAdmin in cPanel.
2. Select the database you created.
3. Open Import.
4. Upload `database/mysql_schema.sql`.
5. Run the import.

### Option B: SSH

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < database/mysql_schema.sql
```

## 6. Upload the Project

Upload the project to your hosting account. A practical layout is:

```text
/home/CPANEL_USER/
  tdh-erp-test/
    api/
    dist/
    package.json
    services/
    docs/
    database/
```

You can upload with:

- Git Version Control in cPanel
- File Manager
- SFTP
- SSH + git clone

## 7. Install Dependencies

Install root dependencies for the frontend build and root tooling:

```bash
cd ~/tdh-erp-test
npm install
```

Install API dependencies:

```bash
cd ~/tdh-erp-test/api
npm install
```

## 8. Build the Frontend for Production

The frontend must be built with MySQL mode enabled and with the production API URL.

In SSH:

```bash
cd ~/tdh-erp-test
set VITE_USE_MYSQL=true
set VITE_API_BASE_URL=https://api.yourdomain.com
npm run build
```

If your shell is bash instead of Windows-style shell, use:

```bash
cd ~/tdh-erp-test
export VITE_USE_MYSQL=true
export VITE_API_BASE_URL=https://api.yourdomain.com
npm run build
```

This creates the frontend build in:

- `dist/`

## 9. Deploy the Frontend to public_html

Copy the contents of `dist/` into your frontend document root.

Examples:

- main domain: `public_html/`
- subdomain: the subdomain document root configured in cPanel

Important:

- Copy the contents inside `dist`, not the `dist` folder itself.
- Make sure `index.html` ends up directly inside the document root.

If your frontend will be served from a subfolder instead of a domain root, set the correct Vite base config before building. For this project, a domain root or subdomain root is the safer deployment target.

## 10. Create the Node.js App in cPanel

In cPanel, open Setup Node.js App and create an app with values similar to these:

- Node.js version: 18+ or the newest available
- Application mode: Production
- Application root: `tdh-erp-test/api`
- Application URL: `api.yourdomain.com`
- Application startup file: `src/server.js`

After creating the app, open the app configuration and set environment variables.

## 11. Backend Environment Variables

Add these environment variables in the cPanel Node.js App configuration:

```text
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=YOUR_DB_USER
MYSQL_PASSWORD=YOUR_DB_PASSWORD
MYSQL_DATABASE=YOUR_DB_NAME
API_HOST=127.0.0.1
API_PORT=4000
NODE_ENV=production
```

Notes:

- Many cPanel Node environments automatically inject `PORT` and `IP`.
- The API has been adjusted to support both `PORT`/`IP` and `API_PORT`/`API_HOST`.
- If your provider gives you a different MySQL host, use that instead of `localhost`.

## 12. Start or Restart the API

After saving the Node.js app configuration:

1. Run `npm install` for the app if cPanel has not already done it.
2. Click Restart in the Node.js App page.
3. Open the API health endpoint:

```text
https://api.yourdomain.com/health
```

Expected result:

```json
{"ok":true}
```

If that endpoint fails, the frontend will not work.

## 13. Point the Frontend to the API

The frontend uses `services/appConfig.ts` and reads:

- `VITE_USE_MYSQL`
- `VITE_API_BASE_URL`

That means you must rebuild the frontend whenever the production API URL changes.

The correct production build values are typically:

```text
VITE_USE_MYSQL=true
VITE_API_BASE_URL=https://api.yourdomain.com
```

## 14. Recommended Domain Setup

Recommended:

- frontend on `erp.yourdomain.com`
- API on `api.yourdomain.com`

This avoids path-proxy issues and keeps frontend and backend deployment independent.

If you use a single domain for both, you will need Apache or reverse-proxy rules handled by the hosting provider. On standard shared cPanel hosting, separate subdomains are usually the least fragile option.

## 15. First Production Smoke Test

After deployment, test in this order:

1. Open `https://api.yourdomain.com/health`
2. Open the frontend URL
3. Log in with a valid user from the `users` table
4. Create a record in one stage
5. Confirm the record appears in the matching activity table
6. Confirm a new row is present in MySQL

Useful SQL checks:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM arrival_records;
SELECT COUNT(*) FROM weighing_records;
SELECT COUNT(*) FROM quality_check_records;
SELECT COUNT(*) FROM dispatch_records;
SELECT COUNT(*) FROM sales_records;
SELECT COUNT(*) FROM stage_records;
```

## 16. Common Problems

### Frontend opens but login or tables fail

Likely causes:

- wrong `VITE_API_BASE_URL`
- API is not running
- `/health` fails
- CORS/domain mismatch

Check:

- browser devtools network requests
- cPanel Node app logs
- API restart status

### API does not start in cPanel

Likely causes:

- Node.js app not supported on the hosting plan
- wrong application root
- wrong startup file
- dependencies not installed in `api`
- MySQL credentials are wrong

### Database connection fails

Check these values in the app environment:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

Also verify the MySQL user is assigned to the database with full privileges.

### Frontend works locally but not on cPanel

This usually means the frontend was built with local env values. Rebuild using the production values for:

- `VITE_USE_MYSQL`
- `VITE_API_BASE_URL`

## 17. Update and Redeploy Flow

For future deployments:

1. Upload updated source.
2. Run `npm install` if package files changed.
3. Run `npm --prefix api install` if API dependencies changed.
4. Rebuild the frontend with production `VITE_` env values.
5. Replace the deployed frontend files in `public_html`.
6. Restart the cPanel Node.js app.

## 18. Minimal Production Checklist

- MySQL database created in cPanel
- `database/mysql_schema.sql` imported
- API dependencies installed in `api`
- frontend built with `VITE_USE_MYSQL=true`
- frontend built with production `VITE_API_BASE_URL`
- Node.js app created in cPanel
- MySQL env vars configured in Node app
- API `/health` endpoint working
- frontend deployed from `dist`

## 19. Optional Hardening

Recommended follow-up items:

- enable HTTPS for both frontend and API domains
- store a strong database password in cPanel env vars only
- restrict public database access if your host allows it
- set up regular MySQL backups
- add a process for app log review after each deployment
