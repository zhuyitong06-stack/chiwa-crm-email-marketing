import express from "express";
import { requireAdmin } from "../auth.js";
import {
  createEmailMessage,
  createThread,
  findContactById,
  findThreadById,
  updateContactEmailState,
} from "../db.js";
import { fromAddressForPurpose, sendEmail } from "../resend.js";
import { createConsentToken, createEmailArchiveToken, createUnsubscribeToken, escapeHtml, makeId, nowIso, parseEmailAddressList, publicError } from "../utils.js";

const router = express.Router();

router.use(requireAdmin);

function assertCanSend(contact, purpose) {
  if (contact.complaintStatus) throw publicError("Contact has complained; sending is blocked", 409);
  if (["hard_bounce", "suppressed"].includes(contact.bounceStatus)) {
    throw publicError("Contact is blocked by bounce or suppression status", 409);
  }
  if (purpose === "marketing") {
    if (contact.unsubscribed) throw publicError("客户已退订 Marketing 邮件，不能继续发送。", 409);
  }
}

function buildUnsubscribeUrl(contactId) {
  if (!process.env.SITE_URL) throw publicError("SITE_URL is not configured", 500);
  const url = new URL("/unsubscribe", process.env.SITE_URL);
  url.searchParams.set("token", createUnsubscribeToken(contactId));
  return url.toString();
}

function buildConsentUrl(contactId) {
  if (!process.env.SITE_URL) throw publicError("SITE_URL is not configured", 500);
  const url = new URL("/consent", process.env.SITE_URL);
  url.searchParams.set("token", createConsentToken(contactId));
  return url.toString();
}

function buildArchiveUrl(messageId, contactId) {
  if (!process.env.SITE_URL) throw publicError("SITE_URL is not configured", 500);
  const url = new URL("/archive", process.env.SITE_URL);
  url.searchParams.set("token", createEmailArchiveToken(messageId, contactId));
  return url.toString();
}

function contactDisplayName(contact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

function renderTemplateVariables(value = "", variables = {}) {
  return String(value || "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
    const normalized = key.toLowerCase();
    const compact = normalized.replace(/[_-]/g, "");
    return variables[normalized] ?? variables[compact] ?? variables[key] ?? match;
  });
}

function templateVariablesForContact(contact, { messageId = "" } = {}) {
  const consentUrl = buildConsentUrl(contact.id);
  const unsubscribeUrl = buildUnsubscribeUrl(contact.id);
  const webArchiveUrl = messageId ? buildArchiveUrl(messageId, contact.id) : process.env.SITE_URL || "https://crm.chiwa.ai";
  const contactName = contactDisplayName(contact);
  return {
    consenturl: consentUrl,
    consent_url: consentUrl,
    unsubscribeurl: unsubscribeUrl,
    unsubscribe_url: unsubscribeUrl,
    webarchiveurl: webArchiveUrl,
    web_archive_url: webArchiveUrl,
    company: contact.company || "",
    contactname: contactName,
    contact_name: contactName,
    firstname: contact.firstName || "",
    first_name: contact.firstName || "",
    lastname: contact.lastName || "",
    last_name: contact.lastName || "",
    email: contact.email || "",
  };
}

function appendMarketingCompliance({ html, text, contact, unsubscribeUrl }) {
  const address = process.env.COMPANY_POSTAL_ADDRESS;
  if (!address) throw publicError("COMPANY_POSTAL_ADDRESS is required for marketing email", 500);

  const footerHtml = `
    <hr>
    <p style="font-size:12px;color:#667085;line-height:1.5">
      ${escapeHtml(address)}<br>
      <a href="${escapeHtml(unsubscribeUrl)}">退訂營銷郵件</a>
    </p>
  `;
  const footerText = `\n\n--\n${address}\n退訂營銷郵件: ${unsubscribeUrl}`;

  return {
    html: `${html}${footerHtml}`,
    text: text ? `${text}${footerText}` : footerText.trim(),
    unsubscribeUrl,
  };
}

