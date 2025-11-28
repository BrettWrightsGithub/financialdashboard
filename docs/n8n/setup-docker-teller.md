# n8n Docker Setup with Teller mTLS

This guide explains how to run n8n locally using Docker and configure it to communicate with Teller's API using Mutual TLS (mTLS) certificates.

## 1. Prepare Certificates
You need the `certificate.pem` and `private_key.pem` files provided by Teller when you created your API token.

1.  Navigate to: `Projects/FinancialDashboard/docker/n8n/certs/`
2.  Place your **Teller Certificate** file here and rename it to `teller-certificate.pem`.
3.  Place your **Teller Private Key** file here and rename it to `teller-key.pem`.

**Security Note:** These files grant access to your banking data. Ensure this folder is **NOT** committed to git (it should be in `.gitignore`).

## 2. Start n8n
Open a terminal in the `docker/n8n` directory and start the container:

```powershell
cd docker/n8n
docker-compose up -d
```

- Access n8n at: `http://localhost:5678`
- You can stop it later with: `docker-compose down`

## 3. Configure Teller Node in n8n
When building **Workflow 1 (Teller Sync)**, configure the **HTTP Request Node** as follows:

### Authentication
- **Authentication:** Predefined Credential Type
- **Credential Type:** Basic Auth
- **Username:** `Your_Teller_Access_Token` (from Teller dashboard)
- **Password:** *(Leave Empty)*

### SSL/mTLS Configuration
Scroll down to **Options** at the bottom of the node:
1.  Click **Add Option** -> **SSL/TLS**.
2.  **P12/PFX:** (Leave empty/off)
3.  **Passphrase:** (Leave empty/off)
4.  **Certificate Authority File:** (Leave empty/off)
5.  **Certificate File:** `/certs/teller-certificate.pem`
6.  **Key File:** `/certs/teller-key.pem`

*Note: The path starts with `/certs/...` because that is where we mounted the folder inside the Docker container.*

## Troubleshooting
If you get `ECONNRESET` or "Socket Hang Up":
1.  Verify the filenames in `/certs/` match exactly what you typed in n8n.
2.  Ensure the keys correspond to the Access Token you are using (Teller keys are often scoped to specific tokens/environments).
