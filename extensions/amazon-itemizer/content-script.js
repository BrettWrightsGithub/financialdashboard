const ORDER_ID_REGEX = /\b\d{3}-\d{7}-\d{7}\b/;
const ASIN_REGEX = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i;

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

function extractMoneyValues(value) {
  const text = normalizeWhitespace(value);
  const matches = text.match(/\$\s*[0-9,]+(?:\.[0-9]{2})?/g) || [];
  const parsed = [];

  for (const match of matches) {
    const amount = parseMoney(match);
    if (amount !== null && amount > 0) {
      parsed.push(amount);
    }
  }

  return parsed;
}

function extractOrderId(value) {
  const text = String(value || "");
  const match = text.match(ORDER_ID_REGEX);
  return match ? match[0] : null;
}

function extractOrderIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    const fromQuery = extractOrderId(url.searchParams.get("orderID") || "");
    if (fromQuery) {
      return fromQuery;
    }
    return extractOrderId(url.href);
  } catch {
    return extractOrderId(value);
  }
}

function parseAsinFromHref(value) {
  const text = String(value || "");
  const match = text.match(ASIN_REGEX);
  return match ? match[1].toUpperCase() : null;
}

function parseQuantity(value) {
  const text = normalizeWhitespace(value);
  const qtyMatch = text.match(/(?:qty|quantity)\s*[:x]?\s*(\d{1,3})/i);
  if (qtyMatch) {
    const parsed = Number(qtyMatch[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  return 1;
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

  const orderedPatterns = [
    /grand total[^$]*\$\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    /order total[^$]*\$\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    /total before tax[^$]*\$\s*([0-9,]+(?:\.[0-9]{2})?)/i,
  ];

  for (const pattern of orderedPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = parseMoney(match[1]);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  const amounts = extractMoneyValues(normalized);
  if (!amounts.length) {
    return null;
  }

  const largest = Math.max(...amounts);
  return largest > 0 ? largest : null;
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
      /order\s*(#|id|total)|ordered on|arriving|items in this order/i.test(text)
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return node.closest("div") || document.body;
}

function findItemContainer(node, root) {
  let current = node;
  for (let depth = 0; depth < 7; depth += 1) {
    if (!current || current === root || current === document.body) {
      break;
    }

    const text = normalizeWhitespace(current.innerText || "");
    if (text.length >= 30 && text.length <= 3500) {
      return current;
    }

    current = current.parentElement;
  }

  return node;
}

function pushUnique(target, value) {
  if (!value) {
    return;
  }
  if (!target.includes(value)) {
    target.push(value);
  }
}

function cleanTitleCandidate(value) {
  return normalizeWhitespace(String(value || ""))
    .replace(/^image of\s+/i, "")
    .replace(/^product image of\s+/i, "")
    .replace(/^item:\s+/i, "");
}

function isLikelyProductTitle(value) {
  const title = cleanTitleCandidate(value);
  if (!title || title.length < 5 || title.length > 260) {
    return false;
  }

  if (ORDER_ID_REGEX.test(title)) {
    return false;
  }

  if (!/[a-zA-Z]/.test(title)) {
    return false;
  }

  if (
    /^(buy it again|write a product review|return or replace items|track package|view invoice|order details|view or edit order|get product support|archive order|cancel items|delivered|arriving|shipped|order total|payment method|gift card|track your package|amazon day delivery|subscription|invoice)$/i.test(
      title
    )
  ) {
    return false;
  }

  if (
    /(visit the store|amazon\.com|free returns|sold by|leave seller feedback|eligible for return|items in this order|placed on|track shipment)/i.test(
      title
    )
  ) {
    return false;
  }

  return true;
}

function isLikelyGenericOrderTitle(orderId, title) {
  const normalizedTitle = cleanTitleCandidate(title).toLowerCase();
  const normalizedOrderId = String(orderId || "").toLowerCase();
  return normalizedTitle === `amazon order ${normalizedOrderId}`;
}

function toAbsoluteUrl(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return null;
  }
}

function addCandidate(candidates, seenKeys, candidate) {
  if (!candidate || !candidate.title) {
    return;
  }

  const title = cleanTitleCandidate(candidate.title);
  if (!isLikelyProductTitle(title)) {
    return;
  }

  const key = title.toLowerCase();
  if (seenKeys.has(key)) {
    return;
  }

  seenKeys.add(key);
  candidates.push({
    title,
    quantity: Number.isInteger(candidate.quantity) && candidate.quantity > 0 ? candidate.quantity : 1,
    unit_price: candidate.unit_price !== null && candidate.unit_price !== undefined ? candidate.unit_price : null,
    line_total: candidate.line_total !== null && candidate.line_total !== undefined ? candidate.line_total : null,
    product_url: candidate.product_url || null,
    asin: candidate.asin || null,
    source: candidate.source || "unknown",
    snippet: candidate.snippet || null,
  });
}

function extractLineBasedItemCandidates(container, context) {
  const candidates = [];
  const lines = String(container?.innerText || "")
    .split("\n")
    .map((line) => cleanTitleCandidate(line))
    .filter(Boolean);

  for (const line of lines) {
    if (!isLikelyProductTitle(line)) {
      continue;
    }

    if (isLikelyGenericOrderTitle(context.orderId, line)) {
      continue;
    }

    candidates.push({
      title: line,
      quantity: 1,
      unit_price: null,
      line_total: null,
      product_url: null,
      asin: null,
      source: context.source,
      snippet: null,
    });

    if (candidates.length >= 12) {
      break;
    }
  }

  return candidates;
}

function extractItemCandidatesFromRows(container, context) {
  const candidates = [];
  const seenKeys = new Set();
  const rowSelectors = [
    "ul li",
    '[data-component*="item"]',
    '[id*="item"]',
    ".a-fixed-left-grid",
    ".a-box-group",
  ];

  const rows = [];
  for (const selector of rowSelectors) {
    for (const row of container.querySelectorAll(selector)) {
      const text = normalizeWhitespace(row.innerText || "");
      if (text.length < 25 || text.length > 5000) {
        continue;
      }
      rows.push(row);
    }
    if (rows.length >= 50) {
      break;
    }
  }

  for (const row of rows) {
    const anchors = row.querySelectorAll(
      'a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/gp/aw/d/"], a[href]'
    );

    for (const anchor of anchors) {
      const rawTitle =
        anchor.textContent ||
        anchor.getAttribute("title") ||
        anchor.getAttribute("aria-label") ||
        "";
      const title = cleanTitleCandidate(rawTitle);

      if (!isLikelyProductTitle(title) || isLikelyGenericOrderTitle(context.orderId, title)) {
        continue;
      }

      const href = toAbsoluteUrl(anchor.getAttribute("href") || anchor.href);
      const asin = parseAsinFromHref(href);
      const snippet = normalizeWhitespace(row.innerText || "").slice(0, 1200);
      const quantity = parseQuantity(snippet);
      const amounts = extractMoneyValues(snippet);
      const unitPrice = amounts.length ? amounts[0] : null;
      const lineTotal = quantity > 1 && unitPrice ? roundMoney(unitPrice * quantity) : amounts[amounts.length - 1] || null;

      addCandidate(candidates, seenKeys, {
        title,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        product_url: href,
        asin,
        source: context.source,
        snippet,
      });

      break;
    }

    if (candidates.length >= 20) {
      break;
    }
  }

  return candidates;
}

function extractItemCandidates(container, context) {
  const candidates = extractItemCandidatesFromRows(container, context);
  const seenKeys = new Set(candidates.map((candidate) => candidate.title.toLowerCase()));

  const anchorSelectors = [
    'a.a-link-normal[href*="/dp/"]',
    'a.a-link-normal[href*="/gp/product/"]',
    'a[href*="/dp/"]',
    'a[href*="/gp/product/"]',
    "a[href]",
  ];
  for (const selector of anchorSelectors) {
    const nodes = container.querySelectorAll(selector);
    for (const node of nodes) {
      const title = cleanTitleCandidate(
        node.textContent || node.getAttribute("title") || node.getAttribute("aria-label") || ""
      );
      if (!isLikelyProductTitle(title) || isLikelyGenericOrderTitle(context.orderId, title)) {
        continue;
      }

      const href = toAbsoluteUrl(node.getAttribute("href") || node.href);
      const asin = parseAsinFromHref(href);
      const itemContainer = findItemContainer(node, container);
      const snippet = normalizeWhitespace(itemContainer?.innerText || "").slice(0, 1200);
      const quantity = parseQuantity(snippet);
      const amounts = extractMoneyValues(snippet);
      const unitPrice = amounts.length ? amounts[0] : null;
      const lineTotal = quantity > 1 && unitPrice ? roundMoney(unitPrice * quantity) : (amounts.length ? amounts[amounts.length - 1] : null);

      addCandidate(candidates, seenKeys, {
        title,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        product_url: href,
        asin,
        source: context.source,
        snippet,
      });

      if (candidates.length >= 20) {
        return candidates;
      }
    }
  }

  const textSelectors = [
    ".yohtmlc-product-title",
    '[data-a-word-break="normal"]',
    "span.a-truncate-cut",
    "span.a-truncate-full",
    "span.a-size-base-plus.a-color-base",
    "span.a-size-base.a-color-base",
    "h5",
    "h6",
    "img[alt]",
  ];

  for (const selector of textSelectors) {
    const nodes = container.querySelectorAll(selector);
    for (const node of nodes) {
      const rawTitle = node.getAttribute("alt") || node.textContent || "";
      const title = cleanTitleCandidate(rawTitle);
      if (!isLikelyProductTitle(title) || isLikelyGenericOrderTitle(context.orderId, title)) {
        continue;
      }

      const itemContainer = findItemContainer(node, container);
      const snippet = normalizeWhitespace(itemContainer?.innerText || "").slice(0, 1200);
      const quantity = parseQuantity(snippet);
      const amounts = extractMoneyValues(snippet);
      const unitPrice = amounts.length ? amounts[0] : null;
      const lineTotal = quantity > 1 && unitPrice ? roundMoney(unitPrice * quantity) : (amounts.length ? amounts[amounts.length - 1] : null);

      addCandidate(candidates, seenKeys, {
        title,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        product_url: null,
        asin: null,
        source: context.source,
        snippet,
      });

      if (candidates.length >= 20) {
        return candidates;
      }
    }
  }

  if (!candidates.length) {
    for (const candidate of extractLineBasedItemCandidates(container, context)) {
      addCandidate(candidates, seenKeys, candidate);
      if (candidates.length >= 12) {
        break;
      }
    }
  }

  return candidates;
}

function distributeMissingLineTotals(orderTotal, items) {
  if (!items.length) {
    return [];
  }

  const safeTotal = orderTotal && orderTotal > 0 ? roundMoney(orderTotal) : null;
  const knownTotal = roundMoney(
    items.reduce((sum, item) => {
      if (item.line_total && item.line_total > 0) {
        return sum + item.line_total;
      }
      return sum;
    }, 0)
  );

  const missingIndexes = [];
  items.forEach((item, index) => {
    if (!item.line_total || item.line_total <= 0) {
      missingIndexes.push(index);
    }
  });

  if (!missingIndexes.length) {
    return items;
  }

  if (!safeTotal || safeTotal <= 0) {
    const fallback = roundMoney(0.01 * items.length);
    for (const index of missingIndexes) {
      items[index].line_total = roundMoney(fallback / missingIndexes.length);
    }
    return items;
  }

  const remaining = roundMoney(Math.max(safeTotal - knownTotal, 0));
  const perItem = roundMoney((remaining || safeTotal) / missingIndexes.length);

  let assigned = 0;
  for (let i = 0; i < missingIndexes.length; i += 1) {
    const index = missingIndexes[i];
    const isLast = i === missingIndexes.length - 1;
    const value = isLast
      ? roundMoney((remaining || safeTotal) - assigned)
      : perItem;
    const safeValue = value > 0 ? value : 0.01;

    items[index].line_total = safeValue;
    assigned = roundMoney(assigned + safeValue);
  }

  return items;
}

function buildItems(orderId, itemCandidates, orderTotal, sourceType) {
  const candidates = itemCandidates.length
    ? itemCandidates
    : [
        {
          title: `Amazon order ${orderId}`,
          quantity: 1,
          unit_price: orderTotal,
          line_total: orderTotal,
          product_url: null,
          asin: null,
          source: sourceType,
          snippet: null,
        },
      ];

  const normalized = candidates.map((item) => {
    const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    let lineTotal = item.line_total && item.line_total > 0 ? roundMoney(item.line_total) : null;
    let unitPrice = item.unit_price && item.unit_price > 0 ? roundMoney(item.unit_price) : null;

    if (!lineTotal && unitPrice) {
      lineTotal = roundMoney(unitPrice * quantity);
    }

    if (!unitPrice && lineTotal) {
      unitPrice = roundMoney(lineTotal / quantity);
    }

    return {
      title: item.title,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      raw_item_json: {
        source: item.source || sourceType,
        product_url: item.product_url || null,
        asin: item.asin || null,
        snippet: item.snippet || null,
      },
    };
  });

  distributeMissingLineTotals(orderTotal, normalized);

  for (const item of normalized) {
    if (!item.unit_price || item.unit_price <= 0) {
      item.unit_price = roundMoney((item.line_total || 0.01) / Math.max(1, item.quantity));
    }
    if (!item.line_total || item.line_total <= 0) {
      item.line_total = roundMoney(item.unit_price * item.quantity);
    }
  }

  return normalized;
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

function resolveOrderDetailsUrl(seedLink, orderId) {
  const href = seedLink?.href || seedLink?.getAttribute("href") || "";
  const absolute = toAbsoluteUrl(href);

  if (absolute && /order-details|orderID=/i.test(absolute)) {
    return absolute;
  }

  return `https://www.amazon.com/gp/your-account/order-details?orderID=${encodeURIComponent(orderId)}`;
}

function scoreDetailsContainer(node, orderId) {
  if (!node) {
    return -1;
  }

  const text = normalizeWhitespace(node.innerText || "");
  if (!text || text.length < 200) {
    return -1;
  }

  const containsOrderId = orderId && text.includes(orderId) ? 1 : 0;
  const itemLinks = node.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/gp/aw/d/"]').length;
  const genericLinks = node.querySelectorAll("a[href]").length;
  const listItems = node.querySelectorAll("li").length;
  const itemLanguage = /items in this order|buy it again|sold by|free returns/i.test(text) ? 1 : 0;

  return (
    itemLinks * 12 +
    Math.min(genericLinks, 30) +
    Math.min(listItems, 25) +
    itemLanguage * 25 +
    containsOrderId * 8
  );
}

function findOrderDetailsContainer(orderId) {
  const candidates = [];

  const preferredSelectors = [
    "#orderDetails",
    "#ordersContainer",
    '[id*=\"orderDetails\"]',
    '[id*=\"order-details\"]',
    '[data-a-name=\"orderDetails\"]',
  ];

  for (const selector of preferredSelectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    for (const node of nodes) {
      const text = normalizeWhitespace(node?.innerText || "");
      if (!text) {
        continue;
      }

      if (!orderId || text.includes(orderId)) {
        candidates.push(node);
      }
    }
  }

  const matchingNodes = Array.from(document.querySelectorAll("div, section, article")).filter((node) => {
    const text = normalizeWhitespace(node.innerText || "");
    return (
      (!orderId || text.includes(orderId)) &&
      text.length >= 400 &&
      text.length <= 120000 &&
      /order total|grand total|shipped|delivered|items in this order/i.test(text)
    );
  });

  for (const node of matchingNodes) {
    candidates.push(node);
  }

  candidates.push(document.body);

  let bestNode = document.body;
  let bestScore = -1;

  for (const node of candidates) {
    const score = scoreDetailsContainer(node, orderId);
    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
}

function extractOrdersFromPage() {
  const linkCandidates = Array.from(document.querySelectorAll('a[href*="orderID="]')).concat(
    Array.from(document.querySelectorAll("a[href*='order-details']"))
  );

  const linksByOrderId = new Map();
  for (const link of linkCandidates) {
    const href = link.href || link.getAttribute("href") || "";
    const orderId = extractOrderIdFromUrl(href) || extractOrderId(link.textContent);
    if (!orderId) {
      continue;
    }

    const existing = linksByOrderId.get(orderId);
    const detailsUrl = /order-details|orderID=/i.test(href) ? toAbsoluteUrl(href) : null;

    if (!existing) {
      linksByOrderId.set(orderId, {
        seedLink: link,
        detailsUrl,
      });
      continue;
    }

    if (!existing.detailsUrl && detailsUrl) {
      existing.detailsUrl = detailsUrl;
    }
  }

  const orders = [];

  for (const [orderId, linkInfo] of linksByOrderId.entries()) {
    const container = findOrderContainer(linkInfo.seedLink);
    const containerText = normalizeWhitespace(container?.innerText || "");

    const orderDate = parseOrderDate(containerText);
    const orderTotal = extractOrderTotal(containerText);

    if (!orderDate || !orderTotal || orderTotal <= 0) {
      continue;
    }

    const itemCandidates = extractItemCandidates(container, {
      orderId,
      source: "order_history",
    });
    const items = buildItems(orderId, itemCandidates, orderTotal, "order_history");

    orders.push({
      provider_order_id: orderId,
      order_date: orderDate,
      order_total: orderTotal,
      currency: "USD",
      merchant_name: "Amazon",
      items,
      raw_order_json: {
        source_page_type: "order_history",
        source_page_url: window.location.href,
        order_details_url: linkInfo.detailsUrl || resolveOrderDetailsUrl(linkInfo.seedLink, orderId),
        page_title: document.title,
        snippet: containerText.slice(0, 3000),
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

function extractOrderFromDetailsPage(orderIdHint) {
  const pageText = normalizeWhitespace(document.body?.innerText || "");
  const urlOrderId = extractOrderIdFromUrl(window.location.href);
  const orderId = orderIdHint || urlOrderId || extractOrderId(pageText);

  if (!orderId) {
    return {
      ok: false,
      error: "Could not determine order id from details page",
    };
  }

  const detailsContainer = findOrderDetailsContainer(orderId);
  const detailsText = normalizeWhitespace(detailsContainer?.innerText || pageText);

  const orderDate = parseOrderDate(detailsText) || parseOrderDate(pageText);
  const extractedTotal = extractOrderTotal(detailsText) || extractOrderTotal(pageText);

  const itemCandidates = extractItemCandidates(detailsContainer, {
    orderId,
    source: "order_details",
  });

  const candidateSum = roundMoney(
    itemCandidates.reduce((sum, item) => {
      if (item.line_total && item.line_total > 0) {
        return sum + item.line_total;
      }
      return sum;
    }, 0)
  );

  const orderTotal = extractedTotal && extractedTotal > 0 ? extractedTotal : candidateSum;

  if (!orderDate || !orderTotal || orderTotal <= 0) {
    return {
      ok: false,
      error: `Missing key order details for ${orderId}`,
    };
  }

  const items = buildItems(orderId, itemCandidates, orderTotal, "order_details");

  return {
    ok: true,
    order: {
      provider_order_id: orderId,
      order_date: orderDate,
      order_total: orderTotal,
      currency: "USD",
      merchant_name: "Amazon",
      items,
      raw_order_json: {
        source_page_type: "order_details",
        source_page_url: window.location.href,
        page_title: document.title,
        snippet: detailsText.slice(0, 3000),
      },
    },
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message?.type === "SCRAPE_ORDER_HISTORY_PAGE") {
      const result = extractOrdersFromPage();

      if (!/amazon\.com\/.*(order-history|your-orders|order-details)/i.test(window.location.href)) {
        sendResponse({
          ok: false,
          error: "Open Amazon order history before syncing.",
        });
        return true;
      }

      sendResponse(result);
      return true;
    }

    if (message?.type === "SCRAPE_ORDER_DETAILS_PAGE") {
      if (!/amazon\.com\/.*order-details/i.test(window.location.href)) {
        sendResponse({
          ok: false,
          error: "Order details page is not open.",
        });
        return true;
      }

      sendResponse(extractOrderFromDetailsPage(message?.order_id || null));
      return true;
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to scrape orders",
    });
  }

  return true;
});
