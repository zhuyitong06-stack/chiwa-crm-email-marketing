# Email Marketing Template Designer

## Current Implementation

- Frontend entry: `frontend/index.html`
- Designer logic: `frontend/app.js`
- Designer styles: `frontend/styles.css`
- Vendor files:
  - `frontend/vendor/grapes.min.js`
  - `frontend/vendor/grapes.min.css`
  - `frontend/vendor/grapesjs-preset-newsletter.min.js`
- Backend image upload API: `POST /api/admin/uploads/email-assets`
- Uploaded images are served from `/uploads/email-assets/:filename`.

The current CRM frontend is a static app, not React or Vue. GrapesJS is embedded directly as a browser SDK to avoid changing the existing deployment model.

## Template Storage

The designer saves templates into the existing `email_templates` table:

- `subjectTemplate`
- `htmlTemplate`
- `textTemplate`
- `variables.designerProject`

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

The current production editor remains GrapesJS because the CRM frontend is a static browser app.

`zalify/easy-email-editor` is the recommended replacement direction, but it is a React + MJML editor, not a drop-in browser SDK. A safe migration should add a React build pipeline and run the new editor beside the current template API first.

Recommended migration steps:

1. Add a React/Vite editor bundle under `frontend/editor/`.
2. Install Easy Email packages in that bundle.
3. Save Easy Email JSON/MJML into `email_templates.variables.easyEmail`.
4. Continue saving rendered HTML into `email_templates.htmlTemplate`.
5. Keep the existing Resend send APIs unchanged.
6. After visual QA and test sends pass, hide the GrapesJS page.

This lets the editor be replaced without touching Inbox, Resend webhooks, Campaign sending, unsubscribe, or customer email timelines.

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
