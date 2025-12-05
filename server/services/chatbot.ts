import OpenAI from 'openai';
// Simple logger for development
const logger = {
  info: (message: string, meta?: any) => console.log('[INFO]', message, meta || ''),
  error: (message: string, error?: any) => console.error('[ERROR]', message, error || ''),
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatbotContext {
  candidateName?: string;
  candidateEmail?: string;
  position?: string;
  companyInfo?: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

interface ChatResponse {
  message: string;
  suggestedActions?: string[];
  requiresHumanHandoff?: boolean;
}

export class RecruitmentChatbot {
  private static instance: RecruitmentChatbot;
  
  private constructor() {}
  
  static getInstance(): RecruitmentChatbot {
    if (!RecruitmentChatbot.instance) {
      RecruitmentChatbot.instance = new RecruitmentChatbot();
    }
    return RecruitmentChatbot.instance;
  }

  async generateResponse(
    userMessage: string,
    context: ChatbotContext
  ): Promise<ChatResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationMessages = this.buildConversationHistory(context, userMessage);

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 800,
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      
      logger.info('Chatbot response generated', {
        candidateEmail: context.candidateEmail,
        messageLength: userMessage.length,
        responseLength: response.message?.length || 0,
      });

      return {
        message: response.message || "I'm sorry, I didn't understand that. Could you please rephrase your question?",
        suggestedActions: response.suggestedActions || [],
        requiresHumanHandoff: response.requiresHumanHandoff || false,
      };

    } catch (error) {
      logger.error('Error generating chatbot response:', error);
      throw new Error('Failed to generate response');
    }
  }

  private buildSystemPrompt(context: ChatbotContext): string {
    const companyInfo = context.companyInfo || `
ROOF-ER is a leading roofing company specializing in residential and commercial roofing solutions. 
We pride ourselves on quality craftsmanship, excellent customer service, and using the latest roofing technologies.
Our team consists of experienced professionals who are passionate about protecting homes and businesses.
We offer competitive salaries, comprehensive benefits, and opportunities for career growth.
`;

    return `You are a professional recruitment chatbot for ROOF-ER, a roofing company. Your role is to engage with job candidates in a friendly, professional, and personalized manner.

COMPANY INFORMATION:
${companyInfo}

CANDIDATE CONTEXT:
- Name: ${context.candidateName || 'Candidate'}
- Email: ${context.candidateEmail || 'Not provided'}
- Position of Interest: ${context.position || 'Not specified'}

INSTRUCTIONS:
1. Be professional, friendly, and helpful
2. Provide accurate information about ROOF-ER and available positions
3. Answer questions about job requirements, benefits, company culture, and application process
4. Personalize responses based on the candidate's background and interests
5. If asked about salary ranges, provide general information but suggest speaking with HR for specifics
6. If you cannot answer a question or need human intervention, indicate this clearly
7. Always respond in JSON format with the following structure:
   {
     "message": "Your response to the candidate",
     "suggestedActions": ["action1", "action2"], // Optional array of suggested next steps
     "requiresHumanHandoff": false // Set to true if human intervention is needed
   }

TONE: Professional yet conversational, enthusiastic about the company, supportive of candidate's career goals

Remember to:
- Use the candidate's name when appropriate
- Reference their specific position of interest
- Provide helpful and accurate information
- Encourage engagement and next steps in the application process
- Be empathetic and understanding of candidate concerns`;
  }

  private buildConversationHistory(context: ChatbotContext, currentMessage: string) {
    const messages = context.conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    messages.push({
      role: 'user' as const,
      content: currentMessage,
    });

    return messages;
  }

  async analyzeIntent(message: string): Promise<{
    intent: string;
    confidence: number;
    entities: Record<string, string>;
  }> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the user's message and extract intent and entities. Respond in JSON format:
{
  "intent": "one of: greeting, question_about_job, question_about_company, question_about_benefits, question_about_salary, application_status, schedule_interview, complaint, compliment, other",
  "confidence": 0.95,
  "entities": {
    "position": "extracted position if mentioned",
    "location": "extracted location if mentioned",
    "experience_level": "extracted experience level if mentioned"
  }
}`
          },
          {
            role: "user",
            content: message,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200,
      });

      return JSON.parse(completion.choices[0].message.content || '{"intent": "other", "confidence": 0.5, "entities": {}}');
    } catch (error) {
      logger.error('Error analyzing intent:', error);
      return { intent: "other", confidence: 0.5, entities: {} };
    }
  }

  generateSuggestedQuestions(context: ChatbotContext): string[] {
    const questions = [
      "What positions do you have available?",
      "What are the job requirements?",
      "What benefits do you offer?",
      "What is the company culture like?",
      "How do I apply for a position?",
      "What is the interview process?",
      "Do you provide training?",
      "What are the growth opportunities?",
    ];

    if (context.position) {
      questions.unshift(`Tell me more about the ${context.position} position`);
    }

    return questions.slice(0, 6);
  }
}

export const recruitmentChatbot = RecruitmentChatbot.getInstance();