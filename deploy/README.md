# crm.chiwa.ai Production Deployment

This project should be deployed as one Node/Express service on `crm.chiwa.ai`.
The same public HTTPS origin serves:

- CRM frontend: `https://crm.chiwa.ai/`
- Admin API: `https://crm.chiwa.ai/api/admin/...`
- Resend events: `https://crm.chiwa.ai/api/resend/webhook`
- Resend inbound replies: `https://crm.chiwa.ai/api/resend/inbound`
- Marketing unsubscribe: `https://crm.chiwa.ai/unsubscribe?token=...`

## Manual Steps

1. Point Cloudflare DNS `crm.chiwa.ai` to the server that runs this Node app.
   Use an `A` record for a VPS IP or a `CNAME` if the host gives a canonical hostname.
   If `crm.chiwa.ai` is already attached to another website or app, remove that binding first;
   otherwise Cloudflare may keep routing it to the old site and `/api/health` will not reach this CRM backend.

2. On the server, install Node.js 24, pnpm, Nginx, and Certbot.

3. Copy this project to `/opt/tdc-crm-web`.

4. In `/opt/tdc-crm-web/backend`, copy `.env.production.example` to `.env`.
   Fill in real secrets:
   - `RESEND_API_KEY`
   - `RESEND_WEBHOOK_SECRET`
   - `ADMIN_API_TOKEN`
   - `UNSUBSCRIBE_TOKEN_SECRET`
   - `COMPANY_POSTAL_ADDRESS`

5. Install backend dependencies:

   ```bash
   cd /opt/tdc-crm-web/backend
   pnpm install --prod
   pnpm run check:production
   ```

6. Install the systemd service:

   ```bash
   sudo cp /opt/tdc-crm-web/deploy/systemd/tdc-crm.service /etc/systemd/system/tdc-crm.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now tdc-crm
   ```

7. Install the Nginx config and issue the certificate:

   ```bash
   sudo cp /opt/tdc-crm-web/deploy/nginx.crm.chiwa.ai.conf /etc/nginx/sites-available/crm.chiwa.ai
   sudo ln -s /etc/nginx/sites-available/crm.chiwa.ai /etc/nginx/sites-enabled/crm.chiwa.ai
   sudo nginx -t
   sudo certbot --nginx -d crm.chiwa.ai
   sudo systemctl reload nginx
   ```

8. Configure Resend webhooks:

   Event webhook endpoint:

   ```text
   https://crm.chiwa.ai/api/resend/webhook
   ```

   Select:

   ```text
   email.sent
   email.delivered
   email.delivery_delayed
   email.failed
   email.opened
   email.clicked
   email.bounced
   email.complained
   email.unsubscribed
   email.suppressed
   ```

   Inbound reply endpoint:

   ```text
   https://crm.chiwa.ai/api/resend/inbound
   ```

   Select:

   ```text
   email.received
   ```

9. Copy the Resend webhook signing secret into `RESEND_WEBHOOK_SECRET`.
   Restart the app:

   ```bash
   sudo systemctl restart tdc-crm
   ```

10. Test:

   ```bash
   curl https://crm.chiwa.ai/api/health
   ```

   Expected:

   ```json
   {"ok":true,"service":"tdc-crm-backend"}
   ```

## DNS Records Still Recommended

Add a DMARC record for the sending subdomain:

```text
Type: TXT
Name: _dmarc.promotion
Content: v=DMARC1; p=none;
Proxy: DNS only
```

After mail flow is stable, move DMARC toward `quarantine` or `reject`.
