# PropAI Backend

> AI Property Assistant Backend for Jaipur Real Estate  
> Stack: Node.js · Express · Google Gemini · Google Sheets API

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — add your Google Service Account JSON (see docs/sheets-setup.md)

# 3. Start development server
npm run dev

# 4. Test
curl http://localhost:3000/health
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GOOGLE_SPREADSHEET_ID` | ✅ | Your Google Sheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Service account credentials JSON string |
| `PORT` | Optional | Server port (default: 3000) |
| `NODE_ENV` | Optional | `development` or `production` |
| `CORS_ORIGIN` | Optional | Allowed origins (default: `*`) |
| `AGENCY_NAME` | Optional | Your agency name for the chatbot |
| `AGENT_NAME` | Optional | AI assistant name (default: Priya) |

See `.env.example` for the full list.

---

## Project Structure

```
backend/
├── server.js               ← Entry point
├── src/
│   ├── app.js              ← Express setup
│   ├── config/
│   │   ├── env.js          ← Env validation
│   │   └── constants.js    ← Flow steps, property types, locations
│   ├── services/
│   │   ├── chatService.js      ← Conversation state machine (main brain)
│   │   ├── geminiService.js    ← Gemini AI wrapper
│   │   ├── sheetsService.js    ← Google Sheets read/write
│   │   ├── propertyService.js  ← Property search & scoring
│   │   ├── leadService.js      ← Lead capture
│   │   └── sessionService.js   ← Session store
│   ├── routes/
│   │   ├── chat.js         ← POST /api/chat, POST /api/chat/start
│   │   ├── properties.js   ← GET /api/properties, POST /api/search-properties
│   │   ├── leads.js        ← POST /api/save-lead
│   │   └── session.js      ← GET /api/session/:id
│   ├── middleware/
│   │   ├── rateLimiter.js  ← 30 req/15min per IP
│   │   ├── validator.js    ← Input validation
│   │   └── errorHandler.js ← Global error handling
│   └── utils/
│       ├── budgetParser.js ← "50 Lakhs" → 5000000
│       ├── logger.js       ← Winston logger
│       └── helpers.js      ← Utility functions
└── .env.example
```

---

## API Reference

### `POST /api/chat/start`
Opens a new session and returns the greeting message.
```json
// Request
{ "sessionId": "optional-existing-uuid" }

// Response
{
  "success": true,
  "sessionId": "uuid",
  "reply": "Hello 👋 Welcome to PropAI Jaipur...",
  "step": "COLLECT_NAME",
  "quickReplies": []
}
```

### `POST /api/chat`
Send a user message and get the bot's response.
```json
// Request
{ "sessionId": "uuid", "message": "My name is Rahul" }

// Response
{
  "success": true,
  "sessionId": "uuid",
  "reply": "Nice to meet you, Rahul! Could I have your mobile number?",
  "step": "COLLECT_MOBILE",
  "quickReplies": [],
  "properties": []
}
```

### `GET /api/properties`
Returns all active properties (cached 5 min).
Add `?refresh=true` to force a cache refresh.

### `POST /api/search-properties`
Direct property search without going through chat.
```json
{ "propertyType": "Villa", "location": "Jagatpura", "budget": 5000000 }
```

### `POST /api/save-lead`
Manually save a lead from a session.
```json
{ "sessionId": "uuid" }
```

### `GET /api/session/:sessionId`
Inspect current session state (mobile number masked).

---

## Conversation Flow

```
Widget Opens → Auto Greeting
     ↓
COLLECT_NAME → COLLECT_MOBILE → COLLECT_PROPERTY_TYPE
     ↓
COLLECT_LOCATION → COLLECT_BUDGET
     ↓
SEARCHING → [SHOW_RESULTS | NO_RESULTS]
     ↓
CONFIRM_CONTACT
     ↓
SAVE_LEAD → DONE
```

---

## Google Sheets Setup

See [docs/sheets-setup.md](../docs/sheets-setup.md) for the complete guide.

---

## Deployment

See [docs/deployment.md](../docs/deployment.md) for Railway deployment instructions.
