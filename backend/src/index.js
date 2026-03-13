const express = require('express');
const cors = require('cors');
const config = require('./config');
const pool = require('./db/pool');
const healthRouter = require('./routes/health');
const meRouter = require('./routes/me');

const app = express();

// CORS — only allow our two frontends
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api', meRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, async () => {
  console.log(`[Backend] Running on http://localhost:${config.port}`);
  console.log(`[Backend] Keycloak issuer: ${config.keycloakIssuer}`);

  // Verify DB connectivity on startup
  try {
    await pool.query('SELECT 1');
    console.log('[Backend] Database connection OK');
  } catch (err) {
    console.error('[Backend] Database connection FAILED:', err.message);
    console.error('[Backend] Will retry on first request...');
  }
});
