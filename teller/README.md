# Teller Testing Setup

This directory contains the Teller examples used only for testing bank connections for this project. It does **not** integrate directly with the Next.js app.

## Prerequisites

- Repo cloned at: `teller/examples`
- Local env variables defined in `.env.local` at the project root:
  - `TELLER_APP_ID=...`
  - `TELLER_CERT_PATH=/Users/<your-username>/CascadeProjects/financialdashboard/teller/certs`
- TLS files at `TELLER_CERT_PATH` (not committed to git):
  - `certificate.pem`
  - `private_key.pem`

## Load env vars into your shell

From the project root (`financialdashboard`):

```bash
set -a
source .env.local
set +a
```

This makes `TELLER_APP_ID` and `TELLER_CERT_PATH` available in your current shell session.

## Run Teller (Sandbox Mode)

From the project root:

```bash
cd teller/examples
APP_ID="$TELLER_APP_ID" make
```

- Uses Teller's sandbox environment.
- Links to fake institutions/accounts for safe testing.

## Run Teller (Development / Real Bank Accounts)

Only run this when you want to connect real bank accounts.

From the project root:

```bash
cd teller/examples
APP_ID="$TELLER_APP_ID" \
CERT="$TELLER_CERT_PATH/certificate.pem" \
CERT_KEY="$TELLER_CERT_PATH/private_key.pem" \
ENV=development \
make
```

- Uses your real Teller app in development mode.
- Uses your local cert + key from `TELLER_CERT_PATH`.

## Notes

- This setup is isolated from the main Next.js app.
- Do **not** commit your certs or private keys to git.
- You can adjust `TELLER_CERT_PATH` in `.env.local` if you move the certs.
