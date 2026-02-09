const ORDER_ID_REGEX = /\b\d{3}-\d{7}-\d{7}\b/;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseMoney(value) {
  const normalized = normalizeWhitespace(value).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(Math.abs(parsed) * 100) / 100;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function extractOrderId(value) {
  const text = String(value || "");
  const match = text.match(ORDER_ID_REGEX);
  return match ? match[0] : null;
}

function parseOrderDate(containerText) {
  const normalized = normalizeWhitespace(containerText);
  const match = normalized.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i
  );

  if (!match) {
    return null;
  }

  const parsed = new Date(match[0]);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function extractOrderTotal(containerText) {
  const normalized = normalizeWhitespace(containerText);

  const orderTotalMatch = normalized.match(/order total[^$]*\$\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (orderTotalMatch) {
    return parseMoney(orderTotalMatch[1]);
  }

  const fallbackMoneyMatch = normalized.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/);
  return fallbackMoneyMatch ? parseMoney(fallbackMoneyMatch[1]) : null;
}

function findOrderContainer(node) {
  let current = node;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current) {
      break;
    }

    const text = normalizeWhitespace(current.innerText || "");
    if (
      text.length > 100 &&
      text.length < 15000 &&
      /order\s*(#|id|total)|ordered on|arriving/i.test(text)
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return node.closest("div") || document.body;
}

function pushUnique(target, value) {
  if (!value) {
    return;
  }
  if (!target.includes(value)) {
    target.push(value);
  }
}

function extractItemTitles(container) {
  const titles = [];

  const selectors = [
    'a[href*="/dp/"]',
    'a[href*="/gp/product/"]',
    "span.a-truncate-full",
    "span.a-size-base-plus",
    "img[alt]",
  ];

  for (const selector of selectors) {
    const nodes = container.querySelectorAll(selector);
    for (const node of nodes) {
      const rawTitle = node.getAttribute("alt") || node.textContent || "";
      const title = normalizeWhitespace(rawTitle);

      if (title.length < 4) {
        continue;
      }
      if (/amazon|visit the store|buy it again|write a review/i.test(title)) {
        continue;
      }

      pushUnique(titles, title);
      if (titles.length >= 12) {
        return titles;
      }
    }
  }

  return titles;
}

function buildItems(orderId, titles, orderTotal) {
  const lineTitles = titles.length ? titles : [`Amazon order ${orderId}`];

  const fallbackTotal = orderTotal && orderTotal > 0 ? orderTotal : 0.01 * lineTitles.length;
  const evenTotal = roundMoney(fallbackTotal / lineTitles.length);

  return lineTitles.map((title) => ({
    title,
    quantity: 1,
    unit_price: evenTotal,
    line_total: evenTotal,
  }));
}

function getNextPageUrl() {
  const anchors = Array.from(document.querySelectorAll("a[href]"));

  for (const anchor of anchors) {
    const text = normalizeWhitespace(anchor.textContent || "").toLowerCase();
    const aria = normalizeWhitespace(anchor.getAttribute("aria-label") || "").toLowerCase();

    if (!text.includes("next") && !aria.includes("next")) {
      continue;
    }

    const parentClass = normalizeWhitespace(anchor.parentElement?.className || "").toLowerCase();
    const ownClass = normalizeWhitespace(anchor.className || "").toLowerCase();
    if (parentClass.includes("disabled") || ownClass.includes("disabled")) {
      continue;
    }

    try {
      return new URL(anchor.href, window.location.href).toString();
    } catch {
      // Ignore malformed links.
    }
  }

  return null;
}

function getPageNumber() {
  const selected = document.querySelector(".a-pagination .a-selected");
  const parsed = Number(normalizeWhitespace(selected?.textContent || ""));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractOrdersFromPage() {
  const linkCandidates = Array.from(document.querySelectorAll('a[href*="orderID="]')).concat(
    Array.from(document.querySelectorAll("a[href*='order-details']"))
  );

  const linksByOrderId = new Map();
  for (const link of linkCandidates) {
    const orderId = extractOrderId(link.href) || extractOrderId(link.textContent);
    if (!orderId) {
      continue;
    }

    if (!linksByOrderId.has(orderId)) {
      linksByOrderId.set(orderId, link);
    }
  }

  const orders = [];

  for (const [orderId, seedLink] of linksByOrderId.entries()) {
    const container = findOrderContainer(seedLink);
    const containerText = normalizeWhitespace(container?.innerText || "");

    const orderDate = parseOrderDate(containerText);
    const orderTotal = extractOrderTotal(containerText);

    if (!orderDate || !orderTotal || orderTotal <= 0) {
      continue;
    }

    const titles = extractItemTitles(container);
    const items = buildItems(orderId, titles, orderTotal);

    orders.push({
      provider_order_id: orderId,
      order_date: orderDate,
      order_total: orderTotal,
      currency: "USD",
      merchant_name: "Amazon",
      items,
      raw_order_json: {
        source_page_url: window.location.href,
        page_title: document.title,
        snippet: containerText.slice(0, 2500),
      },
    });
  }

  orders.sort((a, b) => {
    if (a.order_date > b.order_date) {
      return -1;
    }
    if (a.order_date < b.order_date) {
      return 1;
    }
    return a.provider_order_id > b.provider_order_id ? -1 : 1;
  });

  return {
    ok: true,
    marketplace: "amazon.com",
    page_number: getPageNumber(),
    next_page_url: getNextPageUrl(),
    url: window.location.href,
    orders,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SCRAPE_ORDER_HISTORY_PAGE") {
    return false;
  }

  try {
    const result = extractOrdersFromPage();

    if (!/amazon\.com\/.*(order-history|your-orders|order-details)/i.test(window.location.href)) {
      sendResponse({
        ok: false,
        error: "Open Amazon order history before syncing.",
      });
      return true;
    }

    sendResponse(result);
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to scrape orders",
    });
  }

  return true;
});
