# Noshin ecommerce

Responsive ecommerce storefront and protected administration dashboard built with React, Express, MongoDB, and Google OAuth.

## Features

- Searchable and filterable catalog with pagination, product detail pages, image gallery, variants, availability, reviews, and related/recently viewed products.
- Guest and account carts, guest checkout, server-side price and stock validation, order history/details, and cancellation requests.
- Account wishlist and saved delivery addresses.
- Protected admin dashboard for products, variants, stock, categories, customers, orders, payment status, and low-stock alerts.
- Google OAuth and email/password authentication.

## Run locally

1. Install backend packages with `npm install`.
2. Install frontend packages with `npm --prefix frontend install`.
3. Copy `.env.example` to `.env` and provide `MONGODB_URI` and a long, random `JWT_SECRET`. Add Google OAuth credentials if Google sign-in is needed.
4. Start the API with `npm run dev`.
5. In another terminal, start the storefront with `npm --prefix frontend run dev`.
6. Open `http://localhost:5173`.

The frontend development server proxies `/api` requests to `http://localhost:3100`.

## Create an administrator account

The public registration endpoint only creates customer accounts. To create the store administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters in the local environment and run `npm run create-admin`. The script creates the account or promotes the matching account; it never prints the password. Remove the temporary environment variables after it completes. Do not commit credentials or paste them into chat.

## Deploy to Vercel

The root `vercel.json` builds the Vite app and routes API requests through the Express serverless function in `api/index.js`. Connect the repository to Vercel with the repository root as the project root, then set these environment variables in Vercel:

- `MONGODB_URI`: MongoDB Atlas connection string. Allow Vercel's network access in Atlas (or use an appropriate secure network configuration).
- `JWT_SECRET`: a newly generated, high-entropy secret; never reuse a development or previously exposed value.
- `FRONTEND_URL`: the deployed HTTPS site origin, such as `https://your-project.vercel.app`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: required only for Google OAuth.
- `GOOGLE_CALLBACK_URL`: `https://your-project.vercel.app/api/auth/google/callback`; add the same URI to the Google OAuth client.

Deploy after setting the variables. Run the administrator provisioning script once against the production database from a trusted environment with the production `MONGODB_URI` and chosen admin credentials; then clear those temporary variables. Register a normal customer account through the live site to verify the customer flow. Share account credentials securely and separately, never in this repository.

MongoDB transactions used by checkout and category updates require a replica set; MongoDB Atlas provides this.

## Validation

- Frontend lint: `npm --prefix frontend run lint`
- Frontend production build: `npm --prefix frontend run build`
- Backend syntax check: `node --check server.js`
