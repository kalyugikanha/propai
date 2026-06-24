/**
 * Express App Configuration
 * Sets up middleware, static file serving, and all API routes.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const config = require('./config/env');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const chatRoutes = require('./routes/chat');
const propertiesRoutes = require('./routes/properties');
const leadsRoutes = require('./routes/leads');
const sessionRoutes = require('./routes/session');

const app = express();

// ── Security Headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow widget JS to load from any site
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = config.corsOrigin === '*'
  ? true
  : config.corsOrigin.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Id'],
    credentials: false,
  })
);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Request Logging ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ── Static: Widget Files ──────────────────────────────────────────────────────
// Serves the chat widget JS and CSS at /widget/propai-widget.js
app.use('/widget', express.static(path.join(__dirname, '../frontend/widget')));

// ── Health Check (no rate limit) ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PropAI Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
  });
});

// ── API Routes (rate-limited) ─────────────────────────────────────────────────
app.use('/api', rateLimiter);
app.use('/api', chatRoutes);
app.use('/api', propertiesRoutes);
app.use('/api', leadsRoutes);
app.use('/api', sessionRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global Error Handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
