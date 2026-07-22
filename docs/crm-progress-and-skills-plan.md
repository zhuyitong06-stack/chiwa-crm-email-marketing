# CRM Email Marketing Progress And Skills Plan

Last checked: 2026-07-22

## Production Status

- Public CRM URL: `https://crm.chiwa.ai/`
- Health check: `https://crm.chiwa.ai/api/health` returns `ok: true`
- Server: `103.30.78.170`
- Service: `tdc-crm` is active
- Runtime port: Node/Express listens on `127.0.0.1:3100`
- Public routing: Nginx proxies `crm.chiwa.ai` to `127.0.0.1:3100`
- HTTPS: LetsEncrypt certificate is active through Nginx

## Current Feature Progress

- CRM frontend is deployed under `frontend/`
- Backend is deployed under `backend/`
- Resend sending is integrated through backend only
- Resend event webhook endpoint is active: `/api/resend/webhook`
- Resend inbound reply endpoint is active: `/api/resend/inbound`
- Consent page endpoint is active: `/consent?token=...`
- Unsubscribe endpoint is active: `/unsubscribe?token=...`
- Email templates support `{{consentUrl}}` and `{{unsubscribeUrl}}`
- Inbox supports inbound replies, read/unread, thread status, assignee, reply template, and open customer profile
- Campaign page has a step-by-step flow
- Campaign audience filtering supports Lead ID and priority
- Email behavior analytics endpoint is active: `/api/admin/analytics/email`
- Marketing emails default to send unless the customer is unsubscribed, complained, bounced, or suppressed
- Customer unsubscribe writes back to CRM and blocks future marketing sends

## Latest Backend Smoke Check

The production backend returned:

- Contacts API: OK, 46 backend contacts after seed import
- Inbox API: OK, 2 inbound messages
- Campaign API: OK, 1 campaign
- Templates API: OK, 1 template
- Email analytics API: OK

## Important Risk Found

The browser UI originally showed `44` customers, while the production backend contacts API returned only `2` contacts.

This was improved on 2026-07-22:

- Added a topbar `同步後端` action.
- Added a frontend backend-sync status badge.
- Admin Token input now schedules a backend sync.
- File imports and customer saves can sync the current CRM customers into the backend.
- Deployed seed customer data into the backend: `44` imported, `0` skipped.

There are currently `46` backend contacts because two previous manual/test contacts remain:

- `MANUAL-0045`
- `MANUAL-0002`

Do not delete those without confirming whether they are still needed for testing.

Remaining data-source risk: the browser UI still keeps a rich local CRM profile as the main working dataset, while the backend `contacts` table stores the core email/contact fields needed for sending, receiving, consent, unsubscribe, and campaign matching. For formal email marketing, the long-term architecture should move the full CRM profile into the backend database. Otherwise:

- Campaign audience estimates may not match what users see in the CRM table.
- Webhook replies can write into backend records but not appear against the local-only customer rows.
- Consent and unsubscribe status may not align with displayed rows.
- Bulk marketing can miss customers or send to the wrong subset.

Recommended next engineering step:

1. Extend backend contacts or add a `crm_profiles` table for full CRM fields.
2. On page load, if admin access is configured, load full CRM profiles from backend.
3. Keep local seed data only as a fallback demo mode.
4. Add migration for existing browser-local customer profile data.

## UI Gap Still Visible

The live UI still contains some `分流` surfaces:

- Dashboard section: `分流分佈`
- Filter: `分流`
- Customer drawer field: `分流`

Previous product direction was to remove the CRM main table `分流` field and use Lead ID plus priority for Campaign filtering. If `分流` is no longer part of the operating model, these remaining UI sections should be removed or renamed.

Recommended next engineering step:

1. Remove `分流` filter from the main dashboard filters.
2. Remove or replace `分流分佈`.
3. Remove `分流` from the customer drawer unless it is still needed for service categorization.
4. Keep Campaign filtering focused on Lead ID and priority.

## Skills And Plugin Deployment Plan

### Already Available In This Codex Environment