router.post("/contacts/:contactId/emails/send", async (req, res, next) => {
  try {
    const contact = findContactById(req.params.contactId);
    if (!contact) throw publicError("Contact not found", 404);

    const purpose = req.body.purpose || "support";
    const testRecipient = String(req.body.testRecipient || "").trim();
    const testRecipients = parseEmailAddressList(testRecipient);
    const isTest = Boolean(testRecipient);
    if (isTest && !testRecipients.length) throw publicError("testRecipient must include at least one valid email", 400);
    if (!isTest) assertCanSend(contact, purpose);

    const messageId = makeId("msg");
    const variables = templateVariablesForContact(contact, { messageId });
    const subject = renderTemplateVariables(String(req.body.subject || "").trim(), variables);
    const htmlContent = renderTemplateVariables(String(req.body.htmlContent || "").trim(), variables);
    const textContent = renderTemplateVariables(String(req.body.textContent || "").trim(), variables);
    if (!subject) throw publicError("subject is required", 400);
    if (!htmlContent && !textContent) throw publicError("htmlContent or textContent is required", 400);

    const thread = req.body.threadId ? findThreadById(req.body.threadId) : createThread({
      contactId: contact.id,
      subject,
      source: "outbound",
    });
    if (!thread || thread.contactId !== contact.id) throw publicError("Thread not found for contact", 404);

    const from = fromAddressForPurpose(purpose);
    if (!from) throw publicError("Sender address is not configured for this purpose", 500);
    const recipients = isTest ? testRecipients : parseEmailAddressList(contact.email);
    if (!recipients.length) throw publicError("Contact email is not valid", 400);

    const html = htmlContent || `<p>${escapeHtml(textContent).replaceAll("\n", "<br>")}</p>`;
    const prepared = purpose === "marketing"
      ? appendMarketingCompliance({ html, text: textContent, contact, unsubscribeUrl: variables.unsubscribeurl })
      : { html, text: textContent || undefined, unsubscribeUrl: variables.unsubscribeurl };

    const result = await sendEmail({
      from,
      to: recipients,
      cc: parseEmailAddressList(req.body.cc),
      bcc: parseEmailAddressList(req.body.bcc),
      replyTo: process.env.FROM_SUPPORT,
      subject,
      html: prepared.html,
      text: prepared.text,
      headers: {
        "X-TDC-Contact-Id": contact.id,
        "X-TDC-Thread-Id": thread.id,
        ...(prepared.unsubscribeUrl
          ? {
              "List-Unsubscribe": `<${prepared.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : {}),
      },
      tags: [
        { name: "purpose", value: purpose },
        { name: "contact_id", value: contact.id },
        { name: "mode", value: isTest ? "test" : "live" },
      ],
    });

    const message = createEmailMessage({
      id: messageId,
      threadId: thread.id,
      contactId: contact.id,
      direction: "outbound",
      purpose,
      fromEmail: from,
      toEmail: recipients.join(", "),
      cc: parseEmailAddressList(req.body.cc).join(", "),
      bcc: parseEmailAddressList(req.body.bcc).join(", "),
      subject,
      htmlContent: prepared.html,
      textContent: prepared.text || "",
      resendEmailId: result.id || "",
      providerMessageId: result.id || "",
      status: "sent",
      sentAt: nowIso(),
      sentByAdminId: "admin",
    });
    if (!isTest) {
      updateContactEmailState(contact.id, {
        lastEmailSentAt: message.sentAt,
        lifecycleStage: "邮件发送",
        ...(purpose === "marketing" && !contact.marketingOptIn
          ? {
              marketingOptIn: true,
              marketingOptInAt: nowIso(),
              marketingConsentSource: "default-marketing-send",
            }
          : {}),
      });
    }

    return res.json({ ok: true, message, resend: result });
  } catch (error) {
    return next(error);
  }
});

export default router;
