import express from "express";
import { requireAdmin } from "../auth.js";
import { deleteContactsByIds, deleteMessagesForContact, findContactById, listContacts, listMessagesForContact, upsertContact } from "../db.js";
import { createConsentToken, createUnsubscribeToken, isValidEmail, publicError, unwrapArray } from "../utils.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/contacts", (req, res) => {
  const contacts = listContacts({
    search: req.query.search || "",
    limit: Math.min(Number(req.query.limit) || 100, 500),
    offset: Number(req.query.offset) || 0,
  });
  res.json({ ok: true, contacts });
});

router.get("/contacts/:contactId", (req, res, next) => {
  const contact = findContactById(req.params.contactId);
  if (!contact) return next(publicError("Contact not found", 404));
  const messages = listMessagesForContact(contact.id);
  return res.json({ ok: true, contact, messages });
});

router.get("/contacts/:contactId/emails", (req, res, next) => {
  const contact = findContactById(req.params.contactId);
  if (!contact) return next(publicError("Contact not found", 404));
  return res.json({ ok: true, contactId: contact.id, messages: listMessagesForContact(contact.id) });
});

router.delete("/contacts/:contactId/emails", (req, res, next) => {
  const contact = findContactById(req.params.contactId);
  if (!contact) return next(publicError("Contact not found", 404));
  const deleted = deleteMessagesForContact(contact.id);
  return res.json({ ok: true, contactId: contact.id, deleted });
});

router.get("/contacts/:contactId/consent-links", (req, res, next) => {
  const contact = findContactById(req.params.contactId);
  if (!contact) return next(publicError("Contact not found", 404));
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) return next(publicError("SITE_URL is not configured", 500));

  const consentUrl = new URL("/consent", siteUrl);
  consentUrl.searchParams.set("token", createConsentToken(contact.id));

  const unsubscribeUrl = new URL("/unsubscribe", siteUrl);
  unsubscribeUrl.searchParams.set("token", createUnsubscribeToken(contact.id));

  return res.json({
    ok: true,
    contactId: contact.id,
    marketingOptIn: contact.marketingOptIn,
    unsubscribed: contact.unsubscribed,
    consentUrl: consentUrl.toString(),
    unsubscribeUrl: unsubscribeUrl.toString(),
  });
});

router.post("/contacts/import", (req, res, next) => {
  const contacts = unwrapArray(req.body.contacts || req.body.leads);
  if (!contacts.length) return next(publicError("contacts array is required", 400));

  const summary = { createdOrUpdated: 0, skipped: 0, errors: [] };
  for (const contact of contacts) {
    try {
      if (!isValidEmail(contact.email)) {
        summary.skipped += 1;
        continue;
      }
      upsertContact(contact);
      summary.createdOrUpdated += 1;
    } catch (error) {
      summary.errors.push({ email: contact.email || "", message: error.message });
    }
  }

  return res.json({ ok: true, summary });
});

router.post("/contacts/delete", (req, res, next) => {
  const ids = unwrapArray(req.body.ids);
  if (!ids.length) return next(publicError("ids array is required", 400));
  const deleted = deleteContactsByIds(ids);
  return res.json({ ok: true, deleted, requested: ids.length });
});

export default router;
