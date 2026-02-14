const STORAGE_KEYS = {
  settings: "fd_amazon_itemizer_settings",
  state: "fd_amazon_itemizer_state",
  token: "fd_amazon_itemizer_token",
  installId: "fd_amazon_itemizer_install_id",
};

const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://localhost:3002",
  maxPagesPerSync: 10,
  intakePath: "/intake?source=amazon_extension",
};

const ORDER_HISTORY_URL = "https://www.amazon.com/gp/your-account/order-history";
const MAX_ALLOWED_PAGES = 50;
const INGEST_BATCH_SIZE = 25;
const MAX_DETAIL_ENRICHMENT_PER_SYNC = 20;

let runtimeStatus = {
  running: false,
  phase: "idle",
  message: "Ready",
  updatedAt: new Date().toISOString(),
};

function defaultSyncState() {
  return {
    syncCursor: null,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    lastSyncedOrders: 0,
    lastPagesScanned: 0,
  };
}

function normalizeApiBaseUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SETTINGS.apiBaseUrl;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getStorageValue(key) {
  const result = await chrome.storage.local.get(key);
  return result[key];
}

async function setStorageValue(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function getSettings() {
  const stored = (await getStorageValue(STORAGE_KEYS.settings)) || {};
  const merged = {
    ...DEFAULT_SETTINGS,
    ...stored,
  };

  merged.apiBaseUrl = normalizeApiBaseUrl(merged.apiBaseUrl);
  merged.maxPagesPerSync = Math.min(
    MAX_ALLOWED_PAGES,
    Math.max(1, Number(merged.maxPagesPerSync || DEFAULT_SETTINGS.maxPagesPerSync))
  );

  return merged;
}

async function setSettings(nextSettings) {
  const normalized = {
    ...DEFAULT_SETTINGS,
    ...nextSettings,
    apiBaseUrl: normalizeApiBaseUrl(nextSettings.apiBaseUrl),
    maxPagesPerSync: Math.min(
      MAX_ALLOWED_PAGES,
      Math.max(1, Number(nextSettings.maxPagesPerSync || DEFAULT_SETTINGS.maxPagesPerSync))
    ),
  };

  await setStorageValue(STORAGE_KEYS.settings, normalized);
  return normalized;
}

async function getState() {
  return (await getStorageValue(STORAGE_KEYS.state)) || defaultSyncState();
}

async function setState(patch) {
  const current = await getState();
  const next = {
    ...current,
    ...patch,
  };
  await setStorageValue(STORAGE_KEYS.state, next);
  return next;
}

async function resetSyncState(options = {}) {
  const clearToken = Boolean(options.clearToken);
  await setStorageValue(STORAGE_KEYS.state, defaultSyncState());

  if (clearToken) {
    await chrome.storage.local.remove(STORAGE_KEYS.token);
  }

  statusWithPatch({
    running: false,
    phase: "idle",
    message: clearToken ? "Sync cursor and token reset" : "Sync cursor reset",
  });

  return getCompositeStatus();
}

function createInstallId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `install_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

async function ensureInstallId() {
  const existing = await getStorageValue(STORAGE_KEYS.installId);
  if (existing) {
    return existing;
  }
  const created = createInstallId();
  await setStorageValue(STORAGE_KEYS.installId, created);
  return created;
}

function statusWithPatch(patch) {
  runtimeStatus = {
    ...runtimeStatus,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  chrome.runtime.sendMessage({
    type: "STATUS_UPDATE",
    status: runtimeStatus,
  }).catch(() => {
    // Popup might not be open; ignore send errors.
  });

  return runtimeStatus;
}

function toOriginPattern(apiBaseUrl) {
  const parsed = new URL(apiBaseUrl);
  return `${parsed.protocol}//${parsed.host}/*`;
}

async function ensureApiHostPermission(apiBaseUrl) {
  const originPattern = toOriginPattern(apiBaseUrl);
  const contains = await chrome.permissions.contains({ origins: [originPattern] });
  if (contains) {
    return;
  }

  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error(`Permission denied for API host: ${originPattern}`);
  }
}

