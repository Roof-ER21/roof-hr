import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { logger } from '../middleware/logger';

const router = Router();

// Initiate Google OAuth flow
router.get('/api/google/auth', (req, res) => {
  try {
    const authUrl = gmailService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    logger.error('Failed to generate Google auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

// Handle OAuth callback
router.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const tokens = await gmailService.setTokens(code as string);
    
    // Redirect to admin control hub with success message
    res.redirect('/admin-control-hub?gmail=connected');
  } catch (error) {
    logger.error('Failed to handle Google OAuth callback:', error);
    res.redirect('/admin-control-hub?gmail=error');
  }
});

// Check Gmail connection status
router.get('/api/google/status', (req, res) => {
  res.json({
    gmail: gmailService.isConfigured(),
    needsAuth: !gmailService.isConfigured()
  });
});

export default router;