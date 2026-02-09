const AMAZON_ORDER_HISTORY_URL = "https://www.amazon.com/gp/your-account/order-history";
let latestPayload = null;

function byId(id) {
  return document.getElementById(id);
}

function formatTime(value) {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }
  return date.toLocaleString();
}

function shortInstallId(value) {
  if (!value) {
    return "-";
  }
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function setRunningState(running) {
  byId("syncNow").disabled = running;
  byId("syncNow").textContent = running ? "Syncing..." : "Sync Now";
}

function renderStatus(payload) {
  latestPayload = {
    ...(latestPayload || {}),
    ...(payload || {}),
  };

  const status = latestPayload?.status || {};
  const state = latestPayload?.state || {};
  const settings = latestPayload?.settings || {};

  byId("statusText").textContent = status.message || "Ready";
  byId("installId").textContent = shortInstallId(latestPayload?.installId);
  byId("apiBaseUrl").textContent = settings.apiBaseUrl || "-";
  byId("lastSyncAt").textContent = formatTime(state.lastSyncAt);
  byId("lastSyncedOrders").textContent = String(state.lastSyncedOrders || 0);

  const errorNode = byId("lastError");
  if (state.lastSyncStatus === "error" && state.lastSyncError) {
    errorNode.textContent = state.lastSyncError;
    errorNode.classList.remove("hidden");
  } else {
    errorNode.textContent = "";
    errorNode.classList.add("hidden");
  }

  setRunningState(Boolean(status.running));
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown extension error"));
        return;
      }

      resolve(response);
    });
  });
}

async function refreshStatus() {
  const response = await sendMessage({ type: "GET_STATUS" });
  renderStatus(response);
  return response;
}

async function runSync() {
  setRunningState(true);
  byId("statusText").textContent = "Starting sync...";

  try {
    const response = await sendMessage({ type: "START_SYNC" });
    renderStatus(response);
  } catch (error) {
    byId("statusText").textContent = `Sync failed: ${error.message}`;
    setRunningState(false);
  }
}

async function openIntake() {
  const response = await refreshStatus();
  const base = String(response?.settings?.apiBaseUrl || "http://localhost:3000").replace(/\/$/, "");
  const intakePath = response?.settings?.intakePath || "/intake?source=amazon_extension";
  const url = `${base}${intakePath.startsWith("/") ? "" : "/"}${intakePath}`;
  await chrome.tabs.create({ url });
}

async function init() {
  byId("syncNow").addEventListener("click", runSync);

  byId("openOrders").addEventListener("click", () => {
    chrome.tabs.create({ url: AMAZON_ORDER_HISTORY_URL });
  });

  byId("openIntake").addEventListener("click", () => {
    openIntake().catch((error) => {
      byId("statusText").textContent = `Cannot open Intake: ${error.message}`;
    });
  });

  byId("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "STATUS_UPDATE" && message.status) {
      renderStatus({ status: message.status });
    }
  });

  try {
    await refreshStatus();
  } catch (error) {
    byId("statusText").textContent = `Failed to load status: ${error.message}`;
  }
}

init();
