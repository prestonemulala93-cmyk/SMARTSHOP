# SmartShop

SmartShop is a single-process Node.js/Express application with a SQLite database. The server serves the web interface and its API from the same origin.

## Run locally

Requirements: Node.js 20 or later and npm.

```powershell
npm ci
$env:PORT = "5000"
$env:ADMIN_PASSCODE = "replace-with-a-long-random-secret"
npm start
```

Open `http://localhost:5000`. The app creates the database schema and sample products on first startup. To choose a database location, set `SMARTSHOP_DB_PATH` to an absolute file path before starting the app.

For development, `npm run dev` starts Node's built-in watch mode. `npm run check` checks JavaScript syntax; `npm test` runs that check.

## Install as an app

The site includes a web app manifest and service worker. Deploy it on HTTPS (or use `localhost` during development), then open it in a supported browser and choose **Install app** or **Add to Home Screen**. The service worker caches the app shell and falls back to it when an offline navigation fails; API calls and customer/order data are never cached, so shopping and checkout still require a connection.

On iPhone or iPad, open the HTTPS site in Safari and choose **Share > Add to Home Screen**. After changing the manifest or service worker, close and reopen the installed app if the update does not appear immediately.

## Deploy

Deploy as a Node.js service using Node.js 20+, with the following settings:

- Install command: `npm ci`
- Start command: `npm start`
- `PORT`: set by the hosting platform; the server listens on `0.0.0.0`
- `ADMIN_PASSCODE`: set to a unique, strong secret in the hosting provider's secret/environment-variable settings
- `SMARTSHOP_DB_PATH`: set to a file under a persistent mounted volume if the platform's application filesystem is ephemeral

The `/healthz` endpoint returns HTTP 200 when the app and database are available, and HTTP 503 if the database check fails. Configure the host's health check to use `/healthz`. The database's parent directory is created automatically. Back up the persistent SQLite file and use a single application instance; this app is not configured for shared or horizontally scaled SQLite storage.

Do not commit the production database, credentials, or `.env` files. Termination signals close the HTTP server and SQLite connection gracefully.

### Deploy a staging service on Render

The repository includes a `render.yaml` Blueprint for the complete app. It configures a Node web service, `/healthz`, and a persistent disk for SQLite. The disk-backed service uses Render's paid Starter plan; review Render's current pricing before creating it. SQLite is intended for a single app instance.

1. Push this project to a GitHub repository you control. Do not include `node_modules`, `.env` files, or `smartshop.db`.
2. In Render, choose **New > Blueprint** and connect that repository.
3. Review the Blueprint and provide a unique, strong `ADMIN_PASSCODE` when prompted. Do not put the value in the repository.
4. Create the service and wait for its `/healthz` check to pass.
5. Open the Render-provided HTTPS URL on your phone and install SmartShop from the browser menu.

Use this for staging only until password hashing, server-side authorization, and real payment processing are implemented. The current app must not be used to accept real payments or sensitive customer data.

## Before using with real customers

This project remains a demonstration, not a production commerce system. Orders are currently marked paid without contacting a payment provider, user passwords are stored as plain text, and customer/admin workflows do not use server-side sessions or role-based authorization. Integrate and verify a payment provider, add password hashing and session-based authorization, and secure order creation/redemption before accepting real payments or customer data. Serve the app only behind HTTPS.
