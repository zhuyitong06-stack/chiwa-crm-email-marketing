import express from "express";
import { requireAdmin } from "../auth.js";
import {
  campaignReport,
  createCampaign,
  createEmailMessage,
  createThread,
  deleteCampaign,
  findCampaignById,
  getEligibleMarketingContacts,
  listCampaigns,
  updateCampaign,
  updateCampaignStats,
  updateContactEmailState,
} from "../db.js";
import { fromAddressForPurpose, sendEmail } from "../resend.js";
import { createConsentToken, createEmailArchiveToken, createUnsubscribeToken, escapeHtml, makeId, nowIso, parseEmailAddressList, publicError } from "../utils.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/campaigns", (_req, res) => {
  const campaigns = listCampaigns().map((campaign) => ({ ...campaign, report: campaignReport(campaign.id) }));
  res.json({ ok: true, campaigns });
});

router.post("/campaigns", (req, res, next) => {
  if (!req.body.name) return next(publicError("name is required", 400));
  if (!req.body.subject) return next(publicError("subject is required", 400));
  const campaign = createCampaign(req.body);
  return res.status(201).json({ ok: true, campaign });
});

router.put("/campaigns/:campaignId", (req, res, next) => {
  if (!req.body.name) return next(publicError("name is required", 400));
  if (!req.body.subject) return next(publicError("subject is required", 400));
  const campaign = updateCampaign(req.params.campaignId, req.body);
  if (!campaign) return next(publicError("Campaign not found", 404));
  return res.json({ ok: true, campaign });
});

function campaignAudience(campaign) {
  return getEligibleMarketingContacts(campaign.segmentFilter);
}

function audiencePayload(campaign) {
  const contacts = campaignAudience(campaign);
  return {
    ok: true,
    campaignId: campaign.id,
    eligibleCount: contacts.length,
    sample: contacts.slice(0, 10).map((contact) => ({
      id: contact.id,
      crmCustomerId: contact.crmCustomerId,
      email: contact.email,
      company: contact.company,
      priority: contact.tags?.find((tag) => /^P[1-3]$/i.test(tag)) || "",
      tags: contact.tags,
    })),
  };
}

function variablesForContact(contact, { messageId = "" } = {}) {
  const siteUrl = process.env.SITE_URL || "https://crm.chiwa.ai";
  const webArchiveUrl = messageId
    ? new URL(`/archive?token=${createEmailArchiveToken(messageId, contact.id)}`, siteUrl).toString()
    : siteUrl;
  const consentUrl = new URL("/consent", siteUrl);
  consentUrl.searchParams.set("token", createConsentToken(contact.id));
  const unsubscribeUrl = new URL("/unsubscribe", siteUrl);
  unsubscribeUrl.searchParams.set("token", createUnsubscribeToken(contact.id));
  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return {
    contactname: contactName,
    contact_name: contactName,
    company: contact.company || "",
    email: contact.email || "",
    consenturl: consentUrl.toString(),
    consent_url: consentUrl.toString(),
    unsubscribeurl: unsubscribeUrl.toString(),
    unsubscribe_url: unsubscribeUrl.toString(),
    webarchiveurl: webArchiveUrl,
    web_archive_url: webArchiveUrl,
  };
}

function renderVariables(value = "", variables = {}) {
  return String(value || "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
    const normalized = key.toLowerCase();
    const compact = normalized.replace(/[_-]/g, "");
    return variables[normalized] ?? variables[compact] ?? variables[key] ?? match;
  });
}

function marketingFooter(unsubscribeUrl) {
  const address = process.env.COMPANY_POSTAL_ADDRESS;
  if (!address) throw publicError("COMPANY_POSTAL_ADDRESS is required for marketing email", 500);
  return {
    html: `<hr><p style="font-size:12px;color:#667085;line-height:1.5">${escapeHtml(address)}<br><a href="${escapeHtml(unsubscribeUrl)}">退訂營銷郵件</a></p>`,
    text: `\n\n--\n${address}\n退訂營銷郵件: ${unsubscribeUrl}`,
  };
}

router.get("/campaigns/:campaignId/estimate", (req, res, next) => {
  const campaign = findCampaignById(req.params.campaignId);
  if (!campaign) return next(publicError("Campaign not found", 404));
  return res.json(audiencePayload(campaign));
});

router.post("/campaigns/:campaignId/dry-run", (req, res, next) => {
  const campaign = findCampaignById(req.params.campaignId);
  if (!campaign) return next(publicError("Campaign not found", 404));
  return res.json(audiencePayload(campaign));
});

router.get("/campaigns/:campaignId/report", (req, res, next) => {
  const report = campaignReport(req.params.campaignId);
  if (!report) return next(publicError("Campaign not found", 404));
  return res.json({ ok: true, report });
});

