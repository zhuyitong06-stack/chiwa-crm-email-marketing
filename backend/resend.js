import { escapeHtml, extractEmailAddress, jsonStringify, parseEmailAddressList, publicError } from "./utils.js";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const RESEND_RECEIVED_EMAILS_URL = "https://api.resend.com/emails/receiving";
const RESEND_CONTACTS_URL = "https://api.resend.com/contacts";

function requireResendKey() {
  if (!process.env.RESEND_API_KEY) {
    throw publicError("RESEND_API_KEY is not configured", 500);
  }
}

export function fromAddressForPurpose(purpose) {
  if (purpose === "marketing") return process.env.FROM_MARKETING;
  if (purpose === "sales") return process.env.FROM_SALES || process.env.FROM_SUPPORT;
  if (purpose === "transactional") return process.env.FROM_TRANSACTIONAL;
  return process.env.FROM_SUPPORT || process.env.FROM_TRANSACTIONAL;
}

function normalizeSenderAddress(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const match = raw.match(/^(.*?)<([^<>]+)>$/);
  const email = extractEmailAddress(match ? match[2] : raw);
  if (!email) throw publicError("Sender address is not configured in a valid email format", 500);
  const name = match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
  return name ? `${name} <${email}>` : email;
}

function normalizeReplyTo(value) {
  const email = extractEmailAddress(value);
  return email || undefined;
}

export async function sendEmail({
  from,
  to,
  cc,
  bcc,
  replyTo,
  subject,
  html,
  text,
  headers,
  tags,
}) {
  requireResendKey();
  const toList = parseEmailAddressList(to);
  if (!toList.length) throw publicError("At least one valid recipient email is required", 400);
  const ccList = parseEmailAddressList(cc);
  const bccList = parseEmailAddressList(bcc);
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: jsonStringify({
      from: normalizeSenderAddress(from),
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      reply_to: normalizeReplyTo(replyTo),
      subject,
      html,
      text,
      headers,
      tags,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || "Resend send failed";
    throw publicError(message, response.status);
  }
  return payload;
}

export async function retrieveReceivedEmail(emailId) {
  requireResendKey();
  if (!emailId) throw publicError("Received email id is required", 400);

  const response = await fetch(`${RESEND_RECEIVED_EMAILS_URL}/${encodeURIComponent(emailId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Failed to retrieve received email: ${emailId}`;
    throw publicError(message, response.status);
  }
  return payload;
}

export function renderSimpleHtmlEmail({ title, body, footer }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#17202a">
      <h2>${escapeHtml(title)}</h2>
      <div>${body}</div>
      ${footer ? `<hr><p style="font-size:12px;color:#667085">${footer}</p>` : ""}
    </div>
  `;
}

export async function updateResendContactSubscription(email, unsubscribed) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  const response = await fetch(`${RESEND_CONTACTS_URL}/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: jsonStringify({ unsubscribed: Boolean(unsubscribed) }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || "Resend contact update failed";
    throw publicError(message, response.status);
  }
  return payload;
}
