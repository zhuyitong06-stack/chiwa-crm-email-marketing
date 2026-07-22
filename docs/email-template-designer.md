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
