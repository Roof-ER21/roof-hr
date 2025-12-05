import express from 'express';
import { recruitmentChatbot } from '../services/chatbot';

const router = express.Router();

// Chat endpoint for candidates
router.post('/chat', async (req, res) => {
  try {
    const { 
      message, 
      candidateId,
      candidateName, 
      candidateEmail, 
      position,
      conversationHistory = []
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const context = {
      candidateName,
      candidateEmail,
      position,
      conversationHistory
    };

    const response = await recruitmentChatbot.generateResponse(message, context);
    
    res.json(response);
  } catch (error) {
    console.error('Error in chatbot:', error);
    res.status(500).json({ 
      message: "I'm sorry, I'm having trouble processing your request. Please try again later.",
      error: 'Internal server error' 
    });
  }
});

// Analyze message intent
router.post('/analyze-intent', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const intent = await recruitmentChatbot.analyzeIntent(message);
    res.json(intent);
  } catch (error) {
    console.error('Error analyzing intent:', error);
    res.status(500).json({ error: 'Failed to analyze intent' });
  }
});

// Get suggested questions for a candidate
router.get('/suggestions', (req, res) => {
  try {
    const { position } = req.query;
    
    const context = {
      position: position as string,
      conversationHistory: []
    };

    const suggestions = recruitmentChatbot.generateSuggestedQuestions(context);
    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

export default router;