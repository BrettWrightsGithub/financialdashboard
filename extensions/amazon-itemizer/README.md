# Financial Dashboard Amazon Itemizer (Local Unpacked)

This Chrome extension scrapes Amazon order history pages and uploads normalized orders to:

- `POST /api/intake/sources/amazon/token`
- `POST /api/intake/sources/amazon/ingest`

It supports pagination and incremental sync using a stored cursor (`last_order_date` + `last_order_id`).

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/extensions/amazon-itemizer`

## Configure

1. Click the extension icon, then click **Settings**.
2. Set **API Base URL** to your running app (default: `http://localhost:3002`).
3. Keep **Max Pages Per Sync** at a safe value like `10` while validating.

## Run a Sync

1. Sign into Amazon in the same Chrome profile.
2. Open the extension popup.
3. Click **Sync Now**.
4. Open Intake from popup (**Open Intake**) to review uploaded orders.

If you cleared Amazon intake data and need to re-import old orders, click **Reset Sync Cursor** in the popup first, then run **Sync Now**.

During sync, the extension opens a temporary Amazon Orders tab in the background and closes it automatically when finished.
When order-history rows do not include item names, the extension now opens order-details pages in the same background tab to enrich item titles and product metadata before upload.

## Notes

- V1 target is `amazon.com` only.
- If you use a non-localhost API host, Chrome asks permission the first time.
- Refund/return extraction is not included in this version.
