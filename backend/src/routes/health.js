const { Router } = require('express');
const pool = require('../db/pool');

const router = Router();

router.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
