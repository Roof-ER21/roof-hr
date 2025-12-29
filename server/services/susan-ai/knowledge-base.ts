/**
 * Susan AI Knowledge Base Service
 * Manages company policies, procedures, and domain knowledge
 */

import { db } from '../../db';
import { SusanContext } from './core';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  department?: string;
  lastUpdated: Date;
  relevanceScore?: number;
}

export class KnowledgeBase {
  private documents: Map<string, KnowledgeDocument> = new Map();
  
  constructor() {
    this.initializeDefaultKnowledge();
  }

  /**
   * Initialize with default company knowledge
   */
  private initializeDefaultKnowledge() {
    // PTO Policy
    this.addDocument({
      id: 'pto-policy',
      title: 'PTO (Paid Time Off) Policy',
      content: `
        Roof-ER PTO Policy:
        
        Accrual Rates:
        - Full-time employees: 15 days per year (1.25 days per month)
        - Part-time employees: Pro-rated based on hours worked
        - Additional day per year of service after 5 years (max 25 days)
        
        Usage Guidelines:
        - PTO requests must be submitted at least 2 weeks in advance for 5+ consecutive days
        - 48 hours notice for 1-4 days
        - Emergency leave exceptions apply with manager approval
        - Blackout dates: December 20-31, major project deadlines
        
        Approval Process:
        - Manager approval required for all requests
        - HR approval required for 10+ consecutive days
        - Ford Barsi has final approval authority for all PTO requests
        
        Carryover:
        - Maximum 5 days can be carried over to next year
        - Use-it-or-lose-it policy applies to remaining balance
        - Payout upon termination per state law
      `,
      category: 'HR Policy',
      tags: ['pto', 'time off', 'vacation', 'leave', 'benefits'],
      department: 'HR',
      lastUpdated: new Date()
    });

    // Benefits Overview
    this.addDocument({
      id: 'benefits-overview',
      title: 'Employee Benefits Overview',
      content: `
        Roof-ER Employee Benefits Package:
        
        Health Insurance:
        - Medical: Blue Cross Blue Shield PPO/HMO options
        - Dental: Delta Dental coverage
        - Vision: VSP coverage
        - Company pays 80% of premiums for employee, 50% for dependents
        
        Retirement:
        - 401(k) with 4% company match (vested after 1 year)
        - Profit sharing based on company performance
        
        Life & Disability:
        - Basic life insurance: 2x annual salary (company paid)
        - Short-term disability: 60% salary for up to 12 weeks
        - Long-term disability: 50% salary after 12 weeks
        
        Additional Benefits:
        - Flexible Spending Account (FSA)
        - Health Savings Account (HSA) for high-deductible plans
        - Employee Assistance Program (EAP)
        - Tuition reimbursement up to $5,000/year
        - Gym membership discount
      `,
      category: 'Benefits',
      tags: ['benefits', 'insurance', 'health', 'dental', 'vision', '401k', 'retirement'],
      department: 'HR',
      lastUpdated: new Date()
    });

    // Safety Protocols
    this.addDocument({
      id: 'safety-protocols',
      title: 'Workplace Safety Protocols',
      content: `
        Roof-ER Safety First Initiative:
        
        General Safety Rules:
        - Hard hats required in all construction zones
        - Safety harnesses mandatory for work above 6 feet
        - Steel-toed boots required on all job sites
        - High-visibility vests during outdoor work
        
        Emergency Procedures:
        - Call 911 for medical emergencies
        - Report all incidents to supervisor immediately
        - Complete incident report within 24 hours
        - Safety hotline: 1-800-SAFE-ROOF
        
        COI Requirements:
        - Workers Compensation insurance must be current
        - General Liability coverage minimum $1M
        - Auto insurance for company vehicles
        - Certificates expire every 12 months
        - 90, 60, and 30-day expiration warnings
        
        Training Requirements:
        - OSHA 10-hour certification for all field workers
        - Annual safety refresher training
        - Job-specific safety briefings
        - New employee safety orientation
      `,
      category: 'Safety',
      tags: ['safety', 'osha', 'emergency', 'coi', 'training', 'protocols'],
      department: 'Operations',
      lastUpdated: new Date()
    });

    // Recruitment Process
    this.addDocument({
      id: 'recruitment-process',
      title: 'Recruitment and Hiring Process',
      content: `
        Roof-ER Recruitment Pipeline:
        
        Candidate Stages:
        1. APPLIED - Initial application received
        2. SCREENING - HR initial review and phone screen
        3. INTERVIEW - In-person or video interviews
        4. OFFER - Offer extended to candidate
        5. HIRED - Offer accepted, onboarding begins
        6. REJECTED - Not moving forward
        
        Interview Process:
        - Phone screening: 30 minutes with HR
        - First interview: 1 hour with hiring manager
        - Second interview: Panel with team members
        - Final interview: Executive approval for senior roles
        
        Required Assessments:
        - Background check (7-year history)
        - Drug screening (pre-employment)
        - Reference checks (minimum 2 professional)
        - Skills assessment for technical roles
        
        Onboarding:
        - Day 1: Paperwork, IT setup, facility tour
        - Week 1: Department orientation, role training
        - Month 1: Initial goals setting, mentor assignment
        - Month 3: Probation review
      `,
      category: 'Recruitment',
      tags: ['hiring', 'recruitment', 'interview', 'onboarding', 'candidates'],
      department: 'HR',
      lastUpdated: new Date()
    });

    // Company Holidays
    this.addDocument({
      id: 'company-holidays',
      title: 'Company Holidays and Observances',
      content: `
        The Roof Docs 2025 Holiday Schedule:

        Company Holidays (7 days):
        - New Year's Day - January 1
        - Memorial Day - May 26
        - Independence Day - July 4
        - Labor Day - September 1
        - Thanksgiving - November 27
        - Black Friday - November 28
        - Christmas Day - December 25

        PTO Policy:
        - All employees receive 17 PTO days per year (10 vacation, 5 sick, 2 personal)
        - Sales Representatives (1099) receive 0 PTO days
        - IMPORTANT: Employees must use at least 5 PTO days during January, February, or December

        Holiday Pay:
        - Regular employees receive 8 hours holiday pay
        - Essential workers receive double-time for hours worked
        - Part-time employees pro-rated based on average hours
      `,
      category: 'HR Policy',
      tags: ['holidays', 'time off', 'schedule', 'calendar', 'pto'],
      department: 'HR',
      lastUpdated: new Date()
    });

    // Performance Review
    this.addDocument({
      id: 'performance-review',
      title: 'Performance Review Process',
      content: `
        Roof-ER Performance Management:
        
        Review Schedule:
        - Annual reviews: December for all employees
        - Mid-year check-ins: June progress discussions
        - Probation reviews: 30, 60, 90 days for new hires
        - Project reviews: After major project completion
        
        Rating Scale:
        - 5 Stars: Exceptional - Exceeds all expectations
        - 4 Stars: Above Average - Exceeds most expectations
        - 3 Stars: Meets Expectations - Solid performance
        - 2 Stars: Needs Improvement - Below expectations
        - 1 Star: Unsatisfactory - Immediate improvement required
        
        Review Components:
        - Goal achievement (40%)
        - Core competencies (30%)
        - Team collaboration (20%)
        - Innovation/Initiative (10%)
        
        Compensation Impact:
        - 5 Stars: 4-6% merit increase
        - 4 Stars: 3-4% merit increase
        - 3 Stars: 2-3% merit increase
        - 2 Stars: No increase, performance plan
        - 1 Star: Disciplinary action
      `,
      category: 'Performance',
      tags: ['performance', 'review', 'evaluation', 'merit', 'goals'],
      department: 'HR',
      lastUpdated: new Date()
    });
  }

