const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://localhost:3000",
  maxPagesPerSync: 10,
};

function byId(id) {
  return document.getElementById(id);
}

function setMessage(text, type) {
  const node = byId("saveMessage");
  node.textContent = text || "";
  node.classList.remove("error", "success");
  if (type) {
    node.classList.add(type);
  }
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

function fillForm(settings) {
  byId("apiBaseUrl").value = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
  byId("maxPagesPerSync").value = String(settings.maxPagesPerSync || DEFAULT_SETTINGS.maxPagesPerSync);
}

async function loadSettings() {
  const response = await sendMessage({ type: "GET_STATUS" });
  fillForm(response.settings || DEFAULT_SETTINGS);
}

async function saveSettings(event) {
  event.preventDefault();

  const apiBaseUrl = byId("apiBaseUrl").value.trim();
  const maxPagesPerSync = Number(byId("maxPagesPerSync").value);

  if (!apiBaseUrl) {
    setMessage("API Base URL is required", "error");
    return;
  }

  if (!Number.isInteger(maxPagesPerSync) || maxPagesPerSync < 1 || maxPagesPerSync > 50) {
    setMessage("Max pages must be between 1 and 50", "error");
    return;
  }

  try {
    const response = await sendMessage({
      type: "UPDATE_SETTINGS",
      settings: { apiBaseUrl, maxPagesPerSync },
    });

    fillForm(response.settings || DEFAULT_SETTINGS);
    setMessage("Settings saved", "success");
  } catch (error) {
    setMessage(`Failed to save: ${error.message}`, "error");
  }
}

async function resetDefaults() {
  try {
    const response = await sendMessage({
      type: "UPDATE_SETTINGS",
      settings: { ...DEFAULT_SETTINGS },
    });

    fillForm(response.settings || DEFAULT_SETTINGS);
    setMessage("Defaults restored", "success");
  } catch (error) {
    setMessage(`Failed to reset: ${error.message}`, "error");
  }
}

function init() {
  byId("settingsForm").addEventListener("submit", saveSettings);
  byId("resetDefaults").addEventListener("click", resetDefaults);

  loadSettings().catch((error) => {
    setMessage(`Failed to load settings: ${error.message}`, "error");
  });
}

init();
