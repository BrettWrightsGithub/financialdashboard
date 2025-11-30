# Plaid Quickstart

A brief guide to running the Plaid Quickstart app locally, obtaining API keys, and understanding the basic Link and API flow. [web:1]

---

## Overview

- Use the Plaid Quickstart app to test Plaid locally in the Sandbox environment. [web:1]
- You need a Plaid account and API keys from the Dashboard before running the Quickstart. [web:1]

---

## API Keys and Environments

- Obtain your `client_id` and `secret` from the Plaid Dashboard under Developers → Keys. [web:1]
- There are three environments: Sandbox (test data), Development, and Production (live data); the Quickstart starts in Sandbox. [web:1]
- Each environment has its own `secret`, so ensure you use the Sandbox secret for initial testing. [web:1]

---

## Quickstart Repository

- Clone the Quickstart repository: `https://github.com/plaid/quickstart`. [web:1]
- The repo includes backend and frontend code plus examples for multiple languages and Docker. [web:1]

---

## Setup Without Docker

Prerequisites: Node.js and npm installed; a terminal that can run basic Unix-style commands (on Windows, use a compatible shell). [web:1]

1. Clone and configure backend: [web:1]  
   - `git clone https://github.com/plaid/quickstart.git`  
   - `cp .env.example .env`  
   - Set `PLAID_CLIENT_ID` and `PLAID_SECRET` in `.env` for Sandbox.  
   - `cd quickstart/node`  
   - `npm install`  
   - `./start.sh`

2. Run the frontend: [web:1]  
   - `cd quickstart/frontend`  
   - `npm install`  
   - `npm start`  
   - Open `http://localhost:3000` in a browser.

3. Log in using Sandbox credentials (see “Sandbox Credentials” below) to simulate a user linking a bank. [web:1]

---

## Setup With Docker

Prerequisites: Docker installed and running; on Windows, typically a Linux environment is required for Docker-based setup. [web:1]

1. Clone and configure: [web:1]  
   - `git clone https://github.com/plaid/quickstart.git`  
   - `cd quickstart`  
   - `cp .env.example .env`  
   - Set `PLAID_CLIENT_ID` and `PLAID_SECRET` in `.env` for Sandbox.

2. Start the Quickstart container for your chosen language (for example Node): [web:1]  
   - `make up language=node`  
   - Open `http://localhost:3000` in a browser.

3. Useful Docker commands: [web:1]  
   - View logs: `make logs language=node`  
   - Stop container: `make stop language=node`

---

## Creating Your First Item

- An “Item” is a Plaid object representing a login at a financial institution; one user can have multiple Items across different institutions. [web:1]
- After the Quickstart is running on localhost, click “Launch Link” in the app and choose a Sandbox institution. [web:1]
- Use Sandbox credentials to simulate a successful login and create your first Item. [web:1]

### Sandbox Credentials

Typical Sandbox test credentials: [web:1]

- Username: `user_good`  
- Password: `pass_good`  
- 2FA (if prompted): `1234`

---

## High-Level Link Flow

Plaid’s Link and token flow involves several steps: [web:1]

1. Your backend calls `/link/token/create` to generate a short-lived `link_token` using your configuration (products, country codes, etc.). [web:1]
2. The frontend initializes Plaid Link with the `link_token`; after the user completes login, Link returns a `public_token` via `onSuccess`. [web:1]
3. The backend calls `/item/public_token/exchange` to exchange the `public_token` for a long-lived `access_token` and `item_id`. [web:1]
4. The backend stores the `access_token` securely and uses it for future API requests related to that Item. [web:1]

---

## Example Backend Endpoints (Node)

- Create link token endpoint (`/api/create_link_token`): [web:1]  
  - Uses the Plaid client to call `linkTokenCreate` with user information, products, language, redirect URI, and country codes.  
  - Returns the `link_token` to the frontend.

- Exchange public token endpoint (`/api/exchange_public_token` or similar): [web:1]  
  - Accepts `public_token` from the client request body.  
  - Calls `itemPublicTokenExchange` to obtain `access_token` and `item_id`.  
  - Persists these values and returns a success response.

---

## Example Frontend Flow (React)

- On app load, the frontend calls `/api/create_link_token` to get the `link_token` and stores it in state. [web:1]
- A Link component uses `usePlaidLink` (React hook) with the `link_token` and an `onSuccess` callback. [web:1]
- In `onSuccess`, the frontend sends the `public_token` to the backend endpoint (`/api/set_access_token` or similar) to complete the exchange. [web:1]

---

## Making API Requests

- After storing the `access_token`, the backend can call Plaid APIs like `/accounts/get` to retrieve account metadata and balances. [web:1]
- A typical Node route for `/api/accounts` calls `client.accountsGet({ access_token })` and returns the response JSON to the client. [web:1]
- The response includes an array of accounts and an `item` object with metadata such as institution, billed products, and webhook. [web:1]

---

## Next Steps and Resources

- Explore the main Plaid docs homepage for product-specific guides and references. [web:1]
- Review additional sample apps for minimal Quickstart examples and real-world scenarios like funds transfer and PFM. [web:1]
- Watch “Plaid in 3 minutes” and Plaid Academy playlists on YouTube for short product overviews and deeper tutorials. [web:1]
- For partner-based money movement (for example with Dwolla), see Plaid’s partner Quickstarts. [web:1]
- For mobile apps, read the Plaid Link mobile documentation for iOS and Android setup. [web:1]
- If you lack internal engineering resources, consider Plaid integration partners for implementation support. [web:1]
