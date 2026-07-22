import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const vendorDir = path.join(frontendDir, "vendor");

function findFirst(existingPaths) {
  const found = existingPaths.find((item) => fs.existsSync(path.join(frontendDir, item)));
  if (!found) return "";
  return found;
}

function findGrapesCss() {
  const direct = "node_modules/grapesjs/dist/css/grapes.min.css";
  if (fs.existsSync(path.join(frontendDir, direct))) return direct;
  const pnpmDir = path.join(frontendDir, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) return "";
  const packageDir = fs.readdirSync(pnpmDir).find((name) => /^grapesjs@/.test(name));
  return packageDir ? `node_modules/.pnpm/${packageDir}/node_modules/grapesjs/dist/css/grapes.min.css` : "";
}

const files = [
  [findFirst(["node_modules/grapesjs/dist/grapes.min.js"]), "grapes.min.js"],
  [findGrapesCss(), "grapes.min.css"],
  [findFirst(["node_modules/grapesjs-preset-newsletter/dist/index.js"]), "grapesjs-preset-newsletter.min.js"],
];

fs.mkdirSync(vendorDir, { recursive: true });

for (const [source, target] of files) {
  const sourcePath = path.join(frontendDir, source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing vendor source: ${source}`);
  }
  fs.copyFileSync(sourcePath, path.join(vendorDir, target));
}

console.log(`Synced ${files.length} GrapesJS vendor files.`);