  /**
   * Load company policies from database or files
   */
  async loadCompanyPolicies(): Promise<void> {
    // In production, load from database or document store
    console.log('[SUSAN-AI] Loading company policies...');
  }

  /**
   * Load employee handbook
   */
  async loadEmployeeHandbook(): Promise<void> {
    console.log('[SUSAN-AI] Loading employee handbook...');
  }

  /**
   * Load benefits information
   */
  async loadBenefitsInformation(): Promise<void> {
    console.log('[SUSAN-AI] Loading benefits information...');
  }

  /**
   * Load safety protocols
   */
  async loadSafetyProtocols(): Promise<void> {
    console.log('[SUSAN-AI] Loading safety protocols...');
  }

  /**
   * Add a document to the knowledge base
   */
  addDocument(doc: KnowledgeDocument): void {
    this.documents.set(doc.id, doc);
  }

  /**
   * Search knowledge base for relevant information
   */
  async search(query: string, context: SusanContext): Promise<KnowledgeDocument[]> {
    const results: KnowledgeDocument[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    // Search through all documents
    for (const doc of Array.from(this.documents.values())) {
      // Check if user has access to this document
      if (!this.hasAccess(doc, context)) continue;

      let score = 0;

      // Title match (highest weight)
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Tag matches (high weight)
      for (const tag of doc.tags) {
        if (queryWords.some(word => tag.includes(word))) {
          score += 5;
        }
      }

      // Content matches (normal weight)
      const contentLower = doc.content.toLowerCase();
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 1;
        }
      }

      // Category match
      if (doc.category.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      if (score > 0) {
        results.push({
          ...doc,
          relevanceScore: score
        });
      }
    }

    // Sort by relevance score
    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Return top 5 most relevant documents
    return results.slice(0, 5);
  }

  /**
   * Check if user has access to a document
   */
  private hasAccess(doc: KnowledgeDocument, context: SusanContext): boolean {
    // Admins and HR have access to everything
    if (['ADMIN', 'HR_MANAGER'].includes(context.userRole)) {
      return true;
    }

    // Department-specific documents
    if (doc.department && doc.department !== context.department) {
      // Managers can see cross-department operational docs
      if (context.userRole === 'MANAGER' && 
          ['Safety', 'Operations'].includes(doc.category)) {
        return true;
      }
      return false;
    }

    // Everyone can see general policies and benefits
    if (['HR Policy', 'Benefits', 'Safety'].includes(doc.category)) {
      return true;
    }

    // Recruitment docs only for HR and Managers
    if (doc.category === 'Recruitment' && 
        !['HR_MANAGER', 'MANAGER', 'ADMIN'].includes(context.userRole)) {
      return false;
    }

    return true;
  }

  /**
   * Get a specific document by ID
   */
  getDocument(id: string): KnowledgeDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Update a document
   */
  updateDocument(id: string, updates: Partial<KnowledgeDocument>): void {
    const doc = this.documents.get(id);
    if (doc) {
      this.documents.set(id, {
        ...doc,
        ...updates,
        lastUpdated: new Date()
      });
    }
  }
}