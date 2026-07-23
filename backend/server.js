import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { initializeDb } from "./db.js";
import contactsRouter from "./routes/contacts.js";
import emailsRouter from "./routes/emails.js";
import campaignsRouter from "./routes/campaigns.js";
import inboxRouter from "./routes/inbox.js";
import templatesRouter from "./routes/templates.js";
import analyticsRouter from "./routes/analytics.js";
import uploadsRouter from "./routes/uploads.js";
import webhooksRouter from "./routes/webhooks.js";
import unsubscribeRouter from "./routes/unsubscribe.js";
import archiveRouter from "./routes/archive.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
const frontendDir = path.resolve(__dirname, "../frontend");
const uploadsDir = path.resolve(__dirname, "data/uploads");

initializeDb();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const configuredOrigins = (process.env.CORS_ORIGIN || process.env.SITE_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.get("origin");
  const allowDevFileOrigin = process.env.NODE_ENV !== "production" && origin === "null";
  const allowAnyDevOrigin = process.env.NODE_ENV !== "production" && configuredOrigins.length === 0;
  const isAllowedOrigin = origin && (allowAnyDevOrigin || configuredOrigins.includes(origin) || allowDevFileOrigin);
  if (isAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

app.use("/api/resend", webhooksRouter);

app.use(express.json({ limit: "8mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tdc-crm-backend" });
});

app.use(unsubscribeRouter);
app.use(archiveRouter);

app.use("/api/admin", contactsRouter);
app.use("/api/admin", emailsRouter);
app.use("/api/admin", campaignsRouter);
app.use("/api/admin", inboxRouter);
app.use("/api/admin", templatesRouter);
app.use("/api/admin", analyticsRouter);
app.use("/api/admin", uploadsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "API route not found" });
});

app.use("/uploads", express.static(uploadsDir, { maxAge: "30d", immutable: true }));
app.use(express.static(frontendDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  const status = Number(err.status) || 500;
  if (status >= 500) {
    console.error(err);
  } else {
    console.warn(err.message);
  }
  res.status(status).json({
    ok: false,
    error: status >= 500 ? "Server error" : err.message,
  });
});

app.listen(port, host, () => {
  console.log(`TDC CRM backend listening on http://${host}:${port}`);
});
