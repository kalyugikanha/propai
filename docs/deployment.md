# Production Deployment Guide
## PropAI Backend → Railway

---

## Step 1 — Create a Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)

---

## Step 2 — Deploy from GitHub

### Option A — Deploy from GitHub (Recommended)

1. Push your `backend/` folder to a GitHub repository
2. In Railway → **New Project → Deploy from GitHub repo**
3. Select your repository
4. Railway will auto-detect Node.js and deploy

### Option B — Deploy with Railway CLI

```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```

---

## Step 3 — Set Environment Variables in Railway

In your Railway project → **Variables tab**, add all variables from `.env.example`:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `GOOGLE_SPREADSHEET_ID` | Your Google Sheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the entire JSON (one line) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | Your WordPress site URL (e.g., `https://yoursite.com`) |
| `PORT` | Leave empty (Railway auto-sets this) |
| `AGENCY_NAME` | Your agency name |
| `AGENT_NAME` | Your agent name |

> **CORS_ORIGIN**: In production, set this to your exact WordPress domain, not `*`. This prevents other websites from using your API.

---

## Step 4 — Get Your Backend URL

After deployment, Railway gives you a URL like:
```
https://propai-production-XXXX.up.railway.app
```

Copy this URL.

---

## Step 5 — Update the WordPress Widget

In the WordPress embed snippet, replace `YOUR-BACKEND.railway.app`:

```html
<script>
  window.PropAiConfig = {
    apiBase: 'https://propai-production-XXXX.up.railway.app',
    agencyName: 'Your Agency Name',
    agentName: 'Priya',
    position: 'right'
  };
</script>
<script src="https://propai-production-XXXX.up.railway.app/widget/propai-widget.js" defer></script>
```

---

## Step 6 — Add to WordPress

1. Log into WordPress admin
2. Go to **Appearance → Theme Editor → footer.php**
3. Paste the embed snippet **just before** `</body>`
4. Click **Update File**

OR use a plugin:
- Install **"Insert Headers and Footers"** plugin
- Go to **Settings → Insert Headers and Footers**
- Paste snippet in **Scripts in Footer**

---

## Verification Checklist

- [ ] Backend health check: `https://your-backend.railway.app/health`
- [ ] Properties load: `https://your-backend.railway.app/api/properties`
- [ ] Widget appears on WordPress site (bottom right)
- [ ] Chat flow works end-to-end
- [ ] Lead appears in Google Sheets after completing chat

---

## Monitoring

- Railway provides logs under the **Deployments** tab
- Winston logs are stored in `logs/` directory locally
- For production monitoring, add [Sentry](https://sentry.io) or [Logtail](https://logtail.com)

---

## Cost Estimate (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Railway | Hobby (512MB RAM) | $5/month |
| Gemini API | gemini-2.0-flash | ~$0.01–$2/month (very low for chat) |
| Google Sheets API | Free tier | Free |
| **Total** | | **~$5–7/month** |