function tokenIsFresh(tokenRecord) {
  if (!tokenRecord || !tokenRecord.token || !tokenRecord.expiresAt) {
    return false;
  }

  const expiresAt = new Date(tokenRecord.expiresAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > fiveMinutes;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Ignore parse failures and fall through to status check.
  }

  if (!response.ok) {
    const message = (data && data.error) || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

async function requestNewToken(apiBaseUrl, installId) {
  const tokenResponse = await fetchJson(`${apiBaseUrl}/api/intake/sources/amazon/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ install_id: installId }),
  });

  if (!tokenResponse || !tokenResponse.token) {
    throw new Error("Token endpoint did not return a token");
  }

  const tokenRecord = {
    token: tokenResponse.token,
    tokenType: tokenResponse.token_type || "Bearer",
    expiresAt: tokenResponse.expires_at || null,
    installId,
  };

  await setStorageValue(STORAGE_KEYS.token, tokenRecord);
  return tokenRecord;
}

async function ensureIngestToken(apiBaseUrl) {
  const installId = await ensureInstallId();
  const existing = await getStorageValue(STORAGE_KEYS.token);

  if (tokenIsFresh(existing) && existing.installId === installId) {
    return existing;
  }

  return requestNewToken(apiBaseUrl, installId);
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for page load"));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) {
        return;
      }
      if (changeInfo.status !== "complete") {
        return;
      }

      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function scrapeCurrentPage(tabId, attempt = 0) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "SCRAPE_ORDER_HISTORY_PAGE",
    });

    if (!response || !response.ok) {
      const message = (response && response.error) || "Failed to scrape order page";
      throw new Error(message);
    }

    return response;
  } catch (error) {
    if (attempt >= 4) {
      throw error;
    }
    await delay(400 * (attempt + 1));
    return scrapeCurrentPage(tabId, attempt + 1);
  }
}

async function scrapeOrderDetailsPage(tabId, orderId, attempt = 0) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "SCRAPE_ORDER_DETAILS_PAGE",
      order_id: orderId,
    });

    if (!response || !response.ok || !response.order) {
      const message = (response && response.error) || `Failed to scrape order details for ${orderId}`;
      throw new Error(message);
    }

    return response.order;
  } catch (error) {
    if (attempt >= 4) {
      throw error;
    }
    await delay(400 * (attempt + 1));
    return scrapeOrderDetailsPage(tabId, orderId, attempt + 1);
  }
}

function compareOrderKeys(a, b) {
  if (a.order_date > b.order_date) {
    return -1;
  }
  if (a.order_date < b.order_date) {
    return 1;
  }
  if (a.provider_order_id > b.provider_order_id) {
    return -1;
  }
  if (a.provider_order_id < b.provider_order_id) {
    return 1;
  }
  return 0;
}

function filterOrdersByCursor(orders, cursor) {
  if (!cursor || !cursor.last_order_date || !cursor.last_order_id) {
    return { filtered: orders, stopReached: false };
  }

  const filtered = [];
  for (const order of orders) {
    if (order.order_date < cursor.last_order_date) {
      return { filtered, stopReached: true };
    }

    if (
      order.order_date === cursor.last_order_date &&
      order.provider_order_id === cursor.last_order_id
    ) {
      return { filtered, stopReached: true };
    }

    filtered.push(order);
  }

  return { filtered, stopReached: false };
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function uploadOrders(apiBaseUrl, tokenRecord, orders, syncCursor) {
  const chunks = chunkArray(orders, INGEST_BATCH_SIZE);
  let uploadedOrders = 0;

  for (const chunk of chunks) {
    const payload = {
      marketplace: "amazon.com",
      scraped_at: new Date().toISOString(),
      sync_cursor: syncCursor || null,
      orders: chunk,
    };

    const response = await fetchJson(`${apiBaseUrl}/api/intake/sources/amazon/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${tokenRecord.tokenType || "Bearer"} ${tokenRecord.token}`,
      },
      body: JSON.stringify(payload),
    });

    uploadedOrders += Number(response?.ingest?.upserted_orders || chunk.length);
  }

  return uploadedOrders;
}

function getNewestOrder(orders) {
  if (!orders.length) {
    return null;
  }

  const copy = [...orders];
  copy.sort(compareOrderKeys);
  return copy[0];
}

function normalizeOrderTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isGenericOrderItem(orderId, item) {
  const title = normalizeOrderTitle(item?.title);
  return title === `amazon order ${String(orderId || "").toLowerCase()}`;
}

function shouldEnrichOrder(order) {
  if (!Array.isArray(order?.items) || order.items.length === 0) {
    return true;
  }

  const nonGenericTitles = order.items.filter((item) => !isGenericOrderItem(order.provider_order_id, item));
  return nonGenericTitles.length === 0;
}

function getOrderDetailsUrl(order) {
  const raw = order?.raw_order_json;
  const fromRaw = raw && typeof raw.order_details_url === "string" ? raw.order_details_url : "";
  if (fromRaw) {
    return fromRaw;
  }

  return `https://www.amazon.com/gp/your-account/order-details?orderID=${encodeURIComponent(
    order.provider_order_id
  )}`;
}

function mergeOrderData(baseOrder, detailsOrder) {
  if (!detailsOrder) {
    return baseOrder;
  }

  const nextItems =
    Array.isArray(detailsOrder.items) && detailsOrder.items.length > 0
      ? detailsOrder.items
      : baseOrder.items;

  const nextRawOrderJson = {
    ...(baseOrder.raw_order_json || {}),
    ...(detailsOrder.raw_order_json || {}),
    order_details_url: getOrderDetailsUrl(baseOrder),
  };

  return {
    ...baseOrder,
    ...detailsOrder,
    items: nextItems,
    raw_order_json: nextRawOrderJson,
  };
}

async function enrichOrdersWithDetails(tabId, orders) {
  const candidates = orders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => shouldEnrichOrder(order))
    .slice(0, MAX_DETAIL_ENRICHMENT_PER_SYNC);

  if (!candidates.length) {
    return {
      orders,
      enrichedOrders: 0,
    };
  }

  const nextOrders = [...orders];
  let enrichedOrders = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const { order, index } = candidates[i];
    const detailsUrl = getOrderDetailsUrl(order);

    try {
      statusWithPatch({
        phase: "scrape",
        message: `Enriching order details ${i + 1}/${candidates.length}`,
      });

      await chrome.tabs.update(tabId, { url: detailsUrl });
      await waitForTabComplete(tabId);
      const detailedOrder = await scrapeOrderDetailsPage(tabId, order.provider_order_id);
      nextOrders[index] = mergeOrderData(order, detailedOrder);
      enrichedOrders += 1;
      await delay(250);
    } catch {
      // Keep original order payload if details scraping fails.
    }
  }

  return {
    orders: nextOrders,
    enrichedOrders,
  };
}

async function syncAmazonOrders() {
  if (runtimeStatus.running) {
    throw new Error("Sync is already running");
  }

  statusWithPatch({
    running: true,
    phase: "starting",
    message: "Starting sync",
  });

  const settings = await getSettings();
  const previousState = await getState();
  const seenOrderIds = new Set();
  const collectedOrders = [];

  let pagesScanned = 0;
  let tabId = null;

  try {
    await ensureApiHostPermission(settings.apiBaseUrl);

    statusWithPatch({
      phase: "auth",
      message: "Refreshing ingest token",
    });

    const tokenRecord = await ensureIngestToken(settings.apiBaseUrl);

    statusWithPatch({
      phase: "scrape",
      message: "Opening Amazon order history",
    });

    const tab = await chrome.tabs.create({
      url: ORDER_HISTORY_URL,
      active: false,
    });

    if (!tab.id) {
      throw new Error("Failed to create background tab for sync");
    }
    tabId = tab.id;

    let nextPageUrl = ORDER_HISTORY_URL;
    let stopReached = false;

    for (let page = 1; page <= settings.maxPagesPerSync; page += 1) {
      pagesScanned = page;

      if (page === 1) {
        await waitForTabComplete(tabId);
      } else {
        await chrome.tabs.update(tabId, { url: nextPageUrl });
        await waitForTabComplete(tabId);
      }

      statusWithPatch({
        phase: "scrape",
        message: `Scraping page ${page}`,
      });

      const scraped = await scrapeCurrentPage(tabId);
      const orders = Array.isArray(scraped.orders) ? scraped.orders : [];

      const { filtered, stopReached: cursorStop } = filterOrdersByCursor(
        orders,
        previousState.syncCursor || null
      );

      for (const order of filtered) {
        if (seenOrderIds.has(order.provider_order_id)) {
          continue;
        }
        seenOrderIds.add(order.provider_order_id);
        collectedOrders.push(order);
      }

      if (cursorStop) {
        stopReached = true;
      }

      if (stopReached || !scraped.next_page_url) {
        break;
      }

      nextPageUrl = scraped.next_page_url;
    }

    let ordersForUpload = collectedOrders;
    let enrichedOrders = 0;

    if (tabId && ordersForUpload.length > 0) {
      const enriched = await enrichOrdersWithDetails(tabId, ordersForUpload);
      ordersForUpload = enriched.orders;
      enrichedOrders = enriched.enrichedOrders;
    }

    statusWithPatch({
      phase: "upload",
      message: ordersForUpload.length
        ? `Uploading ${ordersForUpload.length} order(s)${
            enrichedOrders > 0 ? ` (${enrichedOrders} enriched from order details)` : ""
          }`
        : "No new orders found",
    });

    let uploadedOrders = 0;
    if (ordersForUpload.length > 0) {
      uploadedOrders = await uploadOrders(
        settings.apiBaseUrl,
        tokenRecord,
        ordersForUpload,
        previousState.syncCursor || null
      );
    }

    const newest = getNewestOrder(ordersForUpload);
    const nextCursor = newest
      ? {
          last_order_id: newest.provider_order_id,
          last_order_date: newest.order_date,
          page: null,
        }
      : previousState.syncCursor || null;

    const updatedState = await setState({
      syncCursor: nextCursor,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "success",
      lastSyncError: null,
      lastSyncedOrders: uploadedOrders,
      lastPagesScanned: pagesScanned,
    });

    statusWithPatch({
      running: false,
      phase: "idle",
      message: `Sync complete: ${uploadedOrders} order(s)`,
    });

    return {
      status: runtimeStatus,
      state: updatedState,
      settings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";

    const updatedState = await setState({
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "error",
      lastSyncError: message,
      lastSyncedOrders: 0,
      lastPagesScanned: pagesScanned,
    });

    statusWithPatch({
      running: false,
      phase: "idle",
      message: `Sync failed: ${message}`,
    });

    return {
      status: runtimeStatus,
      state: updatedState,
      settings: await getSettings(),
    };
  } finally {
    if (tabId) {
      await chrome.tabs.remove(tabId).catch(() => {
        // Ignore close errors.
      });
    }
  }
}

async function getCompositeStatus() {
  const [settings, state, installId] = await Promise.all([
    getSettings(),
    getState(),
    ensureInstallId(),
  ]);

  return {
    status: runtimeStatus,
    settings,
    state,
    installId,
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureInstallId();
  const settings = await getSettings();
  await setSettings(settings);
  await getState();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "GET_STATUS": {
        sendResponse({ ok: true, ...(await getCompositeStatus()) });
        break;
      }

      case "START_SYNC": {
        const result = await syncAmazonOrders();
        sendResponse({ ok: true, ...result });
        break;
      }

      case "UPDATE_SETTINGS": {
        const nextSettings = await setSettings(message.settings || {});
        sendResponse({ ok: true, settings: nextSettings });
        break;
      }

      case "OPEN_OPTIONS": {
        await chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      }

      case "RESET_SYNC_CURSOR": {
        const result = await resetSyncState({
          clearToken: Boolean(message?.clearToken),
        });
        sendResponse({ ok: true, ...result });
        break;
      }

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })().catch((error) => {
    const messageText = error instanceof Error ? error.message : "Unexpected extension error";
    sendResponse({ ok: false, error: messageText });
  });

  return true;
});
