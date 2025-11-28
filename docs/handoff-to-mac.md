# Handoff Instructions: Moving to Mac

**Current Status:**
- n8n is set up with Docker.
- Teller certificates are working for mTLS.
- "Workflow 1" (Teller Sync) documentation is updated.
- "Workflow 2" (Plaid Sync) documentation is updated.
- Access Token for Teller (Chase) has been generated.

## 1. Transfer Sensitive Files
The following files are **ignored by Git** for security. You must manually transfer them to your Mac (USB, Secure Note, etc.):

1.  `docker/n8n/certs/teller-certificate.pem`
2.  `docker/n8n/certs/teller-key.pem`
3.  `teller-token.json` (Contains your Access Token)
4.  `.env.local` (If it contains secrets)

## 2. Setup on Mac
1.  Clone the repository:
    ```bash
    git clone <repo-url>
    cd FinancialDashboard
    ```
2.  Create the certs directory:
    ```bash
    mkdir -p docker/n8n/certs
    ```
3.  **Place the `.pem` files** into `docker/n8n/certs/`.
4.  Start n8n:
    ```bash
    cd docker/n8n
    docker-compose up -d
    ```

## 3. Restore n8n Configuration
Since the n8n database isn't synced:
1.  Open `http://localhost:5678`.
2.  Go to **Credentials**.
3.  Create a **Basic Auth** credential.
    - **User:** (Paste the Access Token from `teller-token.json`)
    - **Password:** (Leave empty)
    - **Name:** "Teller API"

## 4. Resume Workflow Building
1.  Open `docs/n8n/workflow-01-teller-sync.md`.
2.  Build the nodes in n8n following that guide.
    - Remember to set the **SSL/TLS Options** in the HTTP Request node to point to `/certs/teller-certificate.pem` and `/certs/teller-key.pem`.
