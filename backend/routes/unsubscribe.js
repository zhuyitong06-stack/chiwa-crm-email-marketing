import express from "express";
import { findContactById, updateContactEmailState } from "../db.js";
import { updateResendContactSubscription } from "../resend.js";
import { escapeHtml, nowIso, publicError, verifyConsentToken, verifyUnsubscribeToken } from "../utils.js";

const router = express.Router();

function renderPage({ title, message, action = "", token = "", buttonLabel = "" }) {
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8fb; color: #17202a; }
      main { width: min(560px, calc(100% - 32px)); background: #fff; border: 1px solid #e3e8ef; border-radius: 8px; padding: 28px; box-shadow: 0 12px 32px rgba(16, 24, 40, 0.08); }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 0; line-height: 1.6; color: #475467; }
      form { margin-top: 22px; }
      button { border: 0; border-radius: 6px; background: #0f766e; color: #fff; cursor: pointer; font: inherit; min-height: 40px; padding: 9px 14px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${action ? `
        <form method="post" action="${escapeHtml(action)}">
          <input type="hidden" name="token" value="${escapeHtml(token)}">
          <button type="submit">${escapeHtml(buttonLabel)}</button>
        </form>
      ` : ""}
    </main>
  </body>
</html>`;
}

async function markUnsubscribed(token) {
  if (!token) throw publicError("Missing unsubscribe token", 400);
  const payload = verifyUnsubscribeToken(token);
  const contact = findContactById(payload.contactId);
  if (!contact) throw publicError("Contact not found", 404);

  updateContactEmailState(contact.id, {
    marketingOptIn: false,
    unsubscribed: true,
    unsubscribedAt: nowIso(),
  });

  try {
    await updateResendContactSubscription(contact.email, true);
  } catch (error) {
    console.warn(`Resend unsubscribe sync failed for contact ${contact.id}: ${error.message}`);
  }

  return contact;
}

router.get("/consent", (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw publicError("Missing consent token", 400);
    verifyConsentToken(token);
    return res.status(200).type("html").send(renderPage({
      title: "確認訂閱 Chiwa AI 郵件",
      message: "點擊下方按鈕後，我們會記錄你已同意接收 Chiwa AI 的產品、服務與市場資訊郵件。你之後可隨時通過退訂連結取消。",
      action: "/consent",
      token,
      buttonLabel: "確認同意接收郵件",
    }));
  } catch (error) {
    return next(error);
  }
});

router.post("/consent", express.urlencoded({ extended: false }), (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw publicError("Missing consent token", 400);
    const payload = verifyConsentToken(token);
    const contact = findContactById(payload.contactId);
    if (!contact) throw publicError("Contact not found", 404);

    updateContactEmailState(contact.id, {
      marketingOptIn: true,
      marketingOptInAt: nowIso(),
      marketingConsentSource: "consent-page",
      unsubscribed: false,
      unsubscribedAt: "",
    });

    return res.status(200).type("html").send(renderPage({
      title: "已記錄訂閱同意",
      message: "謝謝，我們已記錄你的訂閱同意。你之後可隨時通過郵件中的退訂連結取消。",
    }));
  } catch (error) {
    return next(error);
  }
});

router.get("/unsubscribe", async (req, res, next) => {
  try {
    const { token } = req.query;
    await markUnsubscribed(token);
    return res.status(200).type("html").send(renderPage({
      title: "已成功退訂",
      message: "我們已記錄你的退訂請求，之後不會再向你發送營銷郵件。重要服務或交易通知不受影響。",
    }));
  } catch (error) {
    return next(error);
  }
});

router.post("/unsubscribe", express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    await markUnsubscribed(req.body.token || req.query.token);
    return res.status(200).type("html").send(renderPage({
      title: "已成功退訂",
      message: "我們已記錄你的退訂請求，之後不會再向你發送營銷郵件。",
    }));
  } catch (error) {
    return next(error);
  }
});

export default router;