- `browser:control-in-app-browser`
  Use for browsing `crm.chiwa.ai`, visual QA, and checking the user-facing CRM workflow.

- `github:github`
  Use for repository, issue, and PR workflows after GitHub connector access is available.

- `github:yeet`
  Use when changes are ready to commit, push, and open a draft PR.

- `github:gh-fix-ci`
  Use after GitHub Actions is connected and a check fails.

- `imagegen`
  Use for creating email hero images, campaign graphics, product visuals, and template assets.

- `spreadsheets:Spreadsheets`
  Use for CSV/XLSX contact imports, deduping, audience lists, and campaign reports.

- `figma:figma-generate-design`
  Use for turning the CRM and email composer into a professional design board.

- `figma:figma-generate-library`
  Use for a reusable CRM/email marketing design system.

### Recommended Optional Plugins

- Gmail plugin
  Useful if the team wants to compare CRM outbound messages with a real Gmail inbox or review sent/received emails from a connected mailbox.

- Outlook Email plugin
  Useful if the company works mainly through Microsoft 365 and wants inbox comparison or operational email workflows.

- Google Drive plugin
  Useful for storing exported campaign reports, image assets, CSV imports, and marketing briefs.

- Slack or Teams plugin
  Useful for notifying the team when a campaign is sent, a customer replies, or a high-priority lead clicks.

### GitHub Status

The current local remote is a Sites remote, not a normal GitHub repository:

`https://git.chatgpt-team.site/...`

The GitHub connector was attempted but returned a temporary connection failure to the plugin backend. Once it is available, the recommended GitHub setup is:

1. Connect or create a GitHub repository for this CRM project.
2. Commit `frontend/`, `backend/`, `deploy/`, and `docs/`.
3. Exclude production secrets and database files.
4. Create GitHub issues for each upgrade phase.
5. Use PRs for production changes.

## Suggested GitHub Issues

### Issue 1: Backend Data Source For CRM Main Table

Make the CRM main table load from `/api/admin/contacts` when admin access is configured. Keep seed data only for demo fallback. Add an import workflow that writes uploaded contacts into the backend database.

Acceptance criteria:

- Main table count matches backend contacts count.
- Imported contacts are visible after refresh.
- Replies, consent, unsubscribe, and campaign status attach to the same contact rows.
- UI clearly shows backend mode versus demo mode.

### Issue 2: Remove Or Replace Remaining 分流 UI

Remove remaining `分流` UI surfaces or rename them to the current operating category if still needed.

Acceptance criteria:

- Main filters no longer depend on `分流`.
- Dashboard no longer shows `分流分佈` unless product decides to keep service categorization.
- Campaign uses Lead ID and priority as primary filters.

### Issue 3: Rich Image Email Builder

Add a visual email builder that supports:

- Header image
- Text blocks
- Buttons
- Product cards
- Image upload or image URL
- Mobile preview
- Desktop preview
- Plain-text fallback
- Automatic unsubscribe footer for Marketing

Acceptance criteria:

- Generated email works in Resend.
- Preview is close to actual inbox rendering.
- Template can be saved and reused from customer detail and Campaign.

### Issue 4: Online Email Preview Page

Generate a public preview URL for each campaign email similar to `View it online`.

Acceptance criteria:

- Email contains an optional `View online` link.
- Preview page does not expose admin controls.
- Preview uses the rendered campaign/template content.

### Issue 5: Link Tracking And Conversion Attribution

Wrap outbound links so clicks can be tracked and attributed to contacts, campaigns, and conversions.

Acceptance criteria:

- Click events update email analytics.
- Links can map to conversion stages.
- Analytics page shows top links, clicked contacts, and campaign conversion rate.

## Recommended Next Build Order

1. Fix backend data source for CRM main table.
2. Remove or replace remaining `分流` UI.
3. Add rich image email template builder.
4. Add public email preview pages.
5. Add link tracking redirects.
6. Connect GitHub repository and create the issue backlog.
7. Add CI check for backend syntax and frontend smoke markers.
