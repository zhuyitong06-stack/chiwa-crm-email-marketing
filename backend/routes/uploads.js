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

function safeAssetFilename(filename = "") {
  const basename = path.basename(String(filename || ""));
  return /^[0-9]+-[0-9a-f-]+\.(gif|jpe?g|png|svg|webp)$/i.test(basename) ? basename : "";
}

function fileTypeFromExtension(filename = "") {
  const extension = path.extname(filename).toLowerCase();
  return extension === ".svg" ? "image/svg+xml" : `image/${extension.replace(".", "").replace("jpg", "jpeg")}`;
}

function assetFromFile(req, filename) {
  const filePath = path.join(uploadRoot, filename);
  const stat = fs.statSync(filePath);
  return {
    id: filename,
    src: publicAssetUrl(req, filename),
    name: filename,
    type: "image",
    mimeType: fileTypeFromExtension(filename),
    size: stat.size,
    createdAt: stat.birthtime?.toISOString?.() || stat.mtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  };
}

router.get("/email-assets", (req, res) => {
  const assets = fs
    .readdirSync(uploadRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => safeAssetFilename(entry.name))
    .filter(Boolean)
    .map((filename) => assetFromFile(req, filename))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  res.json({ ok: true, assets, data: assets });
});

router.post("/uploads/email-assets", upload.array("files", 12), (req, res) => {
  const files = req.files || [];
  const assets = files.map((file) => ({
    id: file.filename,
    src: publicAssetUrl(req, file.filename),
    name: file.originalname,
    type: "image",
    mimeType: file.mimetype,
    size: file.size,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  res.status(201).json({ ok: true, data: assets, assets });
});

router.delete("/email-assets/:filename", (req, res, next) => {
  const filename = safeAssetFilename(req.params.filename);
  if (!filename) return next(publicError("Invalid asset filename", 400));
  const filePath = path.join(uploadRoot, filename);
  if (!fs.existsSync(filePath)) return next(publicError("Asset not found", 404));
  fs.unlinkSync(filePath);
  return res.json({ ok: true, deleted: filename });
});

export default router;
