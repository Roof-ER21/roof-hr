import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { aiEnhancementService } from '../services/ai-enhancement';
import { storage } from '../storage';
import { logger } from '../utils/logger';

const router = Router();

// All AI enhancement routes require authentication
router.use(requireAuth);

/**
 * Test OpenAI connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const isConfigured = aiEnhancementService.isConfigured();
    
    if (!isConfigured) {
      return res.json({
        success: false,
        message: 'OpenAI API key not configured',
        configured: false,
      });
    }

    // Try a simple test with OpenAI
    const testResult = await aiEnhancementService.testConnection();
    
    res.json({
      success: true,
      message: 'OpenAI connection successful',
      configured: true,
      testResult,
    });
  } catch (error) {
    logger.error('OpenAI connection test failed:', error);
    res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
      configured: aiEnhancementService.isConfigured(),
    });
  }
});

/**
 * Parse resume text
 */
router.post('/parse-resume', async (req, res) => {
  try {
    const schema = z.object({
      resumeText: z.string(),
      candidateId: z.string().optional(),
    });

    const { resumeText, candidateId } = schema.parse(req.body);

    const parsedData = await aiEnhancementService.parseResume(resumeText);

    // If candidateId provided, update the candidate record
    if (candidateId) {
      // Store the parsed resume data
      await storage.updateCandidate(candidateId, {
        parsedResumeData: JSON.stringify(parsedData),
        // Resume text stored in parsedResumeData for future reference
      });

      // Create comprehensive AI insights including the parsed data
      const aiInsights = {
        parsedAt: new Date().toISOString(),
        parsedData: parsedData,
        parsingMethod: 'OpenAI GPT-4o',
        resumeTextLength: resumeText.length,
      };

      // Update the aiInsights field with comprehensive analysis
      await storage.updateCandidate(candidateId, {
        aiInsights: JSON.stringify(aiInsights),
      });
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    logger.error('Failed to parse resume:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse resume',
    });
  }
});

/**
 * Predict candidate success
 */
router.post('/predict-success', async (req, res) => {
  try {
    const schema = z.object({
      candidateId: z.string(),
      jobRequirements: z.object({
        position: z.string(),
        requiredSkills: z.array(z.string()),
        experienceYears: z.number(),
        educationLevel: z.string(),
        certifications: z.array(z.string()).optional(),
      }),
    });

    const { candidateId, jobRequirements } = schema.parse(req.body);

    // Get candidate data
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
    }

    // Parse stored resume data if available
    let candidateData = {
      name: `${candidate.firstName} ${candidate.lastName}`,
      position: candidate.position,
      experience: candidate.availability,
      skills: [],
    };

    if (candidate.parsedResumeData) {
      try {
        const parsed = JSON.parse(candidate.parsedResumeData);
        candidateData = { ...candidateData, ...parsed };
      } catch (e) {
        // Use basic candidate data if parsing fails
      }
    }

    const prediction = await aiEnhancementService.predictCandidateSuccess(
      candidateData,
      jobRequirements
    );

    // Update candidate record with predictions
    await storage.updateCandidate(candidateId, {
      predictedSuccessScore: prediction.successScore,
      predictedTenure: prediction.predictedTenure,
      cultureFitScore: prediction.cultureFitScore,
      technicalFitScore: prediction.technicalFitScore,
      riskFactors: JSON.stringify(prediction.riskFactors),
    });

    // Track model performance
    await aiEnhancementService.updateModelPerformance(
      'PREDICTION_ACCURACY',
      85, // These would be calculated from actual outcomes
      82,
      88,
      1
    );

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    logger.error('Failed to predict candidate success:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to predict success',
    });
  }
});

/**
 * Get salary benchmark
 */
router.post('/salary-benchmark', async (req, res) => {
  try {
    const schema = z.object({
      position: z.string(),
      location: z.string(),
      experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'EXPERT']),
      candidateId: z.string().optional(),
    });

    const { position, location, experienceLevel, candidateId } = schema.parse(req.body);

    const benchmark = await aiEnhancementService.getSalaryBenchmark(
      position,
      location,
      experienceLevel
    );

    // If candidateId provided, update the candidate record
    if (candidateId) {
      await storage.updateCandidate(candidateId, {
        salaryBenchmark: JSON.stringify(benchmark),
      });
    }

    res.json({
      success: true,
      data: benchmark,
    });
  } catch (error) {
    logger.error('Failed to get salary benchmark:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get salary benchmark',
    });
  }
});

