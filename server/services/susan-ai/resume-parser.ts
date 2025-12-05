/**
 * Susan AI Resume Parser
 * Extracts candidate information from resume text using AI
 */

import { llmRouter } from '../llm/router';
import { LLMTaskContext } from '../llm/types';

export interface ParsedResumeData {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    duration: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
  summary: string;
}

export class SusanResumeParser {
  /**
   * Parse resume text and extract candidate information
   */
  async parseResume(resumeText: string): Promise<ParsedResumeData> {
    console.log('[Resume Parser] Parsing resume text, length:', resumeText.length);

    // Truncate if too long to fit in context window
    const truncatedText = resumeText.slice(0, 8000);

    const prompt = `You are an expert HR assistant. Extract candidate information from this resume text.

Resume:
${truncatedText}

Return a JSON object with EXACTLY these fields:
{
  "firstName": "extracted first name (REQUIRED - make your best guess)",
  "lastName": "extracted last name (REQUIRED - make your best guess)",
  "email": "email@example.com or null if not found",
  "phone": "phone number or null if not found",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [{"company": "company name", "title": "job title", "duration": "X years"}],
  "education": [{"institution": "school name", "degree": "degree type", "year": "graduation year"}],
  "summary": "2-3 sentence professional summary based on the resume"
}

IMPORTANT:
- firstName and lastName are REQUIRED - extract them from the resume
- If you cannot determine the name, use the first identifiable name-like text
- Return null for email/phone if not clearly present
- Return empty arrays [] if no skills/experience/education found
- Return only valid JSON, no additional text`;

    const context: LLMTaskContext = {
      taskType: 'extraction',
      expectedResponseTime: 'standard',
      requiresPrivacy: false
    };

    try {
      const result = await llmRouter.generateJSON(prompt, context);
      console.log('[Resume Parser] AI extracted data:', JSON.stringify(result.data).slice(0, 200));
      return this.validateAndClean(result.data);
    } catch (error: any) {
      console.error('[Resume Parser] LLM error:', error.message);
      // Return minimal default data extracted from text
      return this.extractMinimalData(resumeText);
    }
  }

  /**
   * Validate and clean the parsed data
   */
  private validateAndClean(data: any): ParsedResumeData {
    return {
      firstName: this.cleanName(data?.firstName) || 'Unknown',
      lastName: this.cleanName(data?.lastName) || 'Candidate',
      email: this.cleanEmail(data?.email),
      phone: this.cleanPhone(data?.phone),
      skills: Array.isArray(data?.skills) ? data.skills.filter(Boolean).slice(0, 20) : [],
      experience: Array.isArray(data?.experience) ? data.experience.slice(0, 10) : [],
      education: Array.isArray(data?.education) ? data.education.slice(0, 5) : [],
      summary: typeof data?.summary === 'string' ? data.summary.slice(0, 500) : ''
    };
  }

  /**
   * Clean and validate a name string
   */
  private cleanName(name: any): string | null {
    if (!name || typeof name !== 'string') return null;
    // Remove non-alphabetic characters except spaces and hyphens
    const cleaned = name.trim().replace(/[^a-zA-Z\s\-']/g, '');
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Clean and validate an email string
   */
  private cleanEmail(email: any): string | null {
    if (!email || typeof email !== 'string') return null;
    const match = email.match(/[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : null;
  }

  /**
   * Clean and validate a phone string
   */
  private cleanPhone(phone: any): string | null {
    if (!phone || typeof phone !== 'string') return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      // Format as US phone number if 10 digits
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return digits;
    }
    return null;
  }

  /**
   * Fallback: extract minimal data from resume text without AI
   */
  private extractMinimalData(text: string): ParsedResumeData {
    console.log('[Resume Parser] Using fallback extraction');

    // Try to extract name from first few lines
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    let firstName = 'Unknown';
    let lastName = 'Candidate';

    // First non-empty line often contains the name
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Look for name-like pattern (2-4 words, mostly letters)
      const words = firstLine.split(/\s+/).filter(w => /^[A-Za-z\-']+$/.test(w));
      if (words.length >= 2 && words.length <= 4) {
        firstName = words[0];
        lastName = words.slice(1).join(' ');
      } else if (words.length === 1) {
        firstName = words[0];
      }
    }

    // Try to extract email
    const emailMatch = text.match(/[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0].toLowerCase() : null;

    // Try to extract phone
    const phoneMatch = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
    const phone = phoneMatch ? this.cleanPhone(phoneMatch[0]) : null;

    return {
      firstName,
      lastName,
      email,
      phone,
      skills: [],
      experience: [],
      education: [],
      summary: ''
    };
  }
}

// Export singleton instance
export const susanResumeParser = new SusanResumeParser();
