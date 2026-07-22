import express from "express";
import { Webhook } from "svix";
import {
  createEmailEvent,
  createEmailMessage,
  createThread,
  findContactByEmail,
  findMessageByInboundEmailId,
  findMessageByProviderId,
  findThreadForContactSubject,
  upsertContact,
  updateContactEmailState,
  updateEmailMessageContent,
  updateMessageStatusByResendId,
  updateThread,
} from "../db.js";
import { retrieveReceivedEmail } from "../resend.js";
import { normalizeEmail, nowIso, publicError } from "../utils.js";

const router = express.Router();
const rawJson = express.raw({ type: "application/json", limit: "2mb" });

function verifyWebhook(req, secretName = "RESEND_WEBHOOK_SECRET") {
  const secret = process.env[secretName] || process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw publicError(`${secretName} is not configured`, 500);
  const webhook = new Webhook(secret);
  try {
    return webhook.verify(req.body, {
      "svix-id": req.get("svix-id"),
      "svix-timestamp": req.get("svix-timestamp"),
      "svix-signature": req.get("svix-signature"),
    });
  } catch {
    throw publicError("Invalid webhook signature", 401);
  }
}

function eventId(req, payload) {
  return req.get("svix-id") || payload?.id || payload?.data?.id || "";
}

function eventType(payload) {
  return payload?.type || payload?.event || "";
}

function emailIdFromPayload(payload) {
  return payload?.data?.email_id || payload?.data?.emailId || payload?.data?.id || payload?.data?.email?.id || "";
}

function firstAddress(value) {
  if (Array.isArray(value)) return value[0]?.email || value[0] || "";
  return value?.email || value || "";
}

function addressList(value) {
  if (Array.isArray(value)) return value.map((item) => item?.email || item).filter(Boolean).join(", ");
  return value?.email || value || "";
}

function tagValue(payload, name) {
  const tags = payload?.data?.tags || payload?.tags || [];
  if (Array.isArray(tags)) {
    const match = tags.find((tag) => tag?.name === name || tag?.key === name);
    return match?.value || "";
  }
  return tags?.[name] || "";
}

function statusForType(type) {
  return {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delivery_delayed",
    "email.failed": "failed",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.unsubscribed": "unsubscribed",
    "email.suppressed": "suppressed",
  }[type] || "";
}

function bounceStatusFromPayload(payload) {
  const bounceType = String(payload?.data?.bounce?.type || "").toLowerCase();
  const subType = String(payload?.data?.bounce?.subType || payload?.data?.bounce?.sub_type || "").toLowerCase();
  if (subType === "suppressed") return "suppressed";
  if (bounceType === "permanent") return "hard_bounce";
  if (bounceType === "transient" || bounceType === "temporary") return "soft_bounce";
  return payload?.data?.bounce?.type || "hard_bounce";
}

