import dns from "node:dns";
import { promises as dnsPromises } from "node:dns";

const expectedSiteUrl = "https://crm.chiwa.ai";
const expectedDomain = "promotion.chiwa.ai";
const failures = [];
const warnings = [];

dns.setServers(["1.1.1.1", "8.8.8.8"]);

function env(name) {
  return String(process.env[name] || "").trim();
}

function requireEnv(name, options = {}) {
  const value = env(name);
  if (!value) {
    failures.push(`${name} is missing`);
    return "";
  }
  if (options.minLength && value.length < options.minLength) {
    failures.push(`${name} is too short; expected at least ${options.minLength} characters`);
  }
  return value;
}

function senderDomain(value) {
  const email = (value.match(/<([^>]+)>/) || value.match(/([^\s<>]+@[^\s<>]+)/) || [])[1] || "";
  return email.split("@")[1] || "";
}

async function dnsCheck(label, resolver) {
  try {
    const records = await resolver();
    console.log(`${label}: OK (${records.length})`);
  } catch (error) {
    failures.push(`${label}: ${error.code || error.message}`);
  }
}

async function resendCheck(apiKey) {
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      failures.push(`Resend API check failed with HTTP ${response.status}`);
      return;
    }
    const payload = await response.json();
    const domains = Array.isArray(payload.data) ? payload.data : [];
    const domain = domains.find((item) => item.name === expectedDomain);
    if (!domain) {
      failures.push(`Resend domain ${expectedDomain} was not returned by the API key`);
      return;
    }
    if (domain.status !== "verified") {
      failures.push(`Resend domain ${expectedDomain} is ${domain.status || "not verified"}`);
      return;
    }
    console.log(`Resend domain ${expectedDomain}: OK`);
  } catch (error) {
    failures.push(`Resend API check failed: ${error.message}`);
  }
}

const resendApiKey = requireEnv("RESEND_API_KEY", { minLength: 24 });
requireEnv("RESEND_WEBHOOK_SECRET", { minLength: 24 });
if (!env("RESEND_INBOUND_SECRET")) {
  warnings.push("RESEND_INBOUND_SECRET is not set; inbound endpoint will use RESEND_WEBHOOK_SECRET");
}
requireEnv("ADMIN_API_TOKEN", { minLength: 32 });
requireEnv("UNSUBSCRIBE_TOKEN_SECRET", { minLength: 32 });
requireEnv("COMPANY_POSTAL_ADDRESS", { minLength: 20 });

const siteUrl = requireEnv("SITE_URL");
if (siteUrl && siteUrl !== expectedSiteUrl) failures.push(`SITE_URL should be ${expectedSiteUrl}`);

const corsOrigin = requireEnv("CORS_ORIGIN");
if (corsOrigin && !corsOrigin.split(",").map((item) => item.trim()).includes(expectedSiteUrl)) {
  failures.push(`CORS_ORIGIN should include ${expectedSiteUrl}`);
}

for (const key of ["FROM_TRANSACTIONAL", "FROM_SUPPORT", "FROM_MARKETING"]) {
  const value = requireEnv(key);
  const domain = senderDomain(value);
  if (domain !== expectedDomain) failures.push(`${key} should use @${expectedDomain}`);
}

await dnsCheck(`MX ${expectedDomain}`, () => dnsPromises.resolveMx(expectedDomain));
await dnsCheck(`MX send.${expectedDomain}`, () => dnsPromises.resolveMx(`send.${expectedDomain}`));
await dnsCheck(`TXT send.${expectedDomain}`, () => dnsPromises.resolveTxt(`send.${expectedDomain}`));
await dnsCheck(`TXT resend._domainkey.${expectedDomain}`, () => dnsPromises.resolveTxt(`resend._domainkey.${expectedDomain}`));

try {
  await dnsPromises.resolveTxt(`_dmarc.${expectedDomain}`);
  console.log(`TXT _dmarc.${expectedDomain}: OK`);
} catch {
  warnings.push(`TXT _dmarc.${expectedDomain} is missing; add DMARC for the sending subdomain`);
}

if (resendApiKey) await resendCheck(resendApiKey);

warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log("Production checks passed.");
