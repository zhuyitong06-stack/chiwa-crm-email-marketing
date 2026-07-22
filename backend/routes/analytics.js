import express from "express";
import { requireAdmin } from "../auth.js";
import { emailBehaviorAnalytics } from "../db.js";

const router = express.Router();

router.use(requireAdmin);

router.get("/analytics/email", (_req, res) => {
  res.json({ ok: true, analytics: emailBehaviorAnalytics() });
});

export default router;
