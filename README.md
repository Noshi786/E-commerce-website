# Noshin Store

A full-stack e-commerce application with a React storefront, an Express API, and MongoDB. The frontend and API can run locally as separate development servers or deploy together as one Vercel project.

## Features

- Product catalog with search, filters, sorting, pagination, image galleries, variants, reviews, and recommendations.
- Guest and signed-in shopping carts, checkout, order history, and order cancellation requests.
- Customer accounts with wishlists and saved delivery addresses.
- Admin dashboard for managing products, categories, customers, and orders.
- Email/password authentication and optional Google OAuth.
- Responsive storefront with accessible custom dropdowns and reduced-motion support.

## Tech stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Authentication: JSON Web Tokens and optional Google OAuth

## Requirements

- Node.js `20.19+` or `22.12+`
- npm
- MongoDB, locally or through MongoDB Atlas
- Google OAuth credentials only if Google sign-in is required

## Run locally on Windows

Open PowerShell in the project root.

### 1. Install dependencies

```powershell
npm install
npm --prefix frontend install
```

### 2. Configure environment variables

Copy the example file and open it for editing:

```powershell
Copy-Item .env.example .env
notepad .env
```

Set `MONGODB_URI` to your database connection string and `JWT_SECRET` to a long, random secret. Leave the Google OAuth values empty if you do not need Google sign-in. The `.env` file is for local use only and must never be committed.

### 3. Start the backend

In the first PowerShell window:

```powershell
npm run dev
```

The API runs at `http://localhost:3100`. Check that it is responding:

```powershell
Invoke-RestMethod http://localhost:3100/api/health
```

Expected response:

```json
{"status":"ok"}
```

### 4. Start the frontend

Open a second PowerShell window in the project root:

```powershell
npm --prefix frontend run dev
```

Open `http://localhost:5173` in your browser. Vite proxies frontend `/api` requests to the backend at `http://localhost:3100`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Long, private secret used to sign authentication tokens. |
| `PORT` | No | Local API port; defaults to `3100`. |
| `FRONTEND_URL` | No | Frontend origin used after OAuth; defaults to `http://localhost:5173`. |
| `API_BASE_URL` | No | Public API origin used to form the default Google callback URL. |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID. Set with the client secret to enable Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret. |
| `GOOGLE_CALLBACK_URL` | Optional | Google OAuth callback URL. Defaults to `${API_BASE_URL}/api/auth/google/callback`. |

Do not put real credentials in source files, README examples, screenshots, or Git commits. Set production secrets in the hosting provider's environment-variable settings.

## Create an administrator

Public registration creates customer accounts. To create or promote an administrator, set these variables temporarily in PowerShell, using your own values:

```powershell
$env:ADMIN_NAME = "Store Admin"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "replace-with-a-unique-password-of-at-least-12-characters"
npm run create-admin
```

After the script completes, remove the temporary values:

```powershell
Remove-Item Env:ADMIN_NAME
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_PASSWORD
```

Use a unique password and do not put it in Git or share it in chat.

## API overview

All API routes use the `/api` prefix.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | API health check. |
| `/api/products` | Product catalog and product details. |
| `/api/categories` | Product categories. |
| `/api/auth` | Registration, login, and optional Google OAuth. |
| `/api/cart` | Shopping cart. |
| `/api/orders` | Checkout and customer orders. |
| `/api/wishlist` | Signed-in customer's wishlist. |
| `/api/users/me/addresses` | Signed-in customer's saved addresses. |
| `/api/admin/users` | Protected user administration APIs. |
| `/api/admin/dashboard` | Protected dashboard data. |

Protected endpoints require an `Authorization: Bearer <token>` header.

## Tests and validation

Run all Node.js unit tests from the project root:

```powershell
npm test
```

Run frontend tests, lint, and production build individually:

```powershell
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Deploy frontend and API together to Vercel

The root [`vercel.json`](./vercel.json) configures Vercel to build the frontend and route `/api/*` requests to the Express serverless handler in [`api/index.js`](./api/index.js).

1. Push the project to a GitHub repository. Keep the repository root as the Vercel project root; do not set it to `frontend/`.
2. In Vercel, create a project by importing the GitHub repository. The build and output settings are provided by `vercel.json`.
3. Add the production environment variables in Vercel:
   - `MONGODB_URI`
   - `JWT_SECRET` (generate a new production secret; do not reuse a development value)
   - `FRONTEND_URL` (the deployed HTTPS site origin)
   - `API_BASE_URL` (the deployed HTTPS API origin; with a combined deployment this is usually the same origin)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` only if using Google sign-in
4. In MongoDB Atlas, configure database network access securely so the deployment can connect.
5. If using Google OAuth, set `GOOGLE_CALLBACK_URL` to `https://YOUR-VERCEL-DOMAIN/api/auth/google/callback` and add that exact URL to the Google OAuth client's authorized redirect URIs. Set `FRONTEND_URL` to `https://YOUR-VERCEL-DOMAIN`.
6. Deploy. After deployment, test the site, `https://YOUR-VERCEL-DOMAIN/api/health`, sign-up/login, and checkout flows.
7. Create the production administrator once from a trusted environment using the production `MONGODB_URI` and temporary admin variables. Remove those variables when finished.

Checkout and category updates use MongoDB transactions, so the database must support transactions (MongoDB Atlas clusters are replica sets).

## Project structure

```text
api/                 Vercel serverless API entry point
config/              Database and OAuth configuration
controllers/          API request handlers
middleware/           Authentication and authorization
models/               Mongoose models
routes/               Express API routes
scripts/              Administrative setup scripts
tests/                Backend unit tests
frontend/src/         React application and styles
frontend/tests/       Frontend unit tests
vercel.json           Combined frontend/API Vercel configuration
```
