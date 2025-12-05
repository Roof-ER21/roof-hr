import { Router } from 'express';
import { llmRouter } from '../services/llm/router';

const router = Router();

/**
 * Get the status of all LLM providers
 */
router.get('/api/llm/status', async (req, res) => {
  try {
    const health = await llmRouter.healthCheck();
    const providers = await llmRouter.getStatus();
    
    res.json({
      status: health.status,
      summary: {
        available: health.availableProviders.length,
        total: health.totalProviders,
        providers: health.availableProviders
      },
      details: providers.map(p => ({
        name: p.provider,
        available: p.available,
        responseTime: p.responseTime,
        lastUsed: p.lastUsed,
        lastError: p.lastError
      }))
    });
  } catch (error) {
    console.error('[LLM Status] Error checking status:', error);
    res.status(500).json({ 
      error: 'Failed to check LLM status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test a specific provider
 */
router.post('/api/llm/test/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { prompt = 'Hello, how are you?' } = req.body;
    
    const result = await llmRouter.generateText(
      prompt,
      {
        taskType: 'chat',
        priority: 'low',
        requiresPrivacy: false,
        expectedResponseTime: 'normal'
      }
    );
    
    res.json({
      success: true,
      provider: result.provider,
      response: result.text.slice(0, 200) // First 200 chars
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    });
  }
});

export default router;