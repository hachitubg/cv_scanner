# Lệ HR - CV Manager Scanner Deploy Notes

## VPS layout

- App directory: `/var/www/cv_scanner`
- PM2 process: `cv-scanner`
- Internal app port: `3002`
- Existing apps use ports `3000` and `3001`; keep Lệ HR - CV Manager Scanner on `3002` unless Nginx is updated accordingly.
- Runtime logs:
  - PM2 logs: `pm2 logs cv-scanner`
  - App logs: `logs/app-YYYY-MM-DD.log`
  - Weekly cleanup cron log: `/var/log/cv-scanner-cleanup.log`

## Environment

Do not commit real `.env` values.

Required production keys:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="<strong-random-secret>"
NEXTAUTH_URL="https://<your-domain>"
APP_URL="https://<your-domain>"
EMAIL_PROVIDER="brevo"
EMAIL_FROM="<verified-sender-email>"
BREVO_API_KEY="<brevo-api-key>"
CV_FILE_RETENTION_MONTHS="3"
CV_FILE_CLEANUP_BATCH_SIZE="100"
CV_FILE_CLEANUP_HOUR="2"
CV_FILE_CLEANUP_MINUTE="0"
```

After changing `.env`:

```bash
cd /var/www/cv_scanner
pm2 restart cv-scanner --update-env
pm2 save
```

## Nginx domain config

Create an Nginx server block that proxies the domain to the internal app:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name <your-domain> www.<your-domain>;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Apply:

```bash
ln -s /etc/nginx/sites-available/cv-scanner /etc/nginx/sites-enabled/cv-scanner
nginx -t
systemctl reload nginx
certbot --nginx -d <your-domain> -d www.<your-domain>
```

After SSL is issued, update `NEXTAUTH_URL` and `APP_URL` to `https://<your-domain>`.

## Deploy/update flow

```bash
cd /var/www/cv_scanner
git pull
npm ci
npm run db:push
npm run build
pm2 restart cv-scanner --update-env
pm2 save
```

The VPS currently needs swap for `next build`. Do not remove `/swapfile` unless RAM is upgraded.

## Weekly cleanup

Cron file:

```text
/etc/cron.d/cv-scanner-cleanup
```

Schedule:

```cron
0 2 * * 0 root cd /var/www/cv_scanner && npm run jobs:cleanup-cv-files >> /var/log/cv-scanner-cleanup.log 2>&1
```

The cleanup job keeps database records, deletes old physical CV files, archives old `rawText` into gzip files, clears `filePath/rawText`, and runs SQLite `VACUUM`.

## Quick checks

```bash
pm2 list
pm2 logs cv-scanner --lines 80
curl -I http://127.0.0.1:3002
nginx -t
systemctl status nginx --no-pager
```
