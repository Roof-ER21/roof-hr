import { storage } from '../storage';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Schema for parsed resume data
const ParsedResumeSchema = z.object({
  personalInfo: z.object({
    name: z.string(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    linkedIn: z.string().optional().nullable(),
    portfolio: z.string().optional().nullable(),
  }),
  summary: z.string().optional(),
  experience: z.array(z.object({
    company: z.string(),
    position: z.string(),
    duration: z.string(),
    responsibilities: z.array(z.string()),
    achievements: z.array(z.string()).optional(),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field: z.string(),
    graduationYear: z.string().optional(),
    gpa: z.string().optional(),
  })),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
    languages: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
  }),
  keyMetrics: z.object({
    totalExperience: z.number(),
    relevantExperience: z.number(),
    jobHopping: z.boolean(),
    educationLevel: z.string(),
  }),
});

// Schema for candidate prediction
const CandidatePredictionSchema = z.object({
  successScore: z.number().min(0).max(100),
  predictedTenure: z.number(), // in months
  cultureFitScore: z.number().min(0).max(100),
  technicalFitScore: z.number().min(0).max(100),
  riskFactors: z.array(z.object({
    factor: z.string(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    mitigation: z.string(),
  })),
  strengths: z.array(z.string()),
  developmentAreas: z.array(z.string()),
  recommendedActions: z.array(z.string()),
});

// Schema for salary benchmark
const SalaryBenchmarkSchema = z.object({
  minSalary: z.number(),
  maxSalary: z.number(),
  medianSalary: z.number(),
  marketPosition: z.enum(['BELOW_MARKET', 'AT_MARKET', 'ABOVE_MARKET']),
  competitorData: z.array(z.object({
    company: z.string(),
    averageSalary: z.number(),
    source: z.string(),
  })),
  recommendations: z.array(z.string()),
  dataPoints: z.number(),
  lastUpdated: z.string(),
});

export class AIEnhancementService {
  constructor() {
    this.checkConfiguration();
  }

  private checkConfiguration() {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured. AI enhancement features will be limited.');
    }
  }

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Test OpenAI connection with a simple API call
   */
  async testConnection(): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'Say "OpenAI connection successful" in JSON format with a success field.',
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 50,
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      throw error;
    }
  }

  /**
   * Parse resume text and extract structured data
   */
  async parseResume(resumeText: string): Promise<any> {
    try {
      if (!this.isConfigured()) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `Parse the following resume and extract structured data. Return a JSON object with the following structure:
      {
        personalInfo: { name, email, phone, location, linkedIn?, portfolio? },
        summary: string,
        experience: [{ company, position, duration, responsibilities: [], achievements?: [] }],
        education: [{ institution, degree, field, graduationYear?: string, gpa?: string }],
        skills: { technical: [], soft: [], languages?: [], certifications?: [] },
        keyMetrics: { totalExperience: number, relevantExperience: number, jobHopping: boolean, educationLevel: string }
      }
      
      IMPORTANT: graduationYear and gpa must be strings (e.g., "2016", "3.8"), not numbers.
      
      Resume text:
      ${resumeText}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR resume parser. Extract structured data from resumes accurately.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const parsedData = JSON.parse(response.choices[0].message.content || '{}');
      
      // Convert numeric values to strings for schema compatibility
      if (parsedData.education && Array.isArray(parsedData.education)) {
        parsedData.education = parsedData.education.map((edu: any) => ({
          ...edu,
          graduationYear: edu.graduationYear ? String(edu.graduationYear) : undefined,
          gpa: edu.gpa ? String(edu.gpa) : undefined,
        }));
      }
      
      return ParsedResumeSchema.parse(parsedData);
    } catch (error) {
      logger.error('Failed to parse resume:', error);
      throw error;
    }
  }

  /**
   * Predict candidate success and tenure
   */
  async predictCandidateSuccess(candidateData: any, jobRequirements: any): Promise<any> {
    try {
      if (!this.isConfigured()) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `Based on the candidate data and job requirements, predict the candidate's success potential.
      
      Candidate Data:
      ${JSON.stringify(candidateData, null, 2)}
      
      Job Requirements:
      ${JSON.stringify(jobRequirements, null, 2)}
      
      Provide a JSON response with:
      {
        successScore: 0-100,
        predictedTenure: months as number,
        cultureFitScore: 0-100,
        technicalFitScore: 0-100,
        riskFactors: [{ factor: string, severity: "LOW"|"MEDIUM"|"HIGH", mitigation: string }],
        strengths: [string],
        developmentAreas: [string],
        recommendedActions: [string]
      }`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR analyst specializing in predictive hiring analytics. Provide data-driven predictions based on candidate profiles.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const prediction = JSON.parse(response.choices[0].message.content || '{}');
      return CandidatePredictionSchema.parse(prediction);
    } catch (error) {
      logger.error('Failed to predict candidate success:', error);
      throw error;
    }
  }

  /**
   * Get salary benchmark for a position
   */
  async getSalaryBenchmark(position: string, location: string, experience: string): Promise<any> {
    try {
      // First check if we have recent benchmark data in database
      const existingBenchmark = await storage.getSalaryBenchmarkByPosition(position, location);
      
      if (existingBenchmark && this.isBenchmarkRecent(existingBenchmark.lastUpdated)) {
        return JSON.parse(existingBenchmark.competitorData || '{}');
      }

      if (!this.isConfigured()) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `Provide salary benchmark data for:
      Position: ${position}
      Location: ${location}
      Experience Level: ${experience}
      
      Return a JSON object with:
      {
        minSalary: number,
        maxSalary: number,
        medianSalary: number,
        marketPosition: "BELOW_MARKET"|"AT_MARKET"|"ABOVE_MARKET",
        competitorData: [{ company: string, averageSalary: number, source: string }],
        recommendations: [string],
        dataPoints: number,
        lastUpdated: ISO date string
      }
      
      Use realistic salary data for the roofing/construction industry.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a compensation analyst with expertise in construction and roofing industry salaries. Provide realistic salary benchmarks based on market data.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const benchmark = JSON.parse(response.choices[0].message.content || '{}');
      const validatedBenchmark = SalaryBenchmarkSchema.parse(benchmark);

      // Save to database for future use
      await storage.createSalaryBenchmark({
        position,
        location,
        experienceLevel: experience,
        minSalary: validatedBenchmark.minSalary,
        maxSalary: validatedBenchmark.maxSalary,
        medianSalary: validatedBenchmark.medianSalary,
        currency: 'USD',
        dataSource: 'AI Analysis',
        sampleSize: validatedBenchmark.dataPoints,
        competitorData: JSON.stringify(validatedBenchmark),
      });

      return validatedBenchmark;
    } catch (error) {
      logger.error('Failed to get salary benchmark:', error);
      throw error;
    }
  }

  /**
   * Generate dynamic interview questions
   */
  async generateInterviewQuestions(
    position: string,
    candidateProfile: any,
    interviewType: string,
    count: number = 5
  ): Promise<any[]> {
    try {
      if (!this.isConfigured()) {
        // Return default questions from database
        const dbQuestions = await storage.getInterviewQuestionsByPosition(position);
        return dbQuestions.slice(0, count);
      }

      const prompt = `Generate ${count} interview questions for:
      Position: ${position}
      Interview Type: ${interviewType}
      
      Candidate Profile:
      ${JSON.stringify(candidateProfile, null, 2)}
      
      Create personalized questions that:
      1. Test relevant skills for the position
      2. Assess cultural fit for a roofing company
      3. Evaluate problem-solving abilities
      4. Address any gaps or concerns in the candidate's profile
      
      Return a JSON array of questions with this structure:
      [{
        question: string,
        category: "TECHNICAL"|"BEHAVIORAL"|"SITUATIONAL"|"CULTURE_FIT"|"PROBLEM_SOLVING",
        expectedAnswer: string,
        evaluationCriteria: [string],
        difficulty: 1-5,
        followUpQuestions: [string]
      }]`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert interviewer for a roofing company. Generate relevant, insightful interview questions that help assess candidate fit.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const questionsData = JSON.parse(response.choices[0].message.content || '{"questions": []}');
      const questions = questionsData.questions || questionsData;

      // Save generated questions to database for future use
      for (const q of questions) {
        await storage.createInterviewQuestion({
          position,
          category: q.category,
          experienceLevel: candidateProfile.experienceLevel || 'MID',
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          evaluationCriteria: JSON.stringify(q.evaluationCriteria),
          difficulty: q.difficulty,
          createdBy: 'AI',
          isAiGenerated: true,
        });
      }

      return questions;
    } catch (error) {
      logger.error('Failed to generate interview questions:', error);
      throw error;
    }
  }

  /**
   * Analyze skills gap for a candidate
   */
  async analyzeSkillsGap(candidateSkills: string[], requiredSkills: string[]): Promise<any> {
    try {
      const missingSkills = requiredSkills.filter(skill => 
        !candidateSkills.some(cs => cs.toLowerCase().includes(skill.toLowerCase()))
      );

      const matchingSkills = requiredSkills.filter(skill =>
        candidateSkills.some(cs => cs.toLowerCase().includes(skill.toLowerCase()))
      );

      const additionalSkills = candidateSkills.filter(skill =>
        !requiredSkills.some(rs => skill.toLowerCase().includes(rs.toLowerCase()))
      );

      const matchPercentage = (matchingSkills.length / requiredSkills.length) * 100;

      if (this.isConfigured()) {
        // Get AI recommendations for bridging gaps
        const prompt = `Analyze the skills gap and provide recommendations:
        Required Skills: ${requiredSkills.join(', ')}
        Candidate Skills: ${candidateSkills.join(', ')}
        Missing Skills: ${missingSkills.join(', ')}
        
        Provide JSON with:
        {
          trainingRecommendations: [string],
          timeToClose: "weeks/months",
          priority: "LOW"|"MEDIUM"|"HIGH",
          alternativeStrengths: [string]
        }`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an HR skills analyst. Provide practical recommendations for skills development.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
        });

        const recommendations = JSON.parse(response.choices[0].message.content || '{}');

        return {
          matchPercentage,
          matchingSkills,
          missingSkills,
          additionalSkills,
          ...recommendations,
        };
      }

      return {
        matchPercentage,
        matchingSkills,
        missingSkills,
        additionalSkills,
        trainingRecommendations: missingSkills.map(skill => `Training needed for ${skill}`),
        timeToClose: missingSkills.length > 3 ? 'months' : 'weeks',
        priority: matchPercentage < 50 ? 'HIGH' : matchPercentage < 75 ? 'MEDIUM' : 'LOW',
      };
    } catch (error) {
      logger.error('Failed to analyze skills gap:', error);
      throw error;
    }
  }

  /**
   * Update AI model performance metrics
   */
  async updateModelPerformance(
    metricType: string,
    accuracy: number,
    precision: number,
    recall: number,
    samplesCount: number
  ): Promise<void> {
    try {
      const f1Score = 2 * (precision * recall) / (precision + recall);
      
      await storage.createAiModelPerformance({
        modelName: 'gpt-4o',
        modelVersion: '2024-01',
        metricType,
        accuracy,
        precision,
        recall,
        f1Score,
        samplesCount,
        notes: `Auto-tracked performance for ${metricType}`,
      });

      logger.info(`Model performance updated for ${metricType}`, {
        accuracy,
        precision,
        recall,
        f1Score,
      });
    } catch (error) {
      logger.error('Failed to update model performance:', error);
    }
  }

  private isBenchmarkRecent(lastUpdated: Date): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(lastUpdated) > thirtyDaysAgo;
  }
}

export const aiEnhancementService = new AIEnhancementService();