# Google Sheets Setup Guide
## PropAI — Service Account Creation (5 Minutes)

This guide walks you through giving the PropAI backend read/write access to your Google Sheet.

---

## Part 1 — Enable Google Sheets API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the **project selector** at the top → **New Project**
   - Name: `PropAI`
   - Click **Create**
3. With the new project selected, go to **APIs & Services → Library**
4. Search for **"Google Sheets API"**
5. Click it → click **Enable**

---

## Part 2 — Create a Service Account

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service Account**
3. Fill in:
   - Service account name: `propai-sheets-bot`
   - Service account ID: (auto-filled)
   - Description: `PropAI backend access to Google Sheets`
4. Click **Create and Continue**
5. For **Role**, select **Editor** (or **Basic → Editor**)
6. Click **Continue** → **Done**

---

## Part 3 — Download the JSON Key

1. On the Credentials page, find your service account → click it
2. Go to the **Keys** tab
3. Click **Add Key → Create new key**
4. Select **JSON** → click **Create**
5. A `.json` file will download automatically — **keep this safe!**

---

## Part 4 — Share Your Google Sheet with the Service Account

> [!IMPORTANT]
> This step is often missed. Without it, the API will return a 403 error.

1. Open the downloaded JSON key file in Notepad
2. Find the `"client_email"` field — copy the email address
   - It looks like: `propai-sheets-bot@propai-XXXXX.iam.gserviceaccount.com`
3. Open your Google Sheet (both Properties and Leads if separate)
4. Click **Share** (top right)
5. Paste the service account email
6. Set permission to **Editor**
7. Click **Send** (no notification needed)

---

## Part 5 — Add Credentials to .env

You have two options:

### Option A — Inline JSON (Recommended for Railway)

1. Open the downloaded JSON file
2. Copy the **entire content**
3. In your `.env` file, set:

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n","client_email":"propai-sheets-bot@..."}
```

> **Important**: The `private_key` field contains `\n` newlines. When pasting into `.env`, these should remain as literal `\n` — NOT actual newlines.

### Option B — Key File Path

1. Create a `credentials/` folder inside `backend/`
2. Copy the downloaded JSON file there as `service-account.json`
3. Add to `.gitignore`: `credentials/`
4. In your `.env` file, set:

```env
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/service-account.json
```

---

## Part 6 — Set Up Your Sheet Structure

### Properties Sheet (tab name: "Properties")

The first row **must** be headers. Columns can be in any order:

| Project ID | Project Name | Location | Property Type | Min Budget | Max Budget | Size (Sqft) | Status | Description |
|------------|-------------|----------|---------------|------------|------------|-------------|--------|-------------|
| P001 | Green Valley Villas | Jagatpura | Villa | 800000 | 5000000 | 2200 | Active | Luxury villas with pool |
| P002 | Royal Residency | Vaishali Nagar | Apartment | 2500000 | 8000000 | 1200 | Active | Premium apartments |

- **Status must be "Active"** for a property to appear in search results
- **Min Budget and Max Budget** are in **full rupees** (e.g., 5000000 = 50 Lakhs)
- You can add any additional columns — the backend will include them automatically

### Leads Sheet (tab name: "Leads")

Create this tab with headers in **row 1**, in this exact order:

| Date | Name | Mobile Number | Property Type | Preferred Location | Budget | Recommended Projects | Lead Status | Notes |
|------|------|---------------|---------------|-------------------|--------|----------------------|-------------|-------|

> Leave all other rows empty — the backend will append leads automatically.

---

## Verification

After setup, test the connection:

```bash
# Start the backend
cd backend
npm run dev

# In another terminal, test the properties endpoint
curl http://localhost:3000/api/properties
```

You should see your properties returned as JSON. If you see a 500 error, check:
- The service account email has **Editor** access to the sheet
- The `GOOGLE_SPREADSHEET_ID` in `.env` is correct
- The JSON credentials are valid (no extra newlines)
