# Chiwa CRM Email Marketing

CRM digital marketing system for customer management, Resend email sending/receiving, campaign workflows, inbox handling, consent, unsubscribe, and email behavior analytics.

Production site:

- `https://crm.chiwa.ai/`

## Project Structure

```text
frontend/
  index.html
  app.js
  styles.css
  seed-data.js
  vendor/

backend/
  server.js
  db.js
  resend.js
  routes/

deploy/
  README.md
  nginx.crm.chiwa.ai.conf
  systemd/tdc-crm.service

docs/
  crm-progress-and-skills-plan.md
  email-marketing-upgrade-roadmap.md
```

## Current Capabilities

- CRM customer table and customer detail drawer
- Backend-only Resend API integration
- One-to-one email sending from customer detail
- Inbound email receiving through Resend webhook
- Inbox with read/unread, status, assignee, reply template, and customer profile link
- Email templates with `{{consentUrl}}` and `{{unsubscribeUrl}}`
- Campaign workflow with audience selection, template selection, preview, test send, live send, and reports
- Consent and unsubscribe pages
- Email behavior analytics
- Production deployment through Nginx and systemd

## Secrets

Do not commit production secrets.

Server-only values belong in `backend/.env`, including:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_INBOUND_SECRET`
- `ADMIN_API_TOKEN`
- `CONSENT_TOKEN_SECRET`
- `UNSUBSCRIBE_TOKEN_SECRET`
- `COMPANY_POSTAL_ADDRESS`

Use:

- `backend/.env.example`
- `backend/.env.production.example`

as templates.

## Backend

```bash
cd backend
pnpm install
pnpm run check
pnpm run dev
```

Default local backend:

- `http://127.0.0.1:3100`

Production backend is served through:

- `https://crm.chiwa.ai/`

## Deployment

See:

- `deploy/README.md`

for VPS, Nginx, systemd, and Resend webhook setup.

## Roadmap

See:

- `docs/email-marketing-upgrade-roadmap.md`
- `docs/crm-progress-and-skills-plan.md`

