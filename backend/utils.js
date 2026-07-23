import crypto from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

const EMAIL_PATTERN = /[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/i;

export function extractEmailAddress(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^['"]|['"]$/g, "");
  const bracketMatch = raw.match(/<([^<>]+)>/);
  const candidate = bracketMatch ? bracketMatch[1] : raw;
  const emailMatch = candidate.match(EMAIL_PATTERN) || raw.match(EMAIL_PATTERN);
  return emailMatch ? emailMatch[0].trim() : "";
}

export function isValidEmail(value) {
  return Boolean(extractEmailAddress(value));
}

export function normalizeEmail(value) {
  return extractEmailAddress(value).toLowerCase();
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "yes";
}

export function jsonStringify(value, fallback = "null") {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return fallback;
  }
}

export function jsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseAddressList(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseEmailAddressList(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[;,]/);
  const emails = values.map(extractEmailAddress).filter(Boolean).map((item) => item.toLowerCase());
  return [...new Set(emails)];
}

export function publicError(message = "Request failed", status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function unwrapArray(value) {
  return Array.isArray(value) ? value : [];
}

function unsubscribeSecret() {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN;
  if (!secret) throw publicError("UNSUBSCRIBE_TOKEN_SECRET is not configured", 500);
  return secret;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signTokenPayload(encodedPayload) {
  return crypto.createHmac("sha256", unsubscribeSecret()).update(encodedPayload).digest("base64url");
}

export function createContactActionToken(contactId, action = "unsubscribe", ttlDays = 3650) {
  const payload = {
    contactId,
    action,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
  };
  const encodedPayload = base64UrlJson(payload);
  return `${encodedPayload}.${signTokenPayload(encodedPayload)}`;
}

export function createUnsubscribeToken(contactId, ttlDays = 3650) {
  return createContactActionToken(contactId, "unsubscribe", ttlDays);
}

export function createConsentToken(contactId, ttlDays = 3650) {
  return createContactActionToken(contactId, "consent", ttlDays);
}

export function createEmailArchiveToken(messageId, contactId, ttlDays = 3650) {
  const payload = {
    messageId,
    contactId,
    action: "archive",
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
  };
  const encodedPayload = base64UrlJson(payload);
  return `${encodedPayload}.${signTokenPayload(encodedPayload)}`;
}

export function verifyContactActionToken(token, expectedAction = "") {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) throw publicError("Invalid token", 400);

  const expected = signTokenPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw publicError("Invalid token", 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw publicError("Invalid token", 400);
  }

  if (!payload.contactId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw publicError("Expired token", 400);
  }

  if (expectedAction && payload.action && payload.action !== expectedAction) {
    throw publicError("Invalid token action", 400);
  }

  return payload;
}

export function verifyUnsubscribeToken(token) {
  return verifyContactActionToken(token, "unsubscribe");
}

export function verifyConsentToken(token) {
  return verifyContactActionToken(token, "consent");
}

export function verifyEmailArchiveToken(token) {
  const payload = verifyContactActionToken(token, "archive");
  if (!payload.messageId) throw publicError("Invalid archive token", 400);
  return payload;
}
