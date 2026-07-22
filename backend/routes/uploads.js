import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { requireAdmin } from "../auth.js";
import { publicError } from "../utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, "../data/uploads/email-assets");
const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
]);

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadRoot),
  filename: (_req, file, callback) => {
    const extension = allowedTypes.get(file.mimetype) || path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(publicError("Only image files are allowed", 400));
    return callback(null, true);
  },
});

const router = express.Router();

router.use(requireAdmin);

function publicAssetUrl(req, filename) {
  const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
  return new URL(`/uploads/email-assets/${filename}`, baseUrl).toString();
}

router.post("/uploads/email-assets", upload.array("files", 12), (req, res) => {
  const files = req.files || [];
  const assets = files.map((file) => ({
    src: publicAssetUrl(req, file.filename),
    name: file.originalname,
    type: "image",
  }));
  res.status(201).json({ ok: true, data: assets, assets });
});

export default router;
