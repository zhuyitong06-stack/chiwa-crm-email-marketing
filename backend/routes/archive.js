import express from "express";
import { findEmailMessageById } from "../db.js";
import { escapeHtml, publicError, verifyEmailArchiveToken } from "../utils.js";

const router = express.Router();

function renderTextArchive(message) {
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(message.subject || "Email archive")}</title>
    <style>
      body { margin: 0; background: #f6f8fb; color: #17202a; font-family: Arial, sans-serif; }
      main { width: min(720px, calc(100% - 32px)); margin: 24px auto; background: #fff; border: 1px solid #e5eaf2; border-radius: 8px; padding: 24px; }
      pre { white-space: pre-wrap; line-height: 1.6; font: 15px/1.6 Arial, sans-serif; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(message.subject || "Email archive")}</h1>
      <pre>${escapeHtml(message.textContent || "")}</pre>
    </main>
  </body>
</html>`;
}

router.get("/archive", (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw publicError("Missing archive token", 400);
    if (token === "preview") {
      return res.status(200).type("html").send(renderTextArchive({
        subject: "Email web archive preview",
        textContent: "正式发送邮件后，这里会显示该邮件的网页版 HTML 快照。",
      }));
    }
    const payload = verifyEmailArchiveToken(token);
    const message = findEmailMessageById(payload.messageId);
    if (!message || message.contactId !== payload.contactId) throw publicError("Email archive not found", 404);
    const html = message.htmlContent || renderTextArchive(message);
    return res.status(200).type("html").send(html);
  } catch (error) {
    return next(error);
  }
});

export default router;