async function sendCampaignMessage({ campaign, contact, testRecipients = [] }) {
  const messageId = makeId("msg");
  const variables = variablesForContact(contact, { messageId });
  const subject = renderVariables(campaign.subject, variables);
  const text = renderVariables(campaign.textContent || "", variables);
  const htmlBase = campaign.htmlContent || `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
  const html = renderVariables(htmlBase, variables);
  const footer = marketingFooter(variables.unsubscribeurl);
  const thread = createThread({ contactId: contact.id, subject, source: "campaign" });
  const from = campaign.fromEmail || fromAddressForPurpose("marketing");
  const recipients = testRecipients.length ? testRecipients : [contact.email];
  const result = await sendEmail({
    from,
    to: recipients,
    subject,
    html: `${html}${footer.html}`,
    text: `${text}${footer.text}`,
    replyTo: process.env.FROM_SUPPORT,
    headers: {
      "X-TDC-Contact-Id": contact.id,
      "X-TDC-Thread-Id": thread.id,
      "X-TDC-Campaign-Id": campaign.id,
      "List-Unsubscribe": `<${variables.unsubscribeurl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "purpose", value: "marketing" },
      { name: "campaign_id", value: campaign.id },
      { name: "contact_id", value: contact.id },
      { name: "mode", value: testRecipients.length ? "campaign_test" : "campaign_live" },
    ],
  });
  const message = createEmailMessage({
    id: messageId,
    threadId: thread.id,
    contactId: contact.id,
    direction: "outbound",
    purpose: "marketing",
    fromEmail: from,
    toEmail: recipients.join(", "),
    subject,
    htmlContent: `${html}${footer.html}`,
    textContent: `${text}${footer.text}`,
    resendEmailId: result.id || "",
    providerMessageId: result.id || "",
    status: "sent",
    sentAt: nowIso(),
    sentByAdminId: "admin",
    campaignId: campaign.id,
  });
  if (!testRecipients.length) {
    updateContactEmailState(contact.id, {
      lastEmailSentAt: message.sentAt,
      lifecycleStage: "邮件发送",
      ...(contact.marketingOptIn
        ? {}
        : {
            marketingOptIn: true,
            marketingOptInAt: nowIso(),
            marketingConsentSource: "default-campaign-send",
          }),
    });
  }
  return { result, message };
}

router.post("/campaigns/:campaignId/test", async (req, res, next) => {
  try {
    const campaign = findCampaignById(req.params.campaignId);
    if (!campaign) throw publicError("Campaign not found", 404);
    const recipients = parseEmailAddressList(req.body.testRecipient || req.body.to);
    if (!recipients.length) throw publicError("testRecipient must include at least one valid email", 400);
    const sample = campaignAudience(campaign)[0];
    if (!sample) throw publicError("No eligible audience contact to render test variables", 409);
    const sent = await sendCampaignMessage({ campaign, contact: sample, testRecipients: recipients });
    return res.json({ ok: true, resend: sent.result, message: sent.message });
  } catch (error) {
    return next(error);
  }
});

router.post("/campaigns/:campaignId/start", async (req, res, next) => {
  try {
    const campaign = findCampaignById(req.params.campaignId);
    if (!campaign) throw publicError("Campaign not found", 404);
    const contacts = campaignAudience(campaign);
    const scheduledAt = req.body.scheduledAt || campaign.scheduledAt || "";
    if (scheduledAt && new Date(scheduledAt).getTime() > Date.now()) {
      const scheduled = updateCampaignStats(campaign.id, {
        status: "scheduled",
        targetCount: contacts.length,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      return res.status(202).json({ ok: true, campaign: scheduled, queued: true, targetCount: contacts.length });
    }

    const maxPerRun = Math.max(1, Number(process.env.CAMPAIGN_MAX_SEND_PER_RUN) || 5000);
    const limit = Math.min(Number(req.body.limit) || contacts.length, contacts.length, maxPerRun);
    let sentCount = 0;
    let failedCount = 0;
    for (const contact of contacts.slice(0, limit)) {
      try {
        await sendCampaignMessage({ campaign, contact });
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        console.warn(`Campaign ${campaign.id} failed for ${contact.email}: ${error.message}`);
      }
    }
    const updated = updateCampaignStats(campaign.id, {
      status: limit < contacts.length ? "partially_sent" : failedCount ? "sent_with_errors" : "sent",
      targetCount: contacts.length,
      sentCount,
      failedCount,
      scheduledAt: "",
    });
    return res.json({ ok: true, campaign: updated, sentCount, failedCount, targetCount: contacts.length, limited: limit < contacts.length, maxPerRun });
  } catch (error) {
    return next(error);
  }
});

router.delete("/campaigns/:campaignId", (req, res, next) => {
  const deleted = deleteCampaign(req.params.campaignId);
  if (!deleted) return next(publicError("Campaign not found", 404));
  return res.json({ ok: true, deleted });
});

export default router;
