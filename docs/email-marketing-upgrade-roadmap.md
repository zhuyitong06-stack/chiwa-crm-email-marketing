# Email Marketing Upgrade Roadmap

Last checked: 2026-07-22

## Current Progress

The CRM is already running publicly at `https://crm.chiwa.ai/`.

Production capabilities already in place:

- CRM frontend and backend are deployed.
- Resend sending is handled only by backend.
- Event webhook is active at `/api/resend/webhook`.
- Inbound reply webhook is active at `/api/resend/inbound`.
- Inbox supports received replies, read/unread, thread status, assignee, reply templates, and open customer profile.
- Customer detail page supports sending, replying, draft saving, signature, sender identity, and template selection.
- Email templates support editing, deleting, and variables including `{{consentUrl}}` and `{{unsubscribeUrl}}`.
- Campaign page is a step-by-step workflow.
- Campaign audience filtering supports Lead ID and priority.
- Campaign report shows sent, delivered, opened, clicked, replied, bounced, complained, and unsubscribed.
- Unsubscribe writes back to CRM and blocks future marketing sends.
- Email behavior analytics endpoint exists at `/api/admin/analytics/email`.
- Topbar backend sync has been added.
- Seed CRM contacts were imported into backend contacts: 44 imported, 0 skipped.

Important remaining gap:

- The browser CRM still keeps rich customer profile fields locally.
- Backend `contacts` currently stores the core email/contact fields needed for mail flow.
- For a formal CRM product, full customer profile fields should move into backend storage.

## Recommended Skills

### Must Use For The Next Build Phase

1. `imagegen`

Use for campaign hero images, email visual assets, product graphics, banners, and thumbnails.

Best use cases:

- Generate campaign header image.
- Create reusable visual assets for email templates.
- Produce social/email banner variants.

2. `figma:figma-generate-design`

Use to turn the current CRM screens into a design board and plan better layout for marketing users.

Best use cases:

- Redesign the email composer.
- Redesign Campaign wizard.
- Design rich email template builder.
- Create clean Inbox and analytics layouts.

3. `figma:figma-generate-library`

Use for a reusable CRM/email-marketing design system.

Best use cases:

- Buttons, badges, tabs, cards, empty states.
- Email builder blocks.
- Campaign report components.
- Sender identity and compliance components.

4. `spreadsheets:Spreadsheets`

Use for CRM import/export, audience preparation, deduping, and campaign reports.

Best use cases:

- Clean customer lists.
- Deduplicate emails.
- Validate missing fields.
- Generate audience spreadsheets.
- Create campaign result reports.

5. `data-analytics:design-kpis`

Use to define the email marketing KPI framework.

Recommended core KPIs:

- Primary KPI: qualified reply rate.
- Driver KPI: delivered rate, open rate, click rate, template usage rate.
- Conversion KPI: click-to-consent, click-to-follow-up, click-to-campaign conversion.
- Guardrails: unsubscribe rate, complaint rate, hard bounce rate.

6. `data-analytics:build-dashboard`

Use after link tracking is implemented to build a proper marketing dashboard.

Best use cases:

- Campaign performance dashboard.
- Template performance dashboard.
- Lead priority conversion dashboard.
- Inbox response SLA dashboard.

7. `browser:control-in-app-browser`

Use for visual QA of `crm.chiwa.ai` after each production deployment.

Best use cases:

- Verify CRM pages load.
- Verify Campaign wizard layout.
- Verify email composer usability.
- Verify mobile/tablet responsiveness.

8. `github:github`

Use once a GitHub account/repository is connected.

Best use cases:

- Create GitHub issues from this roadmap.
- Track bugs and product phases.
- Review PRs before deployment.

9. `github:yeet`

Use after repository setup for commit/push/PR workflow.

Best use cases:

- Package each phase as a branch.
- Open a draft PR.
- Keep production deployments reviewable.

### Optional Connector Plugins

These are not Codex skills, but they would help operationally:

- Gmail: compare real inbox rendering and received mail behavior.
- Outlook Email: same as Gmail if company email runs on Microsoft 365.
- Google Drive: store images, CSV imports, campaign reports, and email briefs.
- Slack or Teams: notify team when high-priority leads reply or click.

## Product Target

Build a CRM email marketing system that can:

