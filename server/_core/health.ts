import { Router } from 'express';

const router = Router();

/**
 * Health check endpoint for keep-alive pings
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
