import express from "express";
import { requireAdmin } from "../auth.js";
import { createEmailTemplate, deleteEmailTemplate, findEmailTemplateById, listEmailTemplates, updateEmailTemplate } from "../db.js";
import { publicError } from "../utils.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/templates", (req, res) => {
  res.json({ ok: true, templates: listEmailTemplates({ purpose: req.query.purpose || "" }) });
});

router.get("/templates/:templateId", (req, res, next) => {
  const template = findEmailTemplateById(req.params.templateId);
  if (!template) return next(publicError("Template not found", 404));
  return res.json({ ok: true, template });
});

router.post("/templates", (req, res, next) => {
  if (!req.body.name) return next(publicError("name is required", 400));
  if (!req.body.subjectTemplate && !req.body.subject) return next(publicError("subjectTemplate is required", 400));
  if (!req.body.htmlTemplate && !req.body.textTemplate && !req.body.textContent) {
    return next(publicError("htmlTemplate or textTemplate is required", 400));
  }
  const template = createEmailTemplate(req.body);
  return res.status(201).json({ ok: true, template });
});

router.put("/templates/:templateId", (req, res, next) => {
  const template = updateEmailTemplate(req.params.templateId, req.body);
  if (!template) return next(publicError("Template not found", 404));
  return res.json({ ok: true, template });
});

router.delete("/templates/:templateId", (req, res, next) => {
  const deleted = deleteEmailTemplate(req.params.templateId);
  if (!deleted) return next(publicError("Template not found", 404));
  return res.json({ ok: true, deleted });
});

export default router;