- Import and maintain customer profiles.
- Create visual email templates with images, buttons, and product cards.
- Send one-to-one emails from customer detail.
- Send bulk Campaign emails by Lead ID and priority.
- Track delivery, open, click, reply, unsubscribe, complaint, and bounce.
- Attribute clicks and replies back to customer records.
- Prevent future marketing sends after unsubscribe.
- Let non-technical users build and test marketing emails without touching Resend keys.

## Recommended Build Order

### Phase 1: Backendize Full CRM Profiles

Goal:

Move the full CRM customer profile into backend storage.

Build:

- Add `crm_profiles` table or extend `contacts`.
- Store company, contact person, title, website, industry, product category, target customer, pain points, needs, priority, owner, next follow-up, notes.
- Add API for full profile CRUD.
- Make CRM main table load from backend when Admin Token exists.
- Keep seed data only as demo fallback.

Acceptance criteria:

- CRM total count matches backend count.
- Refreshing browser does not lose customer profile edits.
- Replies and unsubscribe status attach to the same displayed customer rows.

### Phase 2: Rich Email Template Builder

Goal:

Make marketing users able to build visual email without coding HTML.

Build:

- Add template editor modes: Plain text / Rich blocks / HTML.
- Add blocks: header image, paragraph, button, divider, product card, footer.
- Add image URL field first; file upload can come later.
- Add mobile and desktop preview.
- Save rendered `htmlTemplate` and fallback `textTemplate`.
- Support variables: `{{contactName}}`, `{{company}}`, `{{email}}`, `{{consentUrl}}`, `{{unsubscribeUrl}}`.

Acceptance criteria:

- Template can be used from customer detail and Campaign.
- Marketing template always includes unsubscribe footer.
- Test send works before live send.

### Phase 3: Online Email Preview

Goal:

Support `View it online` links like mature email marketing tools.

Build:

- Add `email_previews` or campaign-render endpoint.
- Generate public preview URL for campaign/template render.
- Add `{{previewUrl}}` variable.
- Insert optional `View online` link in Marketing emails.

Acceptance criteria:

- Preview page opens without Admin Token.
- Preview does not expose CRM controls.
- Preview renders the same content sent through Resend.

### Phase 4: Link Tracking And Conversion Attribution

Goal:

Track clicks beyond Resend’s generic `email.clicked` event.

Build:

- Add `tracked_links` table.
- Rewrite links in outbound HTML to `/r/:token`.
- On click, write contactId, campaignId, messageId, originalUrl, clickedAt.
- Redirect to originalUrl.
- Map clicked links to lifecycle stage or conversion goal.

Acceptance criteria:

- Analytics page shows top clicked links.
- Customer detail shows clicked links in timeline.
- Campaign report shows per-link clicks.
- CRM funnel can move customers to “客户点击链接”.

### Phase 5: Campaign Intelligence

Goal:

Make Campaign useful for repeated marketing operations.

Build:

- Saved audience views.
- Exclusion rules: unsubscribed, complained, hard bounce, suppressed.
- Send throttling and batch queue.
- Campaign status: draft, scheduled, sending, paused, sent, failed.
- Per-campaign report page.
- Template performance comparison.

Acceptance criteria:

- Campaign can send safely to larger lists.
- Failed sends are visible.
- Report distinguishes delivered/opened/clicked/replied/unsubscribed.

### Phase 6: Inbox Sales Workflow

Goal:

Turn replies into follow-up work.

Build:

- SLA badge for unanswered replies.
- Owner assignment filter.
- Reply due date.
- Quick reply from Inbox.
- Customer timeline plus campaign context.
- Suggested next action based on reply/click state.

Acceptance criteria:

- Every inbound reply can be assigned, replied, closed, or opened as customer detail.
- Follow-up status appears on CRM main table.

## Suggested GitHub Issues

Create these once GitHub repository is connected:

1. Backendize full CRM profiles
2. Build rich email template editor
3. Add public online email preview
4. Add tracked redirect links and click attribution
5. Upgrade Campaign reports and send queue
6. Upgrade Inbox sales follow-up workflow
7. Remove or rename remaining `分流` UI
8. Add production smoke tests for CRM, Inbox, Template, Campaign, Analytics

## GitHub Connector Status

Current GitHub plugin check:

- Installed accounts: none
- Accessible repositories: none

Action needed:

Connect the GitHub app to the CRM repository, or create a new GitHub repository for this project. After that, Codex can create issues and organize the roadmap directly in GitHub.

