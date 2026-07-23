# Email Marketing Template Designer

## Current Implementation

- Frontend entry: `frontend/index.html`
- Easy Email editor entry: `frontend/easy-email.html`
- Designer logic: `frontend/app.js`
- Easy Email source: `frontend/easy-email-src/main.jsx`
- Designer styles: `frontend/styles.css`
- Vendor files:
  - `frontend/vendor/grapes.min.js`
  - `frontend/vendor/grapes.min.css`
  - `frontend/vendor/grapesjs-preset-newsletter.min.js`
  - `frontend/vendor/easy-email-app.js`
  - `frontend/vendor/easy-email-app.css`
- Backend image upload API: `POST /api/admin/uploads/email-assets`
- Uploaded images are served from `/uploads/email-assets/:filename`.

The CRM frontend is still a static app, but a React/Vite Easy Email bundle is now built into `frontend/vendor/` and opened through `/easy-email.html`.

GrapesJS remains available as the legacy editor so existing templates can be recovered if needed.

## Template Storage

The designer saves templates into the existing `email_templates` table:

- `subjectTemplate`
- `htmlTemplate`
- `textTemplate`
- `variables.designerProject`
- `variables.easyEmail`
- `variables.mjmlTemplate`

Existing customer email sending and Campaign sending continue using the same backend template API.

## Supported Compliance Placeholders

Both camelCase and snake_case placeholders are supported:

- `{{unsubscribeUrl}}` / `{{unsubscribe_url}}`
- `{{consentUrl}}` / `{{consent_url}}`
- `{{webArchiveUrl}}` / `{{web_archive_url}}`
- `{{contactName}}` / `{{contact_name}}`
- `{{company}}`
- `{{email}}`

For Marketing emails, the backend still appends the company postal address and unsubscribe footer during sending.

## Web Archive Links

`{{web_archive_url}}` is now generated at send time.

When a one-to-one email or Campaign email is sent, the backend creates a signed archive token and renders:

```text
https://crm.chiwa.ai/archive?token=...
```

The public archive page verifies the token and displays the exact HTML stored for that sent email. This means the "查看網頁版" link should point to the sent email's web version, not the company website.

Preview mode still uses:

```text
https://crm.chiwa.ai/archive?token=preview
```

That preview URL is only a placeholder; real links are created during sending.

## Editor Engine Direction

Easy Email is now available as a parallel editor at:

```text
https://crm.chiwa.ai/easy-email.html
```

It uses:

- `easy-email-editor`
- `easy-email-core`
- `easy-email-extensions`
- `mjml-browser`
- React 18

The new editor saves:

- Easy Email JSON to `variables.easyEmail`
- MJML to `variables.mjmlTemplate`
- rendered email HTML to `htmlTemplate`
- plain text fallback to `textTemplate`

The send flow remains unchanged: one-to-one email and Campaign still use `htmlTemplate`, so Resend, Inbox, tracking, unsubscribe, and customer timelines are not touched.

## Easy Email Image Workflow

The Easy Email page now includes a CRM-backed asset strip:

1. Upload an image from the top toolbar.
2. The browser sends it to `POST /api/admin/uploads/email-assets`.
3. The backend stores it under `backend/data/uploads/email-assets`.
4. The returned public URL is inserted into a real Easy Email image block.
5. Saving the template exports MJML and HTML containing the image URL.

This fixes the earlier issue where upload only copied a URL into a text field but did not place the image into the email JSON. The image must be inserted into the Easy Email block tree so it appears in the visual canvas and exported HTML.

The page also includes explicit controls for:

- adding or deleting the opening "查看網頁版" component
- adding or deleting the closing compliance component
- refreshing existing uploaded assets
- inserting uploaded assets into the email body
- changing the opening component background color
- changing the closing compliance component background color
- inserting highlighted text blocks
- inserting editable text links
- inserting editable button links
- choosing button alignment: left, center, or right
- applying one alignment to all CTA button blocks
- inserting a footer contact icon bar for WhatsApp, WeChat, email, and website links

The link tools save the URL directly into the Easy Email JSON and exported HTML. Use them for CTA buttons, partner links, product pages, web archive links, or other campaign-specific destinations.

Button alignment is saved into the underlying MJML button attributes, so the sent email keeps the chosen left, center, or right placement in customer inboxes instead of only appearing centered inside the editor.

The footer contact icon bar uses email-safe inline HTML, not external icon images. This keeps it more stable across Gmail, Outlook, and mobile mail clients.

Existing CRM templates can be opened in the new editor from the template list through "新版 Easy Email". Templates that already contain `variables.easyEmail` reopen as full editable Easy Email projects. Older HTML-only templates are imported as a raw HTML material block so they can be reviewed, adjusted, and saved back as reusable Easy Email templates.

## Email Record Cleanup

CRM email records can now be cleaned without touching customers' real mailboxes:

- delete a single message from the customer timeline or Inbox thread
- clear all messages in the current Inbox thread
- clear all messages for the currently opened customer

These actions remove CRM-side `email_messages` records only. Resend delivery history and the recipient's inbox are not modified.

## Marketing Analytics

The "分析與轉化" page now prioritizes email marketing metrics instead of the old segment/funnel view. It shows sent count, delivery rate, open rate, click rate, reply conversion rate, combined conversion rate, unsubscribe rate, and recent Resend behavior events.

## Campaign Flow

The Campaign page now starts from the email content instead of the recipient filter:

1. Select the email template.
2. Review or adjust the campaign subject and body.
3. Connect the campaign to CRM contacts.
4. Filter recipients by Lead ID, priority, and saved audience view.
5. Estimate the eligible audience before preview, test send, or production send.

The backend audience rules remain unchanged: customers who bounced, complained, were suppressed, or unsubscribed are excluded from Marketing campaign sends.

Next migration steps:

1. Create several production Easy Email templates.
2. Run test sends to Gmail, Outlook, and mobile mail clients.
3. Confirm image sizing, text spacing, CTA links, and archive links.
4. After QA passes, hide or remove the GrapesJS entry from the CRM tab.

## CDN / OSS Upgrade Point

The current upload route stores images on the CRM server under `backend/data/uploads/email-assets`.

To switch to Cloudflare R2, S3, Alibaba OSS, or another CDN, replace the storage logic inside:

`backend/routes/uploads.js`

The frontend does not need to change as long as the API continues returning:

```json
{
  "ok": true,
  "assets": [
    {
      "src": "https://cdn.example.com/path/image.png",
      "name": "image.png",
      "type": "image"
    }
  ]
}
```
