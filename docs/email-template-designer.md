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