router.post("/webhook", rawJson, (req, res, next) => {
  try {
    const payload = verifyWebhook(req);
    const type = eventType(payload);
    const resendEmailId = emailIdFromPayload(payload);
    const message = updateMessageStatusByResendId(resendEmailId, statusForType(type), payload?.data?.reason || "");
    const contactId = message?.contactId || tagValue(payload, "contact_id") || null;

    const eventResult = createEmailEvent({
      messageId: message?.id || null,
      contactId,
      eventType: type,
      resendEventId: eventId(req, payload),
      payload,
    });

    if (!eventResult.inserted) {
      return res.json({ ok: true, duplicate: true });
    }

    if (contactId && type === "email.bounced") {
      updateContactEmailState(contactId, { bounceStatus: bounceStatusFromPayload(payload) });
    }
    if (contactId && type === "email.suppressed") {
      updateContactEmailState(contactId, { bounceStatus: "suppressed" });
    }
    if (contactId && type === "email.complained") {
      updateContactEmailState(contactId, { complaintStatus: true });
    }
    if (contactId && ["email.unsubscribed", "email.suppressed"].includes(type)) {
      updateContactEmailState(contactId, { marketingOptIn: false, unsubscribed: true, unsubscribedAt: nowIso() });
    }
    if (contactId && type === "email.clicked") {
      updateContactEmailState(contactId, { lifecycleStage: "点击/互动" });
    }
    if (contactId && type === "email.opened") {
      updateContactEmailState(contactId, { lifecycleStage: "邮件打开" });
    }
    if (contactId && type === "email.delivered") {
      updateContactEmailState(contactId, { lifecycleStage: "邮件送达" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/inbound", rawJson, async (req, res, next) => {
  try {
    const payload = verifyWebhook(req, "RESEND_INBOUND_SECRET");
    const data = payload?.data || {};
    const inboundEmailId = data.email_id || data.emailId || data.id || emailIdFromPayload(payload);
    let receivedEmail = {};
    if (inboundEmailId) {
      try {
        receivedEmail = await retrieveReceivedEmail(inboundEmailId);
      } catch (error) {
        console.warn(`Could not retrieve received email ${inboundEmailId}: ${error.message}`);
      }
    }

    const fromEmail = normalizeEmail(firstAddress(receivedEmail.from) || firstAddress(data.from) || data.sender || "");
    const toEmail = addressList(receivedEmail.to) || addressList(data.to) || addressList(data.received_for) || "";
    const subject = receivedEmail.subject || data.subject || "(no subject)";
    const htmlContent = receivedEmail.html || data.html || data.htmlContent || data.html_body || data.htmlBody || "";
    const textContent = receivedEmail.text || data.text || data.textContent || data.text_body || data.textBody || "";
    const providerMessageId = receivedEmail.message_id || data.message_id || data.messageId || inboundEmailId || "";
    const inReplyTo = receivedEmail.in_reply_to || data.in_reply_to || data.inReplyTo || "";
    const attachments = receivedEmail.attachments || data.attachments || [];
    const receivedAt = receivedEmail.created_at || data.created_at || nowIso();

    if (!fromEmail) throw publicError("Inbound email does not include sender", 400);

    const existingMessage = findMessageByInboundEmailId(inboundEmailId) || findMessageByProviderId(providerMessageId);
    if (existingMessage) {
      updateEmailMessageContent(existingMessage.id, {
        subject,
        htmlContent,
        textContent,
        providerMessageId,
        inReplyTo,
        status: "received",
        receivedAt,
        attachments,
      });
      updateThread(existingMessage.threadId, { status: "open" });
      updateContactEmailState(existingMessage.contactId, {
        lifecycleStage: "Follow-up",
        lastEmailReceivedAt: receivedAt,
      });
      createEmailEvent({
        messageId: existingMessage.id,
        contactId: existingMessage.contactId,
        eventType: eventType(payload) || "email.received",
        resendEventId: eventId(req, payload),
        payload: { ...payload, receivedEmail },
      });
      return res.json({ ok: true, updated: true });
    }

    let contact = findContactByEmail(fromEmail);
    if (!contact) {
      contact = upsertContact({
        email: fromEmail,
        firstName: data.from?.name || "",
        source: "inbound",
      });
    }

    const thread = findThreadForContactSubject(contact.id, subject) || createThread({
      contactId: contact.id,
      subject,
      source: "inbound",
    });
    updateThread(thread.id, { status: "open" });

    const inboundMessage = createEmailMessage({
      threadId: thread.id,
      contactId: contact.id,
      direction: "inbound",
      purpose: "support",
      fromEmail,
      toEmail: Array.isArray(toEmail) ? toEmail.join(", ") : String(toEmail || ""),
      subject,
      htmlContent,
      textContent,
      inboundEmailId,
      providerMessageId,
      inReplyTo,
      status: "received",
      receivedAt,
      attachments,
    });
    updateContactEmailState(contact.id, {
      lifecycleStage: "Follow-up",
      lastEmailReceivedAt: inboundMessage.receivedAt,
    });

    createEmailEvent({
      messageId: inboundMessage.id,
      contactId: contact.id,
      eventType: eventType(payload) || "email.received",
      resendEventId: eventId(req, payload),
      payload: { ...payload, receivedEmail },
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