/**
 * Generate interview questions
 */
router.post('/generate-questions', async (req, res) => {
  try {
    const schema = z.object({
      candidateId: z.string(),
      interviewType: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'PANEL']),
      questionCount: z.number().min(1).max(20).default(5),
    });

    const { candidateId, interviewType, questionCount } = schema.parse(req.body);

    // Get candidate data
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
    }

    // Build candidate profile
    const candidateProfile = {
      name: `${candidate.firstName} ${candidate.lastName}`,
      position: candidate.position,
      experienceLevel: 'MID', // This could be determined from parsed resume
      skills: [] as string[],
      questionnaire: {
        hasDriversLicense: candidate.hasDriversLicense,
        hasReliableVehicle: candidate.hasReliableVehicle,
        canGetOnRoof: candidate.canGetOnRoof,
        isOutgoing: candidate.isOutgoing,
      },
    };

    if (candidate.parsedResumeData) {
      try {
        const parsed = JSON.parse(candidate.parsedResumeData);
        if (parsed.skills) {
          candidateProfile.skills = [
            ...(parsed.skills.technical || []),
            ...(parsed.skills.soft || []),
          ];
        }
      } catch (e) {
        // Continue with basic profile
      }
    }

    const questions = await aiEnhancementService.generateInterviewQuestions(
      candidate.position,
      candidateProfile,
      interviewType,
      questionCount
    );

    // Update candidate with generated questions
    await storage.updateCandidate(candidateId, {
      interviewQuestions: JSON.stringify(questions),
    });

    res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    logger.error('Failed to generate interview questions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate questions',
    });
  }
});

/**
 * Analyze skills gap
 */
router.post('/skills-gap', async (req, res) => {
  try {
    const schema = z.object({
      candidateId: z.string(),
      requiredSkills: z.array(z.string()),
    });

    const { candidateId, requiredSkills } = schema.parse(req.body);

    // Get candidate data
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
    }

    // Extract candidate skills
    let candidateSkills: string[] = [];
    if (candidate.parsedResumeData) {
      try {
        const parsed = JSON.parse(candidate.parsedResumeData);
        if (parsed.skills) {
          candidateSkills = [
            ...(parsed.skills.technical || []),
            ...(parsed.skills.soft || []),
          ];
        }
      } catch (e) {
        // Use empty skills array
      }
    }

    const analysis = await aiEnhancementService.analyzeSkillsGap(
      candidateSkills,
      requiredSkills
    );

    // Update candidate with skills gap analysis
    await storage.updateCandidate(candidateId, {
      skillsGapAnalysis: JSON.stringify(analysis),
    });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('Failed to analyze skills gap:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze skills gap',
    });
  }
});

/**
 * Get all salary benchmarks
 */
router.get('/benchmarks', async (req, res) => {
  try {
    const benchmarks = await storage.getAllSalaryBenchmarks();
    res.json({
      success: true,
      data: benchmarks,
    });
  } catch (error) {
    logger.error('Failed to get benchmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get benchmarks',
    });
  }
});

/**
 * Get interview questions from bank
 */
router.get('/question-bank', async (req, res) => {
  try {
    const { position, category } = req.query;
    
    let questions;
    if (position) {
      questions = await storage.getInterviewQuestionsByPosition(
        position as string,
        category as string
      );
    } else {
      questions = await storage.getAllInterviewQuestions();
    }

    res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    logger.error('Failed to get interview questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get questions',
    });
  }
});

/**
 * Get AI model performance metrics
 */
router.get('/model-performance', async (req, res) => {
  try {
    const { metricType } = req.query;
    
    const performance = await storage.getAiModelPerformance(
      metricType as string || 'PREDICTION_ACCURACY'
    );

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    logger.error('Failed to get model performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics',
    });
  }
});

export default router;