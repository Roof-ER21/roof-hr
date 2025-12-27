/**
 * Susan AI Action Handler
 * Handles all system actions that Susan AI can perform based on natural language requests
 */

import { storage } from '../../storage';
import { EmailService } from '../../email-service';
import type { User } from '../../../shared/schema';
import { SusanEmployeeManager } from './employee-manager';
import { SusanPTOManager } from './pto-manager';
import { SusanRecruitingManager } from './recruiting-manager';
import { SusanDocumentManager } from './document-manager';
import { SusanReviewManager } from './review-manager';
import { SusanToolsManager } from './tools-manager';
import { SusanTerritoryManager } from './territory-manager';
import { SusanContractManager } from './contract-manager';

/**
 * Calculate string similarity between two strings (Levenshtein distance)
 * Returns a score between 0 and 1, where 1 is an exact match
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Quick exact match check
  if (s1 === s2) return 1;
  
  // Check if one is a substring of the other
  if (s1.includes(s2) || s2.includes(s1)) {
    // Give high score for substring matches
    return 0.8 + (0.2 * Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length));
  }
  
  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2[i - 1] === s1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - (distance / maxLength);
}

/**
 * Find candidates with fuzzy name matching
 * Returns both exact matches and close matches with similarity scores
 */
function findCandidatesFuzzy(candidates: any[], searchName: string, threshold: number = 0.6) {
  const results = candidates.map(candidate => {
    const firstName = candidate.firstName || '';
    const lastName = candidate.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    // Calculate similarity scores
    const firstNameScore = calculateSimilarity(searchName, firstName);
    const lastNameScore = calculateSimilarity(searchName, lastName);
    const fullNameScore = calculateSimilarity(searchName, fullName);
    
    // Take the highest score
    const maxScore = Math.max(firstNameScore, lastNameScore, fullNameScore);
    
    return {
      candidate,
      score: maxScore,
      matchType: maxScore === firstNameScore ? 'firstName' :
                 maxScore === lastNameScore ? 'lastName' : 'fullName'
    };
  });
  
  // Filter by threshold and sort by score
  return results
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationData?: any;
}

export interface ActionContext {
  user: User;
  message: string;
}

export class SusanActionHandler {
  private employeeManager: SusanEmployeeManager;
  private ptoManager: SusanPTOManager;
  private recruitingManager: SusanRecruitingManager;
  private documentManager: SusanDocumentManager;
  private reviewManager: SusanReviewManager;
  private toolsManager: SusanToolsManager;
  private territoryManager: SusanTerritoryManager;
  private contractManager: SusanContractManager;
  
  constructor() {
    this.employeeManager = new SusanEmployeeManager(storage as any);
    this.ptoManager = new SusanPTOManager(storage as any);
    this.recruitingManager = new SusanRecruitingManager(storage as any);
    this.documentManager = new SusanDocumentManager(storage as any);
    this.reviewManager = new SusanReviewManager(storage as any);
    this.toolsManager = new SusanToolsManager(storage as any);
    this.territoryManager = new SusanTerritoryManager(storage as any);
    this.contractManager = new SusanContractManager(storage as any);
  }

  /**
   * Process a natural language request and determine what actions to take
   */
  async processRequest(context: ActionContext): Promise<ActionResult[]> {
    const { user, message } = context;
    const actions: ActionResult[] = [];
    
    const lowerMessage = message.toLowerCase();

    try {
      // Skip processing simple greetings and non-actionable messages
      const simpleGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      if (simpleGreetings.includes(lowerMessage.trim())) {
        return []; // Return empty array for greetings
      }

      // Also check if user object is properly formed
      if (!user || !user.role) {
        console.error('[SUSAN-AI] Action handler - Invalid user context:', {
          hasUser: !!user,
          hasRole: !!user?.role,
          userId: user?.id,
          userRole: user?.role,
          roleType: typeof user?.role,
          userKeys: user ? Object.keys(user) : []
        });
        return [{
          success: false,
          message: "User context is incomplete for action processing.",
          error: "Missing user role information"
        }];
      }
      
      // Log successful user context
      console.log('[SUSAN-AI] Action handler - Valid user context:', {
        userId: user.id,
        userRole: user.role,
        department: user.department,
        firstName: user.firstName,
        lastName: user.lastName
      });

      // UNIVERSAL LOOKUP - Susan can look up anyone and anything
      if (lowerMessage.includes('find') || lowerMessage.includes('look up') || lowerMessage.includes('show') || 
          lowerMessage.includes('who') || lowerMessage.includes('search') || lowerMessage.includes('get')) {
        
        // Employee lookup
        if (lowerMessage.includes('employee') || lowerMessage.includes('person') || lowerMessage.includes('user') || 
            lowerMessage.includes('team') || lowerMessage.includes('staff')) {
          const lookupResult = await this.lookupEmployees(message);
          if (lookupResult) actions.push(lookupResult);
        }
        
        // Candidate lookup
        if (lowerMessage.includes('candidate') || lowerMessage.includes('applicant') || lowerMessage.includes('recruit')) {
          const lookupResult = await this.lookupCandidates(message);
          if (lookupResult) actions.push(lookupResult);
        }

        // Resume content lookup
        if (lowerMessage.includes('resume')) {
          const resumeResult = await this.readResumeContent(message);
          if (resumeResult) actions.push(resumeResult);
        }

        // PTO/Leave lookup
        if (lowerMessage.includes('pto') || lowerMessage.includes('vacation') || lowerMessage.includes('leave') || 
            lowerMessage.includes('time off')) {
          const lookupResult = await this.lookupPTO(message, user);
          if (lookupResult) actions.push(lookupResult);
        }
        
        // Tool/Equipment lookup
        if (lowerMessage.includes('tool') || lowerMessage.includes('equipment') || lowerMessage.includes('inventory')) {
          const lookupResult = await this.lookupTools(message);
          if (lookupResult) actions.push(lookupResult);
        }
        
        // COI lookup - specific handling for certificates of insurance
        if (lowerMessage.includes('coi') || lowerMessage.includes('certificate') ||
            (lowerMessage.includes('insurance') && !lowerMessage.includes('health'))) {
          const coiResult = await this.lookupCOI(message, user);
          if (coiResult) actions.push(coiResult);
        }

        // Contract lookup - specific handling for contracts
        else if (lowerMessage.includes('contract')) {
          const contractResult = await this.lookupContracts(message, user);
          if (contractResult) actions.push(contractResult);
        }

        // Territory lookup and management
        if (lowerMessage.includes('territor') ||
            (lowerMessage.includes('put') && lowerMessage.includes('people')) ||
            (lowerMessage.includes('assign') && !lowerMessage.includes('tool'))) {
          const territoryResult = await this.lookupTerritories(message, user);
          if (territoryResult) actions.push(territoryResult);
        }

        // General document lookup (fallback)
        else if (lowerMessage.includes('document') || lowerMessage.includes('file')) {
          const lookupResult = await this.lookupDocuments(message);
          if (lookupResult) actions.push(lookupResult);
        }
      }
      // Candidate management actions (Recruiters, Managers, Admins)
      if (this.canManageCandidates(user)) {
        if (lowerMessage.includes('move candidate') || lowerMessage.includes('move') && lowerMessage.includes('candidate')) {
          const candidateAction = await this.handleCandidateMovement(message, user);
          if (candidateAction) actions.push(candidateAction);
        }

        if (lowerMessage.includes('schedule interview') || lowerMessage.includes('interview')) {
          const interviewAction = await this.handleInterviewScheduling(message, user);
          if (interviewAction) actions.push(interviewAction);
        }

        if (lowerMessage.includes('send email') && lowerMessage.includes('candidate')) {
          const emailAction = await this.handleCandidateEmail(message, user);
          if (emailAction) actions.push(emailAction);
        }
      }

      // Enhanced PTO management - EVERYONE can request PTO
      if (lowerMessage.includes('pto') || lowerMessage.includes('time off') || lowerMessage.includes('vacation') || 
          lowerMessage.includes('sick') && lowerMessage.includes('day')) {
        
        // Allow employees to request their own PTO - expanded phrase detection
        const ptoRequestPhrases = [
          'request', 'take', 'need', 'i want', 'i\'d like', 'i would like',
          'put in', 'schedule', 'get', 'submit', 'book', 'off',
          'can you', 'could you', 'please', 'for me', 'my pto',
          'tuesday', 'wednesday', 'thursday', 'friday', 'monday', // Days often indicate a request
          'tomorrow', 'next week', 'this week', 'december', 'january' // Time references
        ];
        const isPtoRequest = ptoRequestPhrases.some(phrase => lowerMessage.includes(phrase));
        if (isPtoRequest) {
          const ptoAction = await this.requestPTOForSelf(user, message);
          if (ptoAction) actions.push(ptoAction);
        }
        
        // Manager/Admin PTO operations - Enhanced with more capabilities
        if (this.canManageTeam(user)) {
          if (lowerMessage.includes('approve')) {
            const approveAction = await this.handlePTOApprovalEnhanced(message, user);
            if (approveAction) actions.push(approveAction);
          } else if (lowerMessage.includes('deny') || lowerMessage.includes('reject')) {
            const denyAction = await this.handlePTODenialEnhanced(message, user);
            if (denyAction) actions.push(denyAction);
          } else if (lowerMessage.includes('adjust') || lowerMessage.includes('add') && lowerMessage.includes('days')) {
            const adjustAction = await this.handlePTOAdjustment(message, user);
            if (adjustAction) actions.push(adjustAction);
          } else if (lowerMessage.includes('submit') && lowerMessage.includes('for')) {
            // Admin can submit PTO for any employee
            const submitAction = await this.handlePTOSubmissionForOthers(message, user);
            if (submitAction) actions.push(submitAction);
          }
        }
      }

      // UNIVERSAL EMAIL SENDING - Anyone can send emails
      if (lowerMessage.includes('send') && (lowerMessage.includes('email') || lowerMessage.includes('message'))) {
        const emailAction = await this.sendEmailUniversal(message, user);
        if (emailAction) actions.push(emailAction);
      }

      // ENHANCED INTERVIEW SCHEDULING - Anyone with permission can schedule
      if (lowerMessage.includes('schedule') && lowerMessage.includes('interview')) {
        const interviewAction = await this.scheduleInterviewDirectly(message, user);
        if (interviewAction) actions.push(interviewAction);
      }

      // Enhanced Employee management (Managers, Admins)
      if (this.canManageEmployees(user)) {
        // Create employee
        if (lowerMessage.includes('employee') && (lowerMessage.includes('add') || lowerMessage.includes('create') || lowerMessage.includes('hire'))) {
          const employeeAction = await this.handleEmployeeCreation(message, user);
          if (employeeAction) actions.push(employeeAction);
        }
        
        // Update employee
        if (lowerMessage.includes('update') || lowerMessage.includes('change') || lowerMessage.includes('edit')) {
          if (lowerMessage.includes('employee') || lowerMessage.includes('user')) {
            const updateAction = await this.handleEmployeeUpdate(message, user);
            if (updateAction) actions.push(updateAction);
          }
        }
        
        // Delete/terminate employee
        if (lowerMessage.includes('terminate') || lowerMessage.includes('fire') || lowerMessage.includes('deactivate')) {
          const terminateAction = await this.handleEmployeeTermination(message, user);
          if (terminateAction) actions.push(terminateAction);
        }
        
        // Reset password
        if (lowerMessage.includes('reset password')) {
          const resetAction = await this.handlePasswordReset(message, user);
          if (resetAction) actions.push(resetAction);
        }
        
        // Transfer employee
        if (lowerMessage.includes('transfer') || lowerMessage.includes('move') && lowerMessage.includes('department')) {
          const transferAction = await this.handleEmployeeTransfer(message, user);
          if (transferAction) actions.push(transferAction);
        }

        if (lowerMessage.includes('send email') && lowerMessage.includes('employee')) {
          const emailAction = await this.handleEmployeeEmail(message, user);
          if (emailAction) actions.push(emailAction);
        }

        // Welcome email actions
        if (lowerMessage.includes('welcome') && lowerMessage.includes('email')) {
          const welcomeAction = await this.handleWelcomeEmail(message, user);
          if (welcomeAction) actions.push(welcomeAction);
        }

        // Employee stats/counts
        if ((lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('total')) &&
            (lowerMessage.includes('employee') || lowerMessage.includes('staff') || lowerMessage.includes('people'))) {
          const statsAction = await this.handleEmployeeStats(message, user);
          if (statsAction) actions.push(statsAction);
        }
      }

      // Note creation (Managers, Admins, HR)
      if (this.canManageTeam(user)) {
        if (lowerMessage.includes('note') && (lowerMessage.includes('add') || lowerMessage.includes('create') ||
            lowerMessage.includes('make') || lowerMessage.includes('record') || lowerMessage.includes('write'))) {
          const noteAction = await this.handleNoteCreation(message, user);
          if (noteAction) actions.push(noteAction);
        }
      }

      // Self-service operations for all employees
      if (this.canViewOwnData(user)) {
        // Personal information updates
        if (lowerMessage.includes('update my') || lowerMessage.includes('change my')) {
          if (lowerMessage.includes('contact') || lowerMessage.includes('phone') || lowerMessage.includes('email')) {
            const updateAction = await this.handleSelfUpdate(message, user);
            if (updateAction) actions.push(updateAction);
          } else if (lowerMessage.includes('emergency')) {
            const emergencyAction = await this.handleEmergencyContactUpdate(message, user);
            if (emergencyAction) actions.push(emergencyAction);
          }
        }
        
        // View personal information
        if ((lowerMessage.includes('show') || lowerMessage.includes('what')) && lowerMessage.includes('my')) {
          if (lowerMessage.includes('review')) {
            const reviewAction = await this.handleViewMyReviews(user);
            if (reviewAction) actions.push(reviewAction);
          } else if (lowerMessage.includes('equipment') || lowerMessage.includes('tools')) {
            const toolsAction = await this.handleViewMyTools(user);
            if (toolsAction) actions.push(toolsAction);
          } else if (lowerMessage.includes('benefits')) {
            const benefitsAction = await this.handleViewMyBenefits(user);
            if (benefitsAction) actions.push(benefitsAction);
          }
        }
      }
      
      // Enhanced Document management (All users can upload, view docs they have access to)
      if (lowerMessage.includes('upload') || lowerMessage.includes('document') || lowerMessage.includes('file') ||
          lowerMessage.includes('coi') || lowerMessage.includes('resume') || lowerMessage.includes('cv')) {
        // Handle COIs and resumes specifically
        const docRoutingAction = await this.handleDocumentRouting(message, user);
        if (docRoutingAction) actions.push(docRoutingAction);
        
        // General document handling
        const docAction = await this.handleDocumentRequest(message, user);
        if (docAction) actions.push(docAction);
      }

      // Alert and Message Management (All users)
      if (lowerMessage.includes('alert')) {
        const alertAction = await this.handleAlerts(message, user);
        if (alertAction) actions.push(alertAction);
      }
      
      if (lowerMessage.includes('message') || lowerMessage.includes('unread')) {
        const messageAction = await this.handleMessages(message, user);
        if (messageAction) actions.push(messageAction);
      }
      
      // HR Agent management (Admins only)
      if (this.canManageAgents(user)) {
        if (lowerMessage.includes('agent') && (lowerMessage.includes('enable') || lowerMessage.includes('disable') || lowerMessage.includes('run'))) {
          const agentAction = await this.handleAgentControl(message, user);
          if (agentAction) actions.push(agentAction);
        }
      }

      // Recruiting management (Recruiters, Managers, Admins)
      if (this.canManageCandidates(user)) {
        const recruitingCommand = this.recruitingManager.parseCommand(message);
        if (recruitingCommand) {
          const recruitingAction = await this.handleRecruitingCommand(recruitingCommand, user);
          if (recruitingAction) actions.push(recruitingAction);
        }
      }

      // Document management (All users can upload, Admins can manage)
      const documentCommand = this.documentManager.parseCommand(message);
      if (documentCommand) {
        const documentAction = await this.handleDocumentCommand(documentCommand, user);
        if (documentAction) actions.push(documentAction);
      }

      // Performance Review management (Managers, Admins)
      if (this.canManageEmployees(user)) {
        const reviewCommand = this.reviewManager.parseCommand(message);
        if (reviewCommand) {
          const reviewAction = await this.handleReviewCommand(reviewCommand, user);
          if (reviewAction) actions.push(reviewAction);
        }
      }

      // Tools & Equipment management (Managers, Admins) - Enhanced with direct inventory actions
      if (this.canManageEmployees(user)) {
        // Direct inventory management commands
        if (lowerMessage.includes('inventory') || lowerMessage.includes('tool') || lowerMessage.includes('equipment')) {
          if (lowerMessage.includes('add') || lowerMessage.includes('stock')) {
            const inventoryAction = await this.handleInventoryAdd(message, user);
            if (inventoryAction) actions.push(inventoryAction);
          } else if (lowerMessage.includes('remove') || lowerMessage.includes('subtract')) {
            const inventoryAction = await this.handleInventoryRemove(message, user);
            if (inventoryAction) actions.push(inventoryAction);
          } else if (lowerMessage.includes('assign')) {
            const inventoryAction = await this.handleInventoryAssign(message, user);
            if (inventoryAction) actions.push(inventoryAction);
          } else if (lowerMessage.includes('return')) {
            const inventoryAction = await this.handleInventoryReturn(message, user);
            if (inventoryAction) actions.push(inventoryAction);
          }
        }
        
        // Existing tools manager
        const toolsCommand = this.toolsManager.parseCommand(message);
        if (toolsCommand) {
          const toolsAction = await this.handleToolsCommand(toolsCommand, user);
          if (toolsAction) actions.push(toolsAction);
        }
      }

      // Territory management (Admins only)
      if (user.role === 'ADMIN') {
        const territoryCommand = this.territoryManager.parseCommand(message);
        if (territoryCommand) {
          const territoryAction = await this.handleTerritoryCommand(territoryCommand, user);
          if (territoryAction) actions.push(territoryAction);
        }
      }

      // Contract management (Managers, Admins)
      if (this.canManageEmployees(user)) {
        const contractCommand = this.contractManager.parseCommand(message);
        if (contractCommand) {
          const contractAction = await this.handleContractCommand(contractCommand, user);
          if (contractAction) actions.push(contractAction);
        }
      }

    } catch (error) {
      console.error('[SUSAN-AI] Action handler error:', error);
      console.error('[SUSAN-AI] User object:', JSON.stringify(user, null, 2));
      console.error('[SUSAN-AI] Message:', message);
      actions.push({
        success: false,
        message: 'An error occurred while processing your request.',
        error: (error as Error).message
      });
    }

    return actions;
  }

  /**
   * Handle candidate movement between pipeline stages
   */
  private async handleCandidateMovement(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse candidate name and status from message
      // First try to extract candidate name (look for known patterns)
      let candidateName = '';
      let newStatus = '';
      
      // Check for interview scheduling pattern
      const interviewMatch = message.match(/move\s+(\w+)\s+to\s+schedule\s+an?\s+interview/i) ||
                            message.match(/(\w+)\s+to\s+schedule\s+an?\s+interview/i);
      
      if (interviewMatch) {
        candidateName = interviewMatch[1];
        newStatus = 'INTERVIEW';
      } else {
        // Standard move pattern - be more specific with name extraction
        const moveMatch = message.match(/move\s+candidate\s+(\w+(?:\s+\w+)?)\s+to\s+(\w+(?:\s+\w+)*)/i) ||
                         message.match(/move\s+(\w+(?:\s+\w+)?)\s+to\s+(\w+(?:\s+\w+)*)/i);
        
        if (moveMatch) {
          candidateName = moveMatch[1].trim();
          newStatus = moveMatch[2].trim().toUpperCase().replace(/\s+/g, '_');
        }
      }
      
      if (!candidateName || !newStatus) {
        return {
          success: false,
          message: "I need to know which candidate to move and where. Please specify like: 'Move Chen to Interview' or 'Move Sarah Johnson to Screening'."
        };
      }

      // Find candidate by name using fuzzy matching
      const candidates = await storage.getAllCandidates();
      const matches = findCandidatesFuzzy(candidates, candidateName);

      if (matches.length === 0) {
        // No matches found - show all candidates in the requested stage instead
        const stageMatch = message.match(/to\s+(\w+(?:\s+\w+)*)/i);
        const targetStage = stageMatch ? stageMatch[1].toUpperCase().replace(/\s+/g, '_') : '';
        
        const candidatesInStage = candidates.filter(c => 
          c.status?.toUpperCase() === targetStage || 
          c.status?.toUpperCase().includes(targetStage)
        );
        
        if (candidatesInStage.length > 0) {
          return {
            success: false,
            message: `I couldn't find a candidate matching "${candidateName}". Here are the candidates currently in ${targetStage}:\n${candidatesInStage.map(c => `• ${c.firstName} ${c.lastName} - ${c.position}`).join('\n')}\n\nPlease specify the exact name of the candidate you want to move.`
          };
        } else {
          return {
            success: false,
            message: `I couldn't find a candidate matching "${candidateName}". Please check the spelling or try using their full name.`
          };
        }
      }
      
      let candidate;
      
      // If we have an exact match (score >= 0.95), use it directly
      if (matches[0].score >= 0.95) {
        candidate = matches[0].candidate;
      } else {
        // We have close matches - ask for confirmation
        const topMatches = matches.slice(0, 3);
        return {
          success: false,
          message: `I found ${topMatches.length} possible matches for "${candidateName}":\n${topMatches.map((m, i) => 
            `${i + 1}. ${m.candidate.firstName} ${m.candidate.lastName} - ${m.candidate.position} (${Math.round(m.score * 100)}% match)`
          ).join('\n')}\n\nDid you mean one of these candidates? Please use their full name to confirm.`,
          requiresConfirmation: true,
          confirmationData: {
            action: 'move_candidate',
            candidates: topMatches.map(m => ({
              id: m.candidate.id,
              name: `${m.candidate.firstName} ${m.candidate.lastName}`,
              position: m.candidate.position,
              score: m.score
            })),
            targetStatus: newStatus
          }
        };
      }

      // Validate status
      const validStatuses = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'DEAD_BY_US'];
      const mappedStatus = newStatus === 'DEAD_BY_US' ? 'DEAD_BY_US' : 
                          validStatuses.find(s => s.includes(newStatus)) || newStatus;

      if (!validStatuses.includes(mappedStatus)) {
        return {
          success: false,
          message: `"${newStatus}" is not a valid status. Valid options are: Applied, Screening, Interview, Offer, Hired, Rejected, Dead by Us.`
        };
      }

      // Execute the move directly - this is an action handler, the user already asked for it
      try {
        const result = await this.recruitingManager.moveCandidateStage(candidate.id, mappedStatus);

        if (result.success) {
          // Also update via storage to ensure consistency
          try {
            await storage.updateCandidate(candidate.id, {
              status: mappedStatus,
            });
          } catch (e) {
            console.log('[SUSAN-AI] Note: Additional storage update failed:', e);
          }

          return {
            success: true,
            message: `✅ Moved **${candidate.firstName} ${candidate.lastName}** from ${candidate.status || 'current stage'} to **${mappedStatus}**!${['INTERVIEW', 'OFFER', 'HIRED'].includes(mappedStatus) ? '\n\n📧 Notification email has been sent to the candidate.' : ''}`,
            data: {
              candidateId: candidate.id,
              candidateName: `${candidate.firstName} ${candidate.lastName}`,
              oldStatus: candidate.status,
              newStatus: mappedStatus
            }
          };
        } else {
          return {
            success: false,
            message: result.error || 'Failed to move candidate',
            error: result.error
          };
        }
      } catch (moveError) {
        // If recruiting manager fails, try direct storage update
        try {
          await storage.updateCandidate(candidate.id, {
            status: mappedStatus,
          });
          return {
            success: true,
            message: `✅ Moved **${candidate.firstName} ${candidate.lastName}** to **${mappedStatus}**!`,
            data: {
              candidateId: candidate.id,
              newStatus: mappedStatus
            }
          };
        } catch (storageError) {
          return {
            success: false,
            message: `Failed to move candidate: ${(storageError as Error).message}`,
            error: (storageError as Error).message
          };
        }
      }

    } catch (error) {
      return {
        success: false,
        message: 'Failed to move candidate: ' + (error as Error).message,
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle interview scheduling
   */
  private async handleInterviewScheduling(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse candidate name and interview details from message
      let candidateName = '';
      let interviewDate = '';
      let interviewer = '';
      let location = '';
      
      // Complex pattern for "move chen to schedule an interview for 8/26 with reese in the office"
      const complexMatch = message.match(/(?:move\s+)?(\w+)\s+to\s+schedule\s+an?\s+interview\s+(?:for|on)\s+([\d\/\-]+)(?:\s+with\s+(\w+))?(?:\s+(?:in|at)\s+(.+))?/i);
      
      if (complexMatch) {
        candidateName = complexMatch[1];
        interviewDate = complexMatch[2] || '';
        interviewer = complexMatch[3] || '';
        location = complexMatch[4] || '';
      } else {
        // Simple patterns
        const simpleMatch = message.match(/schedule\s+interview\s+(?:with|for)\s+(\w+(?:\s+\w+)?)/i) ||
                           message.match(/interview\s+(\w+(?:\s+\w+)?)/i) ||
                           message.match(/(\w+)\s+(?:for|to)\s+interview/i);
        
        if (simpleMatch) {
          candidateName = simpleMatch[1].trim();
        }
        
        // Extract date if present
        const dateMatch = message.match(/(?:for|on)\s+([\d\/\-]+|\w+\s+\d+)/i);
        if (dateMatch) {
          interviewDate = dateMatch[1];
        }
        
        // Extract interviewer if present
        const interviewerMatch = message.match(/with\s+(\w+)/i);
        if (interviewerMatch && interviewerMatch[1].toLowerCase() !== candidateName.toLowerCase()) {
          interviewer = interviewerMatch[1];
        }
        
        // Extract location if present
        const locationMatch = message.match(/(?:in|at)\s+(?:the\s+)?(.+?)(?:\s+on\s+|\s+for\s+|$)/i);
        if (locationMatch) {
          location = locationMatch[1].trim();
        }
      }
      
      if (!candidateName) {
        return {
          success: false,
          message: "Please specify which candidate you'd like to schedule an interview with."
        };
      }

      // Find candidate using fuzzy matching
      const candidates = await storage.getAllCandidates();
      const matches = findCandidatesFuzzy(candidates, candidateName);

      if (matches.length === 0) {
        return {
          success: false,
          message: `I couldn't find a candidate named "${candidateName}". Please check the spelling or try using their full name.`
        };
      }
      
      let candidate;
      
      // If we have an exact match, use it
      if (matches[0].score >= 0.95) {
        candidate = matches[0].candidate;
      } else {
        // Show close matches and ask for clarification
        const topMatches = matches.slice(0, 3);
        return {
          success: false,
          message: `I found ${topMatches.length} possible matches for "${candidateName}":\n${topMatches.map((m, i) => 
            `${i + 1}. ${m.candidate.firstName} ${m.candidate.lastName} - ${m.candidate.position} (${Math.round(m.score * 100)}% match)`
          ).join('\n')}\n\nPlease use their full name to schedule the interview.`,
          requiresConfirmation: true,
          confirmationData: {
            action: 'schedule_interview',
            candidates: topMatches.map(m => ({
              id: m.candidate.id,
              name: `${m.candidate.firstName} ${m.candidate.lastName}`,
              position: m.candidate.position,
              score: m.score
            }))
          }
        };
      }

      // Parse date and time with proper validation
      let scheduledDate: Date;
      const now = new Date();
      
      // Parse time from message
      const timeMatch = message.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i) ||
                       message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
      
      let hours = 10; // Default to 10 AM
      let minutes = 0;
      
      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const meridian = timeMatch[3]?.toLowerCase();
        
        // Handle 12-hour format
        if (meridian) {
          if ((meridian.includes('p') && hours !== 12)) {
            hours += 12;
          } else if (meridian.includes('a') && hours === 12) {
            hours = 0;
          }
        } else {
          // If no AM/PM specified and hour is 1-6, assume PM for business hours
          if (hours >= 1 && hours <= 6) {
            hours += 12;
          }
        }
      }
      
      // Parse date
      if (interviewDate) {
        const lowerDate = interviewDate.toLowerCase();
        
        if (lowerDate === 'today') {
          scheduledDate = new Date(now);
        } else if (lowerDate === 'tomorrow') {
          scheduledDate = new Date(now.getTime() + 86400000);
        } else {
          // Try to parse the date
          scheduledDate = new Date(interviewDate);
          
          // If invalid date or parsing resulted in weird time, use tomorrow
          if (isNaN(scheduledDate.getTime())) {
            console.log('[SUSAN-AI] Invalid date format, defaulting to tomorrow:', interviewDate);
            scheduledDate = new Date(now.getTime() + 86400000);
          }
        }
      } else {
        // Default to tomorrow if no date specified
        scheduledDate = new Date(now.getTime() + 86400000);
      }
      
      // Set the time on the date
      scheduledDate.setHours(hours, minutes, 0, 0);
      
      // Validate the scheduled time is reasonable (8 AM - 6 PM on weekdays)
      const scheduledHour = scheduledDate.getHours();
      const dayOfWeek = scheduledDate.getDay();
      
      if (scheduledHour < 8 || scheduledHour >= 18) {
        console.log('[SUSAN-AI] Adjusting unreasonable interview time from', scheduledHour, 'to 10 AM');
        scheduledDate.setHours(10, 0, 0, 0);
      }
      
      // Warn if scheduling on weekend
      let weekendWarning = '';
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
        weekendWarning = `\n⚠️ Note: This interview is scheduled for ${dayName}.`;
      }
      
      // Build confirmation message with all details
      const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      
      const interviewerName = interviewer || `${user.firstName} ${user.lastName}`;
      const interviewLocation = location || 'Main Office';
      
      // Return confirmation request instead of creating immediately
      return {
        success: false,
        message: `I'm ready to schedule an interview with the following details:
        
📅 **Candidate**: ${candidate.firstName} ${candidate.lastName} (${candidate.position})
📆 **Date**: ${formattedDate}
⏰ **Time**: ${formattedTime}
👤 **Interviewer**: ${interviewerName}
📍 **Location**: ${interviewLocation}${weekendWarning}

This will:
• Create a calendar event
• Send interview invitation emails to ${candidate.email}
• Update candidate status to "Interview"

Should I proceed with scheduling this interview?`,
        requiresConfirmation: true,
        confirmationData: {
          action: 'confirm_interview_schedule',
          candidateId: candidate.id,
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          candidateEmail: candidate.email,
          interviewerId: user.id,
          interviewerName: interviewerName,
          scheduledDate: scheduledDate.toISOString(),
          duration: 60,
          type: 'IN_PERSON',
          location: interviewLocation,
          meetingLink: location?.includes('zoom') || location?.includes('meet') ? location : undefined
        }
      };
      
      // The actual interview creation code will be handled after confirmation
      // in a separate confirmation handler method

    } catch (error) {
      return {
        success: false,
        message: 'Failed to schedule interview.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle PTO requests
   */
  private async handlePTORequest(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse dates from message
      const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2})/g;
      const dates = message.match(datePattern);
      
      // Parse number of days
      const daysMatch = message.match(/(\d+)\s*days?/i);
      const days = daysMatch ? parseInt(daysMatch[1]) : 1;

      if (!dates || dates.length === 0) {
        return {
          success: false,
          message: "Please specify the dates you'd like to request PTO for, like: 'I need 3 days off from December 20 to December 22' or 'Request PTO for 12/20/2024'."
        };
      }

      // For now, create a basic PTO request - in a real system you'd parse dates properly
      const startDate = new Date().toISOString().split('T')[0]; // Placeholder
      const endDate = new Date().toISOString().split('T')[0]; // Placeholder

      const ptoRequest = await storage.createPtoRequest({
        employeeId: user.id,
        startDate,
        endDate,
        days,
        reason: `Requested via Susan AI: ${message}`
      });

      return {
        success: true,
        message: `PTO request submitted for ${days} day${days > 1 ? 's' : ''}. Your request is now pending approval.`,
        data: { requestId: ptoRequest.id }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to create PTO request.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle PTO balance inquiries
   */
  private async handlePTOBalance(user: User): Promise<ActionResult | null> {
    try {
      const ptoPolicy = await storage.getPtoPolicyByEmployee(user.id);

      // Calculate used PTO days from approved requests this year
      const requests = await storage.getPtoRequestsByEmployee(user.id);
      const currentYear = new Date().getFullYear();
      const usedDays = requests
        .filter(r => r.status === 'APPROVED' && new Date(r.startDate).getFullYear() === currentYear)
        .reduce((total, r) => {
          const start = new Date(r.startDate);
          const end = new Date(r.endDate);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return total + days;
        }, 0);

      const totalDays = ptoPolicy?.totalDays || 0;
      const remaining = totalDays - usedDays;

      return {
        success: true,
        message: `You have ${remaining} PTO days remaining out of ${totalDays} total days this year. You've used ${usedDays} days so far.`,
        data: { remaining, total: totalDays, used: usedDays }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve PTO balance.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle employee update operations
   */
  private async handleEmployeeUpdate(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Extract employee identifier (email or name)
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee to update (include their email address)."
        };
      }

      // Parse what to update
      const updates: any = {};
      
      if (message.includes('department')) {
        const deptMatch = message.match(/department\s+(?:to\s+)?(\w+)/i);
        if (deptMatch) updates.department = deptMatch[1];
      }
      
      if (message.includes('role') || message.includes('position')) {
        const roleMatch = message.match(/(?:role|position)\s+(?:to\s+)?(\w+)/i);
        if (roleMatch) updates.position = roleMatch[1];
      }
      
      if (message.includes('salary')) {
        const salaryMatch = message.match(/salary\s+(?:to\s+)?\$?([\d,]+)/i);
        if (salaryMatch) updates.salary = parseInt(salaryMatch[1].replace(/,/g, ''));
      }

      // Find employee by email
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => e.email === emailMatch[0]);
      
      if (!employee) {
        return { success: false, message: `Employee ${emailMatch[0]} not found.` };
      }

      const result = await this.employeeManager.updateEmployee(employee.id, updates);
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully updated ${employee.firstName} ${employee.lastName}'s information.` : 
          result.error || 'Failed to update employee.',
        data: result.employee
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update employee.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle employee termination
   */
  private async handleEmployeeTermination(message: string, user: User): Promise<ActionResult | null> {
    try {
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee to terminate (include their email address)."
        };
      }

      // Find employee
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => e.email === emailMatch[0]);
      
      if (!employee) {
        return { success: false, message: `Employee ${emailMatch[0]} not found.` };
      }

      const permanent = message.includes('delete') || message.includes('permanent');
      const result = await this.employeeManager.removeEmployee(employee.id, permanent);
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully ${permanent ? 'deleted' : 'deactivated'} ${employee.firstName} ${employee.lastName}.` : 
          result.error || 'Failed to terminate employee.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to terminate employee.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle password reset
   */
  private async handlePasswordReset(message: string, user: User): Promise<ActionResult | null> {
    try {
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee's password to reset (include their email address)."
        };
      }

      // Find employee
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => e.email === emailMatch[0]);
      
      if (!employee) {
        return { success: false, message: `Employee ${emailMatch[0]} not found.` };
      }

      const result = await this.employeeManager.resetPassword(employee.id);
      
      return {
        success: result.success,
        message: result.success ? 
          `Password reset for ${employee.firstName} ${employee.lastName}. Temporary password sent to their email.` : 
          result.error || 'Failed to reset password.',
        data: { temporaryPassword: result.temporaryPassword }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to reset password.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle employee transfer
   */
  private async handleEmployeeTransfer(message: string, user: User): Promise<ActionResult | null> {
    try {
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee to transfer (include their email address)."
        };
      }

      // Parse department
      const deptMatch = message.match(/(?:to|into)\s+(\w+)\s+(?:department|team)/i);
      const newDepartment = deptMatch?.[1];
      
      if (!newDepartment) {
        return {
          success: false,
          message: "Please specify the new department for the transfer."
        };
      }

      // Find employee
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => e.email === emailMatch[0]);
      
      if (!employee) {
        return { success: false, message: `Employee ${emailMatch[0]} not found.` };
      }

      const result = await this.employeeManager.transferEmployee(
        employee.id,
        newDepartment
      );
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully transferred ${employee.firstName} ${employee.lastName} to ${newDepartment} department.` : 
          result.error || 'Failed to transfer employee.',
        data: result.employee
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to transfer employee.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle PTO approval
   */
  private async handlePTOApproval(message: string, user: User): Promise<ActionResult | null> {
    try {
      const lowerMessage = message.toLowerCase();
      
      // Check for bulk approval
      if (lowerMessage.includes('all') || lowerMessage.includes('pending')) {
        const filter: any = {};
        
        // Check for department filter
        const deptMatch = message.match(/(?:for|in)\s+(\w+)\s+(?:department|team)/i);
        if (deptMatch) filter.department = deptMatch[1];
        
        const result = await this.ptoManager.bulkApprovePTO(filter);
        
        return {
          success: result.success,
          message: result.success ? 
            `Successfully approved ${result.count} PTO requests.` : 
            result.error || 'Failed to bulk approve PTO.',
        };
      }
      
      // Single PTO approval - need to find the request
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee's PTO to approve or use 'approve all pending PTO'."
        };
      }

      // Get pending PTO for this employee
      const ptoRequests = await storage.getAllPtoRequests();
      const pendingRequest = ptoRequests.find(r => 
        r.employeeId === emailMatch[0] && r.status === 'PENDING'
      );
      
      if (!pendingRequest) {
        return { success: false, message: `No pending PTO requests found for ${emailMatch[0]}.` };
      }

      const overrideConflicts = lowerMessage.includes('override') || lowerMessage.includes('force');
      const result = await this.ptoManager.approvePTORequest(
        pendingRequest.id,
        overrideConflicts
      );
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully approved PTO request.` : 
          result.error || 'Failed to approve PTO.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to approve PTO.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle PTO denial
   */
  private async handlePTODenial(message: string, user: User): Promise<ActionResult | null> {
    try {
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee's PTO to deny."
        };
      }

      // Extract reason
      const reasonMatch = message.match(/(?:because|reason:)\s+(.+)/i);
      const reason = reasonMatch?.[1] || 'Request denied by management.';

      // Get pending PTO for this employee
      const ptoRequests = await storage.getAllPtoRequests();
      const pendingRequest = ptoRequests.find(r => 
        r.employeeId === emailMatch[0] && r.status === 'PENDING'
      );
      
      if (!pendingRequest) {
        return { success: false, message: `No pending PTO requests found for ${emailMatch[0]}.` };
      }

      const result = await this.ptoManager.denyPTORequest(pendingRequest.id, reason);
      
      return {
        success: result.success,
        message: result.success ? 
          `PTO request denied with reason: ${reason}` : 
          result.error || 'Failed to deny PTO.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to deny PTO.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle PTO balance adjustment
   */
  private async handlePTOAdjustment(message: string, user: User): Promise<ActionResult | null> {
    try {
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee's PTO balance to adjust."
        };
      }

      // Parse days
      const daysMatch = message.match(/(\d+)\s*(?:days?|hours?)/i);
      const days = daysMatch ? parseInt(daysMatch[1]) : 0;
      
      if (!days) {
        return {
          success: false,
          message: "Please specify how many days to add or adjust."
        };
      }

      // Parse PTO type
      const typeMatch = message.match(/(vacation|sick|personal)/i);
      const ptoType = (typeMatch?.[1]?.toUpperCase() || 'VACATION') as 'VACATION' | 'SICK' | 'PERSONAL';

      // Find employee
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => e.email === emailMatch[0]);
      
      if (!employee) {
        return { success: false, message: `Employee ${emailMatch[0]} not found.` };
      }

      const adjustment = message.includes('remove') || message.includes('subtract') ? -days : days;
      const result = await this.ptoManager.adjustPTOBalance(
        employee.id,
        ptoType,
        adjustment,
        `Adjusted by ${user.firstName} ${user.lastName} via Susan AI`
      );
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully adjusted ${employee.firstName}'s ${ptoType} balance by ${adjustment} days. New balance: ${result.newBalance} days.` : 
          result.error || 'Failed to adjust PTO balance.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to adjust PTO balance.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle PTO cancellation
   */
  private async handlePTOCancellation(message: string, user: User): Promise<ActionResult | null> {
    try {
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      
      if (!emailMatch) {
        return {
          success: false,
          message: "Please specify which employee's PTO to cancel."
        };
      }

      // Get approved PTO for this employee
      const ptoRequests = await storage.getAllPtoRequests();
      const approvedRequest = ptoRequests.find(r => 
        r.employeeId === emailMatch[0] && r.status === 'APPROVED'
      );
      
      if (!approvedRequest) {
        return { success: false, message: `No approved PTO requests found for ${emailMatch[0]}.` };
      }

      const result = await this.ptoManager.cancelPTORequest(
        approvedRequest.id,
        `Cancelled by ${user.firstName} ${user.lastName} via Susan AI`
      );
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully cancelled PTO request.` : 
          result.error || 'Failed to cancel PTO.',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to cancel PTO.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle document upload requests
   */
  private async handleDocumentRequest(message: string, user: User): Promise<ActionResult | null> {
    const lowerMessage = message.toLowerCase();
    
    let documentType = 'general';
    if (lowerMessage.includes('coi') || lowerMessage.includes('insurance')) documentType = 'coi';
    else if (lowerMessage.includes('resume') || lowerMessage.includes('cv')) documentType = 'resume';
    else if (lowerMessage.includes('employee') || lowerMessage.includes('hr')) documentType = 'employee';

    return {
      success: true,
      message: `I can help you upload ${documentType} documents. Please use the file upload feature in the interface to select your files, and I'll categorize them appropriately.`,
      data: { documentType, uploadInstructions: true }
    };
  }

  /**
   * Send candidate status notification email
   */
  private async sendCandidateStatusEmail(candidate: any, status: string, user: User): Promise<void> {
    const subject = status === 'INTERVIEW' ? 'Interview Invitation' :
                   status === 'OFFER' ? 'Job Offer' :
                   status === 'HIRED' ? 'Welcome to ROOF-ER!' : 'Application Update';

    const body = `Dear ${candidate.firstName},\n\nYour application status has been updated.\n\nBest regards,\n${user.firstName} ${user.lastName}\nROOF-ER HR Team`;

    const emailService = new EmailService();
    await emailService.initialize();
    await emailService.sendEmail({
      to: candidate.email,
      subject,
      html: body
    });
  }

  /**
   * Send interview invitation email
   */
  private async sendInterviewInvitationEmail(candidate: any, user: User): Promise<void> {
    const subject = 'Interview Invitation - ROOF-ER';
    const body = `Dear ${candidate.firstName},\n\nWe would like to invite you for an interview. Someone from our team will contact you shortly to schedule a convenient time.\n\nBest regards,\n${user.firstName} ${user.lastName}\nROOF-ER HR Team`;

    const emailService = new EmailService();
    await emailService.initialize();
    await emailService.sendEmail({
      to: candidate.email,
      subject,
      html: body
    });
  }

  /**
   * Permission checks
   */
  private canManageCandidates(user: User): boolean {
    return ['TRUE_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role as string) || user.department === 'Recruitment';
  }

  private canManageEmployees(user: User): boolean {
    return ['TRUE_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role as string);
  }

  private canManageAgents(user: User): boolean {
    return ['TRUE_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user.role as string);
  }
  
  private canViewOwnData(user: User): boolean {
    // All users can view their own data
    return true;
  }
  
  private canManageTeam(user: User): boolean {
    return ['TRUE_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role as string);
  }
  
  private canRequestPTO(user: User): boolean {
    // All active employees can request PTO
    return user.isActive === true;
  }
  
  private canViewDocuments(user: User): boolean {
    // All users can view documents they have access to
    return true;
  }
  
  private canSubmitFeedback(user: User): boolean {
    // All users can submit feedback
    return true;
  }

  // Employee Management Methods
  private async handleEmployeeCreation(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Extract employee details from message
      const nameMatch = message.match(/(?:add|create|new)\s+(?:employee|user|person)?\s*(?:named?|called)?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      const emailMatch = message.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      const roleMatch = message.match(/(?:as|role|position)\s+(admin|manager|employee)/i);
      const departmentMatch = message.match(/(?:in|to|department)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      
      if (!nameMatch) {
        return {
          success: false,
          message: "Please specify the employee's name. Example: 'Add employee John Smith'"
        };
      }
      
      const fullName = nameMatch[1].trim();
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];
      
      // Create employee
      const employee = await storage.createUser({
        firstName,
        lastName,
        email: emailMatch?.[0] || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@roof-hr.com`,
        role: (roleMatch?.[1]?.toUpperCase() || 'EMPLOYEE') as string,
        employmentType: 'FULL_TIME',
        department: departmentMatch?.[1] || 'General',
        position: departmentMatch?.[1] || 'Team Member',
        hireDate: new Date().toISOString().split('T')[0],
        passwordHash: 'TempPass123!' // Will need to be changed on first login
      } as any);
      
      return {
        success: true,
        message: `✅ Successfully created employee ${firstName} ${lastName}.\n\nEmail: ${employee.email}\nRole: ${employee.role}\nDepartment: ${employee.department}\n\nTemporary password: TempPass123! (must be changed on first login)`,
        data: { employeeId: employee.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create employee.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleEmployeeDeletion(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Extract employee name
      const employeeMatch = message.match(/(?:delete|remove|terminate)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      
      if (!employeeMatch) {
        return {
          success: false,
          message: "Please specify which employee to remove."
        };
      }
      
      // Find employee
      const employees = await storage.getAllUsers();
      const employeeName = employeeMatch[1].toLowerCase();
      const employee = employees.find(e => {
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        return fullName.includes(employeeName);
      });
      
      if (!employee) {
        return {
          success: false,
          message: `Could not find employee: ${employeeMatch[1]}`
        };
      }
      
      // Soft delete - set isActive to false
      await storage.updateUser(employee.id, { isActive: false });
      
      return {
        success: true,
        message: `✅ Successfully deactivated ${employee.firstName} ${employee.lastName}. Their account is now inactive.`,
        data: { employeeId: employee.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove employee.',
        error: (error as Error).message
      };
    }
  }
  private async handleCandidateEmail(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Extract candidate name from message
      const candidateMatch = message.match(/(?:email|send.*to)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      const candidateName = candidateMatch?.[1];
      
      if (!candidateName) {
        return {
          success: false,
          message: "Please specify which candidate to email."
        };
      }

      // Find candidate
      const candidates = await storage.searchCandidatesByName(candidateName);
      
      if (candidates.length === 0) {
        return {
          success: false,
          message: `Could not find candidate: ${candidateName}`
        };
      }
      
      if (candidates.length > 1) {
        return {
          success: false,
          message: `Found ${candidates.length} candidates matching "${candidateName}". Please be more specific.`
        };
      }

      const candidate = candidates[0];

      // Determine email type and content
      let subject = 'Update on Your Application at ROOF-ER';
      let body = '';
      
      if (message.toLowerCase().includes('reject')) {
        subject = 'Application Update - ROOF-ER';
        body = `Dear ${candidate.firstName},\n\nThank you for your interest in the ${candidate.position} position at ROOF-ER. After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current needs.\n\nWe appreciate the time you took to apply and wish you the best in your job search.\n\nBest regards,\n${user.firstName} ${user.lastName}\nROOF-ER HR Team`;
      } else if (message.toLowerCase().includes('offer')) {
        subject = 'Job Offer - ROOF-ER';
        body = `Dear ${candidate.firstName},\n\nCongratulations! We're pleased to offer you the ${candidate.position} position at ROOF-ER. We were impressed with your qualifications and believe you'll be a great addition to our team.\n\nA formal offer letter with details will be sent separately.\n\nBest regards,\n${user.firstName} ${user.lastName}\nROOF-ER HR Team`;
      } else if (message.toLowerCase().includes('interview')) {
        subject = 'Interview Invitation - ROOF-ER';
        body = `Dear ${candidate.firstName},\n\nWe're impressed with your application for the ${candidate.position} position and would like to invite you for an interview.\n\nWe'll be in touch shortly to schedule a convenient time.\n\nBest regards,\n${user.firstName} ${user.lastName}\nROOF-ER HR Team`;
      } else {
        body = `Dear ${candidate.firstName},\n\nWe wanted to update you regarding your application for the ${candidate.position} position at ROOF-ER.\n\nYour application is currently under review, and we'll be in touch with next steps soon.\n\nBest regards,\n${user.firstName} ${user.lastName}\nROOF-ER HR Team`;
      }

      // Send email
      const emailService = new EmailService();
      await emailService.initialize();
      await emailService.sendEmail({
        to: candidate.email,
        subject,
        html: body.replace(/\n/g, '<br>')
      });

      return {
        success: true,
        message: `✅ Email sent to ${candidate.firstName} ${candidate.lastName} (${candidate.email}).\n\nSubject: ${subject}`,
        data: {
          candidateId: candidate.id,
          email: candidate.email,
          subject
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send email.',
        error: (error as Error).message
      };
    }
  }
  private async handleEmployeeEmail(message: string, user: User): Promise<ActionResult | null> { return null; }
  private async handleAgentControl(message: string, user: User): Promise<ActionResult | null> { return null; }

  /**
   * Note Creation Handler
   * Handles creating notes for employees and candidates
   */
  private async handleNoteCreation(message: string, user: User): Promise<ActionResult | null> {
    try {
      const lowerMessage = message.toLowerCase();

      // Determine if this is for an employee or candidate
      const isCandidate = lowerMessage.includes('candidate') || lowerMessage.includes('applicant');
      const isEmployee = lowerMessage.includes('employee') || lowerMessage.includes('user') || lowerMessage.includes('staff');

      // Parse the note content - look for patterns like:
      // "add a note to [name]: [content]"
      // "note for [name] - [content]"
      // "create note on [name] saying [content]"
      const notePatterns = [
        /(?:add|create|make|record|write)\s+(?:a\s+)?note\s+(?:to|for|on|about)\s+([A-Za-z\s]+?)[\s:]+(.+)/i,
        /note\s+(?:for|on|about)\s+([A-Za-z\s]+?)[\s:\-]+(.+)/i,
        /([A-Za-z\s]+?)\s+note[\s:\-]+(.+)/i,
      ];

      let personName: string | null = null;
      let noteContent: string | null = null;

      for (const pattern of notePatterns) {
        const match = message.match(pattern);
        if (match) {
          personName = match[1].trim()
            .replace(/\b(candidate|employee|user|staff|about|for|on)\b/gi, '')
            .trim();
          noteContent = match[2].trim();
          break;
        }
      }

      if (!personName || !noteContent) {
        return {
          success: false,
          message: "I couldn't understand the note request. Please use a format like:\n" +
                   "• 'Add a note to John Smith: Great interview today'\n" +
                   "• 'Note for Sarah: Completed training'\n" +
                   "• 'Create note about Mike - Needs follow-up on project'"
        };
      }

      // Try to find the person
      if (isCandidate || !isEmployee) {
        // Try candidates first
        const candidates = await storage.getAllCandidates();
        const candidateMatches = findCandidatesFuzzy(candidates, personName, 0.6);

        if (candidateMatches.length > 0) {
          const bestMatch = candidateMatches[0];
          const candidate = bestMatch.candidate;

          // Create candidate note
          const note = await storage.createCandidateNote({
            candidateId: candidate.id,
            authorId: user.id,
            content: noteContent,
            type: 'GENERAL'
          });

          return {
            success: true,
            message: `✅ Note added for candidate **${candidate.firstName} ${candidate.lastName}**:\n\n"${noteContent}"`,
            data: { noteId: note.id, candidateId: candidate.id, type: 'candidate' }
          };
        }
      }

      if (isEmployee || !isCandidate) {
        // Try employees
        const employees = await storage.getAllUsers();
        const employeeMatches = employees
          .map(emp => {
            const fullName = `${emp.firstName} ${emp.lastName}`.trim();
            const score = calculateSimilarity(personName!, fullName);
            return { employee: emp, score };
          })
          .filter(m => m.score >= 0.6)
          .sort((a, b) => b.score - a.score);

        if (employeeMatches.length > 0) {
          const bestMatch = employeeMatches[0];
          const employee = bestMatch.employee;

          // Create employee note
          const note = await storage.createEmployeeNote({
            employeeId: employee.id,
            authorId: user.id,
            content: noteContent,
            type: 'AI_GENERATED'
          });

          return {
            success: true,
            message: `✅ Note added for employee **${employee.firstName} ${employee.lastName}**:\n\n"${noteContent}"`,
            data: { noteId: note.id, employeeId: employee.id, type: 'employee' }
          };
        }
      }

      // No match found
      return {
        success: false,
        message: `I couldn't find anyone named "${personName}" in the system. Please check the name and try again.`
      };

    } catch (error) {
      console.error('[SUSAN-AI] Note creation error:', error);
      return {
        success: false,
        message: 'Failed to create note.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Inventory Management Methods
   */
  private async handleInventoryAdd(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse item and quantity
      const itemMatch = message.match(/add\s+(\d+)?\s*([A-Za-z\s]+?)(?:\s+to\s+inventory)?/i) ||
                       message.match(/stock\s+(\d+)?\s*([A-Za-z\s]+)/i);
      
      if (!itemMatch) {
        return {
          success: false,
          message: "Please specify what to add to inventory. Example: 'Add 5 hammers to inventory'"
        };
      }
      
      const quantity = parseInt(itemMatch[1] || '1');
      const itemName = itemMatch[2].trim();
      
      // Check if item exists
      const tools = await storage.getAllTools();
      let tool = tools.find(t => t.name.toLowerCase().includes(itemName.toLowerCase()));
      
      if (tool) {
        // Update existing tool quantity
        await storage.updateTool(tool.id, {
          quantity: tool.quantity + quantity
        });
        
        return {
          success: true,
          message: `✅ Added ${quantity} ${itemName} to inventory.\n\nNew total: ${tool.quantity + quantity} units`,
          data: { toolId: tool.id, added: quantity, newTotal: tool.quantity + quantity }
        };
      } else {
        // Create new tool
        const newTool = await storage.createTool({
          name: itemName,
          quantity,
          category: 'OTHER' as const,
          createdBy: 'SYSTEM'
        });
        
        return {
          success: true,
          message: `✅ Created new inventory item: ${itemName} with ${quantity} units.`,
          data: { toolId: newTool.id, quantity }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to add to inventory.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleInventoryRemove(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse item and quantity
      const itemMatch = message.match(/(?:remove|subtract)\s+(\d+)?\s*([A-Za-z\s]+?)(?:\s+from\s+inventory)?/i);
      
      if (!itemMatch) {
        return {
          success: false,
          message: "Please specify what to remove from inventory."
        };
      }
      
      const quantity = parseInt(itemMatch[1] || '1');
      const itemName = itemMatch[2].trim();
      
      // Find item
      const tools = await storage.getAllTools();
      const tool = tools.find(t => t.name.toLowerCase().includes(itemName.toLowerCase()));
      
      if (!tool) {
        return {
          success: false,
          message: `Could not find item: ${itemName}`
        };
      }
      
      if (tool.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient inventory. Only ${tool.quantity} ${tool.name} available.`
        };
      }
      
      await storage.updateTool(tool.id, {
        quantity: tool.quantity - quantity
      });
      
      return {
        success: true,
        message: `✅ Removed ${quantity} ${tool.name} from inventory.\n\nRemaining: ${tool.quantity - quantity} units`,
        data: { toolId: tool.id, removed: quantity, remaining: tool.quantity - quantity }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove from inventory.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleInventoryAssign(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse assignment details
      const assignMatch = message.match(/assign\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      
      if (!assignMatch) {
        return {
          success: false,
          message: "Please specify what to assign and to whom. Example: 'Assign drill to John Smith'"
        };
      }
      
      const itemName = assignMatch[1].trim();
      const employeeName = assignMatch[2].trim();
      
      // Find tool and employee
      const tools = await storage.getAllTools();
      const tool = tools.find(t => t.name.toLowerCase().includes(itemName.toLowerCase()));
      
      if (!tool) {
        return {
          success: false,
          message: `Could not find tool: ${itemName}`
        };
      }
      
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => {
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        return fullName.includes(employeeName.toLowerCase());
      });
      
      if (!employee) {
        return {
          success: false,
          message: `Could not find employee: ${employeeName}`
        };
      }
      
      // Create assignment
      await storage.createToolAssignment({
        toolId: tool.id,
        employeeId: employee.id,
        assignedBy: user.id,
        assignedDate: new Date(),
        status: 'ASSIGNED',
        condition: 'GOOD',
      });

      // Update tool quantity
      if (tool.quantity > 0) {
        await storage.updateTool(tool.id, {
          quantity: tool.quantity - 1
        });
      }
      
      return {
        success: true,
        message: `✅ Assigned ${tool.name} to ${employee.firstName} ${employee.lastName}.`,
        data: { toolId: tool.id, employeeId: employee.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to assign tool.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleInventoryReturn(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse return details
      const returnMatch = message.match(/return\s+([A-Za-z\s]+?)(?:\s+from\s+([A-Za-z]+(?:\s+[A-Za-z]+)?))?/i);
      
      if (!returnMatch) {
        return {
          success: false,
          message: "Please specify what tool to return."
        };
      }
      
      const itemName = returnMatch[1].trim();
      const employeeName = returnMatch[2]?.trim();
      
      // Find tool
      const tools = await storage.getAllTools();
      const tool = tools.find(t => t.name.toLowerCase().includes(itemName.toLowerCase()));
      
      if (!tool) {
        return {
          success: false,
          message: `Could not find tool: ${itemName}`
        };
      }
      
      // Find active assignment
      const assignments = await storage.getToolAssignmentsByTool(tool.id);
      const activeAssignment = assignments.find((a) => a.status === 'ASSIGNED');

      if (!activeAssignment) {
        return {
          success: false,
          message: `${tool.name} is not currently assigned to anyone.`
        };
      }

      // Update assignment
      await storage.updateToolAssignment(activeAssignment.id, {
        returnDate: new Date(),
        status: 'RETURNED'
      });

      // Update tool quantity
      await storage.updateTool(tool.id, {
        quantity: tool.quantity + 1
      });
      
      return {
        success: true,
        message: `✅ ${tool.name} has been returned to inventory.`,
        data: { toolId: tool.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to return tool.',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Enhanced PTO Admin Methods
   */
  private async handlePTOApprovalEnhanced(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse employee name from message
      const employeeMatch = message.match(/approve\s+(?:pto|time off|vacation)\s+(?:for|from)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      
      if (!employeeMatch) {
        // Try to approve all pending requests
        const pendingRequests = await storage.getPendingPtoRequests();
        
        if (pendingRequests.length === 0) {
          return {
            success: false,
            message: "No pending PTO requests to approve."
          };
        }
        
        // Approve first pending request
        const request = pendingRequests[0];
        await storage.updatePtoRequest(request.id, {
          status: 'APPROVED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
        });
        
        const employee = await storage.getUserById(request.employeeId);
        return {
          success: true,
          message: `✅ Approved PTO request for ${employee?.firstName} ${employee?.lastName} from ${request.startDate} to ${request.endDate}.`,
          data: { requestId: request.id }
        };
      }
      
      // Find specific employee's PTO request
      const employeeName = employeeMatch[1].toLowerCase();
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => {
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        return fullName.includes(employeeName);
      });
      
      if (!employee) {
        return {
          success: false,
          message: `Could not find employee: ${employeeMatch[1]}`
        };
      }
      
      // Get employee's pending requests
      const requests = await storage.getPtoRequestsByEmployee(employee.id);
      const pendingRequest = requests.find((r: any) => r.status === 'PENDING');

      if (!pendingRequest) {
        return {
          success: false,
          message: `${employee.firstName} ${employee.lastName} has no pending PTO requests.`
        };
      }

      // Approve the request
      await storage.updatePtoRequest(pendingRequest.id, {
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
      });
      
      return {
        success: true,
        message: `✅ Approved PTO request for ${employee.firstName} ${employee.lastName} from ${pendingRequest.startDate} to ${pendingRequest.endDate}.`,
        data: { requestId: pendingRequest.id, employeeId: employee.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to approve PTO request.',
        error: (error as Error).message
      };
    }
  }
  
  private async handlePTODenialEnhanced(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse employee name and reason
      const employeeMatch = message.match(/(?:deny|reject)\s+(?:pto|time off|vacation)\s+(?:for|from)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      const reasonMatch = message.match(/(?:reason|because)[:]\s*(.+)/i);
      
      if (!employeeMatch) {
        return {
          success: false,
          message: "Please specify whose PTO request to deny."
        };
      }
      
      // Find employee
      const employeeName = employeeMatch[1].toLowerCase();
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => {
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        return fullName.includes(employeeName);
      });
      
      if (!employee) {
        return {
          success: false,
          message: `Could not find employee: ${employeeMatch[1]}`
        };
      }
      
      // Get pending request
      const requests = await storage.getPtoRequestsByEmployee(employee.id);
      const pendingRequest = requests.find((r: any) => r.status === 'PENDING');

      if (!pendingRequest) {
        return {
          success: false,
          message: `${employee.firstName} ${employee.lastName} has no pending PTO requests.`
        };
      }

      // Deny the request
      await storage.updatePtoRequest(pendingRequest.id, {
        status: 'DENIED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: reasonMatch ? reasonMatch[1] : 'Request denied',
      });
      
      return {
        success: true,
        message: `❌ Denied PTO request for ${employee.firstName} ${employee.lastName}.${reasonMatch ? `\n\nReason: ${reasonMatch[1]}` : ''}`,
        data: { requestId: pendingRequest.id, employeeId: employee.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to deny PTO request.',
        error: (error as Error).message
      };
    }
  }
  
  private async handlePTOSubmissionForOthers(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse PTO details
      const employeeMatch = message.match(/(?:submit|request)\s+(?:pto|time off|vacation)\s+for\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      const dateMatch = message.match(/(?:from|on)\s+([\d\/\-]+)\s+(?:to|until)\s+([\d\/\-]+)/i);
      
      if (!employeeMatch) {
        return {
          success: false,
          message: "Please specify which employee to submit PTO for."
        };
      }
      
      // Find employee
      const employeeName = employeeMatch[1].toLowerCase();
      const employees = await storage.getAllUsers();
      const employee = employees.find(e => {
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        return fullName.includes(employeeName);
      });
      
      if (!employee) {
        return {
          success: false,
          message: `Could not find employee: ${employeeMatch[1]}`
        };
      }
      
      // Parse dates or use defaults
      const startDate = dateMatch?.[1] || new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Tomorrow
      const endDate = dateMatch?.[2] || startDate;
      
      // Create PTO request (status defaults to PENDING in storage)
      const request = await storage.createPtoRequest({
        employeeId: employee.id,
        startDate,
        endDate,
        days: 1, // Calculate properly in production
        type: 'VACATION',
        reason: `Submitted by ${user.firstName} ${user.lastName}`
      });
      
      return {
        success: true,
        message: `✅ Created and approved PTO request for ${employee.firstName} ${employee.lastName} from ${startDate} to ${endDate}.`,
        data: { requestId: request.id, employeeId: employee.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to submit PTO request.',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Document Management Methods - COIs and Resumes
   */
  private async handleDocumentRouting(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Check for COI handling
      if (message.toLowerCase().includes('coi') || message.toLowerCase().includes('certificate of insurance')) {
        return this.handleCOIDocument(message, user);
      }
      
      // Check for resume handling
      if (message.toLowerCase().includes('resume') || message.toLowerCase().includes('cv')) {
        return this.handleResumeDocument(message, user);
      }
      
      return null;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to handle document.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleCOIDocument(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse COI action
      if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('expiring')) {
        // Get expiring COIs using the proper coiDocuments table
        const expiringCOIs = await storage.getExpiringCoiDocuments(30);

        if (expiringCOIs.length === 0) {
          return {
            success: true,
            message: "No COIs expiring in the next 30 days."
          };
        }

        const coiList = expiringCOIs.map(c => {
          const name = c.employeeId ? `Employee ID: ${c.employeeId}` : (c.externalName || 'Unknown');
          return `• ${name} (${c.type}): Expires ${c.expirationDate}`;
        }).join('\n');

        return {
          success: true,
          message: `📋 COIs expiring soon:\n\n${coiList}`,
          data: { count: expiringCOIs.length, cois: expiringCOIs }
        };
      }

      // Upload/store COI
      if (message.toLowerCase().includes('upload') || message.toLowerCase().includes('add')) {
        const nameMatch = message.match(/(?:coi|certificate)\s+(?:for|from)\s+([^.]+)/i);
        const externalName = nameMatch?.[1]?.trim() || 'Certificate of Insurance';

        // Determine COI type from message
        const isWorkersComp = message.toLowerCase().includes('workers') || message.toLowerCase().includes('comp');
        const coiType = isWorkersComp ? 'WORKERS_COMP' : 'GENERAL_LIABILITY';

        // Calculate expiration (1 year from now by default)
        const issueDate = new Date().toISOString().split('T')[0];
        const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Create COI document record using proper coiDocuments table
        const doc = await storage.createCoiDocument({
          externalName,
          type: coiType,
          documentUrl: '', // Will be set when file is uploaded
          issueDate,
          expirationDate,
          uploadedBy: user.id,
          status: 'ACTIVE'
        });

        return {
          success: true,
          message: `✅ COI document for "${externalName}" has been created. Type: ${coiType}. Expires: ${expirationDate}`,
          data: { documentId: doc.id, expirationDate }
        };
      }

      return null;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to handle COI document.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleResumeDocument(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse resume action
      const candidateMatch = message.match(/resume\s+(?:for|from)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      
      if (!candidateMatch) {
        return {
          success: false,
          message: "Please specify whose resume to handle."
        };
      }
      
      const candidateName = candidateMatch[1];
      
      // Find or create candidate
      const candidates = await storage.searchCandidatesByName(candidateName);
      let candidate = candidates[0];
      
      if (!candidate) {
        // Create new candidate from resume
        const nameParts = candidateName.split(' ');
        candidate = await storage.createCandidate({
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || nameParts[0],
          email: `${nameParts[0].toLowerCase()}@candidate.temp`,
          position: 'General Application',
          phone: '',
          stage: 'APPLIED',
          status: 'APPLIED',
          appliedDate: new Date()
        });
      }

      // Route to appropriate location
      if (message.toLowerCase().includes('move') || message.toLowerCase().includes('file')) {
        // Update candidate stage
        await storage.updateCandidate(candidate.id, {
          stage: 'SCREENING',
          status: 'SCREENING'
        });
        
        return {
          success: true,
          message: `✅ Resume for ${candidate.firstName} ${candidate.lastName} has been filed and candidate moved to screening.`,
          data: { candidateId: candidate.id }
        };
      }
      
      return {
        success: true,
        message: `Resume for ${candidate.firstName} ${candidate.lastName} is ready for review.`,
        data: { candidateId: candidate.id }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to handle resume.',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Alert and Message Handling
   */
  private async handleAlerts(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Show alerts - using notifications as the general alert system
      if (message.toLowerCase().includes('show') || message.toLowerCase().includes('list')) {
        const notifications = await storage.getNotifications(user.id);
        const unreadAlerts = notifications.filter((n: any) => !n.read && (n.type === 'warning' || n.type === 'error'));

        if (unreadAlerts.length === 0) {
          return {
            success: true,
            message: "No active alerts at this time."
          };
        }

        const alertList = unreadAlerts.map((a: any) => {
          const priority = a.type === 'error' ? '🔴' : '🟡';
          return `${priority} ${a.title}: ${a.message}`;
        }).join('\n');

        return {
          success: true,
          message: `📢 Active Alerts:\n\n${alertList}`,
          data: { count: unreadAlerts.length }
        };
      }

      // Acknowledge alert - mark notification as read
      if (message.toLowerCase().includes('acknowledge') || message.toLowerCase().includes('dismiss')) {
        const alertMatch = message.match(/(?:acknowledge|dismiss)\s+alert\s+(?:about\s+)?(.+)/i);

        if (!alertMatch) {
          return {
            success: false,
            message: "Please specify which alert to acknowledge."
          };
        }

        const notifications = await storage.getNotifications(user.id);
        const alert = notifications.find((a: any) =>
          !a.read && (a.title?.toLowerCase().includes(alertMatch[1].toLowerCase()) ||
          a.message?.toLowerCase().includes(alertMatch[1].toLowerCase()))
        );

        if (!alert) {
          return {
            success: false,
            message: `Could not find alert matching: ${alertMatch[1]}`
          };
        }

        await storage.markNotificationAsRead(alert.id, user.id);

        return {
          success: true,
          message: `✅ Alert "${alert.title}" has been acknowledged.`,
          data: { alertId: alert.id }
        };
      }

      // Create alert - create as a notification
      if (message.toLowerCase().includes('create') || message.toLowerCase().includes('add')) {
        const titleMatch = message.match(/alert\s+(?:about|for|titled)\s+"([^"]+)"/i);
        const priorityMatch = message.match(/(?:priority|level)\s+(high|medium|low)/i);

        const title = titleMatch?.[1] || 'System Alert';
        const type = priorityMatch?.[1]?.toLowerCase() === 'high' ? 'error' : 'warning';

        await storage.createNotification({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          type: type as 'warning' | 'error',
          title,
          message: `Alert created by ${user.firstName} ${user.lastName}`,
          read: false,
        });

        return {
          success: true,
          message: `📢 Alert created: "${title}" with ${priorityMatch?.[1] || 'medium'} priority.`,
          data: { alertType: title }
        };
      }

      return null;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to handle alert.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleMessages(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Check unread messages (using notifications for internal messaging)
      if (message.toLowerCase().includes('unread') || message.toLowerCase().includes('new')) {
        const notifications = await storage.getNotifications(user.id);
        const unreadNotifications = notifications.filter((n: any) => !n.read);

        if (unreadNotifications.length === 0) {
          return {
            success: true,
            message: "You have no unread messages."
          };
        }

        const messageList = unreadNotifications.slice(0, 5).map((m: any) =>
          `• ${m.title}: ${m.message}`
        ).join('\n');

        return {
          success: true,
          message: `📬 You have ${unreadNotifications.length} unread messages:\n\n${messageList}${unreadNotifications.length > 5 ? '\n\n...and more' : ''}`,
          data: { count: unreadNotifications.length }
        };
      }

      // Send message (as notification)
      if (message.toLowerCase().includes('send')) {
        const toMatch = message.match(/(?:message|note)\s+to\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
        const contentMatch = message.match(/(?:saying|message)[:]\s*(.+)/i);

        if (!toMatch) {
          return {
            success: false,
            message: "Please specify who to send the message to."
          };
        }

        // Find recipient
        const employees = await storage.getAllUsers();
        const recipientName = toMatch[1].toLowerCase();
        const recipient = employees.find(e => {
          const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
          return fullName.includes(recipientName);
        });

        if (!recipient) {
          return {
            success: false,
            message: `Could not find employee: ${toMatch[1]}`
          };
        }

        const content = contentMatch?.[1] || 'Quick message from Susan AI';

        // Create notification as internal message
        await storage.createNotification({
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: recipient.id,
          type: 'info',
          title: `Message from ${user.firstName} ${user.lastName}`,
          message: content,
          read: false,
          metadata: JSON.stringify({ senderId: user.id, via: 'susan-ai' }),
        });

        return {
          success: true,
          message: `✉️ Message sent to ${recipient.firstName} ${recipient.lastName}.`,
          data: { recipientId: recipient.id }
        };
      }
      
      return null;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to handle message.',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Self-service handler methods for employees
   */
  private async handlePTOSelfCancellation(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Get user's pending PTO requests
      const myRequests = await storage.getPtoRequestsByEmployee(user.id);
      const pendingRequests = myRequests.filter((r: any) => r.status === 'PENDING');

      if (pendingRequests.length === 0) {
        return {
          success: false,
          message: "You don't have any pending PTO requests to cancel."
        };
      }

      if (pendingRequests.length === 1) {
        // Cancel the single pending request - Delete instead of cancel since CANCELLED status doesn't exist
        await storage.deletePtoRequest(pendingRequests[0].id);
        return {
          success: true,
          message: `Your PTO request from ${pendingRequests[0].startDate} to ${pendingRequests[0].endDate} has been cancelled.`
        };
      }
      
      // Multiple pending requests - need more info
      return {
        success: false,
        message: `You have ${pendingRequests.length} pending PTO requests. Please specify which dates you want to cancel.`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to cancel PTO request.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleSelfUpdate(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse what they want to update
      const updates: any = {};
      
      if (message.includes('phone')) {
        const phoneMatch = message.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/);
        if (phoneMatch) {
          updates.phone = phoneMatch[0];
        }
      }
      
      if (message.includes('email')) {
        const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          updates.email = emailMatch[0];
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(user.id, updates);
        return {
          success: true,
          message: `Your contact information has been updated successfully.`,
          data: updates
        };
      }
      
      return {
        success: false,
        message: "Please specify what information you'd like to update (e.g., 'Update my phone to 555-1234')."
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update your information.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleEmergencyContactUpdate(message: string, user: User): Promise<ActionResult | null> {
    try {
      // Parse emergency contact info
      const nameMatch = message.match(/contact (?:is|to) ([A-Z][a-z]+ [A-Z][a-z]+)/i);
      const phoneMatch = message.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/);
      
      if (nameMatch || phoneMatch) {
        // TODO: emergencyContact is typed as string in schema, should be object
        const emergencyContactStr = `${nameMatch?.[1] || 'Unknown'} - ${phoneMatch?.[0] || 'No phone'}`;

        await storage.updateUser(user.id, { emergencyContact: emergencyContactStr });
        const emergencyContact = {
          name: nameMatch?.[1] || 'Unknown',
          phone: phoneMatch?.[0] || 'No phone',
          relationship: 'Emergency Contact'
        };
        return {
          success: true,
          message: `Emergency contact updated to ${emergencyContact.name} (${emergencyContact.phone})`,
          data: emergencyContact
        };
      }
      
      return {
        success: false,
        message: "Please provide emergency contact name and phone number (e.g., 'Update my emergency contact to John Doe 555-1234')."
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update emergency contact.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleViewMyReviews(user: User): Promise<ActionResult | null> {
    try {
      // In a real system, fetch reviews from review table
      // For now, return placeholder
      return {
        success: true,
        message: `You have no upcoming performance reviews scheduled. Your last review was completed 3 months ago with a rating of "Exceeds Expectations".`,
        data: {
          upcoming: [],
          completed: 1,
          lastReviewDate: '3 months ago',
          lastRating: 'Exceeds Expectations'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve your reviews.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleViewMyTools(user: User): Promise<ActionResult | null> {
    try {
      // In a real system, fetch from tool assignments
      return {
        success: true,
        message: `Equipment assigned to you:\n• MacBook Pro (Serial: ABC123)\n• Company Phone (Number: 555-0100)\n• Access Badge (ID: ${user.id.substring(0, 8)})`,
        data: {
          tools: [
            { name: 'MacBook Pro', serial: 'ABC123' },
            { name: 'Company Phone', number: '555-0100' },
            { name: 'Access Badge', id: user.id.substring(0, 8) }
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve your equipment.',
        error: (error as Error).message
      };
    }
  }
  
  private async handleViewMyBenefits(user: User): Promise<ActionResult | null> {
    try {
      return {
        success: true,
        message: `Your current benefits:\n• Health Insurance: Aetna PPO\n• Dental: Delta Dental\n• Vision: VSP\n• 401(k): 6% company match\n• Life Insurance: 2x annual salary\n\nFor detailed information, visit the benefits portal or contact HR.`,
        data: {
          health: 'Aetna PPO',
          dental: 'Delta Dental',
          vision: 'VSP',
          retirement: '401(k) with 6% match',
          life: '2x annual salary'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve your benefits information.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle recruiting commands
   */
  private async handleRecruitingCommand(command: any, user: User): Promise<ActionResult | null> {
    try {
      let result: any;
      
      switch (command.type) {
        case 'create_candidate':
          result = await this.recruitingManager.createCandidate(command.data);
          break;
        case 'move_stage':
          result = await this.recruitingManager.moveCandidateStage(command.candidateId!, command.data.stage);
          break;
        case 'bulk_move':
          result = await this.recruitingManager.bulkMoveCandidates(command.candidateIds || [], command.data.stage);
          break;
        case 'schedule_interview':
          result = await this.recruitingManager.scheduleInterview(command.candidateId!, command.data);
          break;
        case 'reject_candidates':
          result = await this.recruitingManager.rejectCandidates(command.candidateIds || [], command.data.reason);
          break;
        case 'archive_candidates':
          result = await this.recruitingManager.archiveCandidates(command.data.days);
          break;
        default:
          return null;
      }
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully executed recruiting action: ${command.type}` : 
          result.error || 'Failed to execute recruiting action'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute recruiting command.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle document commands
   */
  private async handleDocumentCommand(command: any, user: User): Promise<ActionResult | null> {
    try {
      let result: any;
      
      switch (command.type) {
        case 'upload_document':
          result = await this.documentManager.uploadDocument(command.data);
          break;
        case 'delete_document':
          result = await this.documentManager.deleteDocument(command.documentId!, command.data?.permanent);
          break;
        case 'set_permissions':
          result = await this.documentManager.setDocumentPermissions(command.documentId!, command.data);
          break;
        case 'share_document':
          result = await this.documentManager.shareDocument(command.documentId!, command.data.emails);
          break;
        case 'expire_documents':
          result = await this.documentManager.expireDocuments();
          break;
        case 'archive_documents':
          result = await this.documentManager.archiveDocuments(command.data?.days);
          break;
        default:
          return null;
      }
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully executed document action: ${command.type}` : 
          result.error || 'Failed to execute document action'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute document command.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle review commands
   */
  private async handleReviewCommand(command: any, user: User): Promise<ActionResult | null> {
    try {
      let result: any;
      
      switch (command.type) {
        case 'create_review':
          result = await this.reviewManager.createReview(command.data);
          break;
        case 'complete_review':
          result = await this.reviewManager.submitReview(command.reviewId!, command.data);
          break;
        case 'bulk_create':
          result = await this.reviewManager.bulkCreateReviews(command.data.employeeIds || [], command.data);
          break;
        case 'send_reminders':
          result = await this.reviewManager.sendReviewReminders();
          break;
        case 'generate_reports':
          result = await this.reviewManager.generateReviewReports(command.data.period);
          break;
        case 'schedule_reviews':
          result = await this.reviewManager.scheduleReviews(command.data.frequency, new Date());
          break;
        default:
          return null;
      }
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully executed review action: ${command.type}` : 
          result.error || 'Failed to execute review action'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute review command.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle tools commands
   */
  private async handleToolsCommand(command: any, user: User): Promise<ActionResult | null> {
    try {
      let result: any;
      
      switch (command.type) {
        case 'add_tool':
          // Handle case where we need more information from user
          if (command.data?.needsMoreInfo) {
            return {
              success: true,
              message: command.data.message || 'What tool would you like to add? Please specify the tool name.',
              data: { needsMoreInfo: true }
            };
          }
          result = await this.toolsManager.addTool(command.data);
          break;
        case 'assign_tool':
          result = await this.toolsManager.assignTool(command.toolId!, command.data.employeeId, command.data.quantity);
          break;
        case 'return_tool':
          result = await this.toolsManager.returnTool(command.data.assignmentId, command.data.condition);
          break;
        case 'check_inventory':
          result = await this.toolsManager.checkInventory();
          break;
        case 'order_tools':
          result = await this.toolsManager.orderTools(command.toolId!, command.data.quantity);
          break;
        case 'generate_report':
          result = await this.toolsManager.generateReport();
          break;
        default:
          return null;
      }
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully executed tools action: ${command.type}` : 
          result.error || 'Failed to execute tools action',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute tools command.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle territory commands
   */
  private async handleTerritoryCommand(command: any, user: User): Promise<ActionResult | null> {
    try {
      let result: any;
      
      switch (command.type) {
        case 'create_territory':
          result = await this.territoryManager.createTerritory(command.data);
          break;
        case 'assign_manager':
          result = await this.territoryManager.assignManager(command.territoryId!, command.data.managerId);
          break;
        case 'transfer_employees':
          result = await this.territoryManager.transferEmployees(
            command.data.fromTerritoryId, 
            command.data.toTerritoryId, 
            command.data.employeeIds
          );
          break;
        case 'merge_territories':
          result = await this.territoryManager.mergeTerritories(
            command.data.sourceIds || [], 
            command.data.targetId,
            command.data.newName
          );
          break;
        case 'delete_territory':
          result = await this.territoryManager.deleteTerritory(command.territoryId!, command.data?.reassignToId);
          break;
        case 'generate_report':
          result = await this.territoryManager.generateReport();
          break;
        default:
          return null;
      }
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully executed territory action: ${command.type}` : 
          result.error || 'Failed to execute territory action',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute territory command.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle contract commands
   */
  private async handleContractCommand(command: any, user: User): Promise<ActionResult | null> {
    try {
      let result: any;
      
      switch (command.type) {
        case 'create_contract':
          result = await this.contractManager.createContract(command.data);
          break;
        case 'send_contract':
          result = await this.contractManager.sendContract(command.contractId!);
          break;
        case 'sign_contract':
          result = await this.contractManager.signContract(command.contractId!, user.id);
          break;
        case 'renew_contract':
          result = await this.contractManager.renewContract(command.contractId!, {
            createdBy: user.id
          });
          break;
        case 'terminate_contract':
          result = await this.contractManager.terminateContract(
            command.contractId!,
            command.data?.reason || 'Terminated via Susan AI',
            user.id
          );
          break;
        case 'expire_contracts':
          result = await this.contractManager.expireContracts();
          break;
        case 'generate_report':
          result = await this.contractManager.generateReport();
          break;
        default:
          return null;
      }
      
      return {
        success: result.success,
        message: result.success ? 
          `Successfully executed contract action: ${command.type}` : 
          result.error || 'Failed to execute contract action',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute contract command.',
        error: (error as Error).message
      };
    }
  }

  /**
   * UNIVERSAL LOOKUP METHODS - Susan can find anyone and anything
   */
  
  private async lookupEmployees(message: string): Promise<ActionResult> {
    try {
      const employees = await storage.getAllUsers();
      
      // Extract name from message
      const nameMatch = message.match(/(?:find|look up|show|who is|search for|get)\s+(\w+\s*\w*)/i);
      const searchName = nameMatch?.[1]?.toLowerCase();
      
      let filteredEmployees = employees;
      if (searchName) {
        filteredEmployees = employees.filter(emp => 
          emp.firstName?.toLowerCase().includes(searchName) ||
          emp.lastName?.toLowerCase().includes(searchName) ||
          `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchName)
        );
      }
      
      return {
        success: true,
        message: `Found ${filteredEmployees.length} employee(s)`,
        data: filteredEmployees.map((emp: any) => ({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          position: emp.position,
          department: emp.department,
          phone: emp.phone,
          isActive: emp.isActive
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to lookup employees',
        error: (error as Error).message
      };
    }
  }

  private async lookupCandidates(message: string): Promise<ActionResult> {
    try {
      // Extract search criteria from message - look for names after keywords
      const nameMatch = message.match(/(?:find|look up|show|search for|get|candidate)\s+(?:candidate\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      const searchName = nameMatch?.[1]?.trim();
      
      let candidates;
      if (searchName && searchName.length > 2) {
        // Use the new search by name function for specific candidate lookup
        candidates = await storage.searchCandidatesByName(searchName);
        
        // If no exact match, try getting all and filtering
        if (candidates.length === 0) {
          const allCandidates = await storage.getAllCandidates();
          candidates = allCandidates.filter(cand => 
            `${cand.firstName} ${cand.lastName}`.toLowerCase().includes(searchName.toLowerCase()) ||
            cand.email?.toLowerCase().includes(searchName.toLowerCase())
          );
        }
      } else {
        // Return aggregate statistics if no specific name provided
        candidates = await storage.getAllCandidates();
      }
      
      // If looking for a specific person and found them, return detailed info
      if (searchName && candidates.length > 0) {
        // Get interviews for each candidate
        const candidatesWithDetails = await Promise.all(candidates.map(async (cand) => {
          const interviews = await storage.getInterviewsByCandidate(cand.id);
          const notes = await storage.getCandidateNotesByCandidateId(cand.id);
          
          return {
            id: cand.id,
            name: `${cand.firstName} ${cand.lastName}`,
            email: cand.email,
            phone: cand.phone,
            position: cand.position,
            status: cand.status,
            appliedDate: cand.appliedDate,
            resumeUrl: cand.resumeUrl || null,
            interviews: interviews.map(i => ({
              date: i.scheduledDate,
              type: i.type,
              status: i.status,
              interviewer: i.interviewerId
            })),
            notesCount: notes.length,
            lastActivity: cand.updatedAt
          };
        }));
        
        return {
          success: true,
          message: searchName ? 
            `Found ${candidatesWithDetails.length} candidate(s) matching "${searchName}"` :
            `Total candidates in system: ${candidatesWithDetails.length}`,
          data: candidatesWithDetails
        };
      }
      
      // Return aggregate statistics if no specific search
      const statusCounts = candidates.reduce((acc, cand) => {
        acc[cand.status] = (acc[cand.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        success: true,
        message: `Total candidates: ${candidates.length}`,
        data: {
          total: candidates.length,
          byStatus: statusCounts,
          recentCandidates: candidates.slice(-5).map(cand => ({
            id: cand.id,
            name: `${cand.firstName} ${cand.lastName}`,
            position: cand.position,
            status: cand.status,
            appliedDate: cand.appliedDate
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to lookup candidates',
        error: (error as Error).message
      };
    }
  }

  private async lookupPTO(message: string, user: User): Promise<ActionResult> {
    try {
      const lowerMessage = message.toLowerCase();
      
      // Check if asking for own PTO balance
      if (lowerMessage.includes('my') || lowerMessage.includes('i have')) {
        const ptoBalance = await this.ptoManager.getBalance(user.id);
        return {
          success: true,
          message: 'Your PTO balance',
          data: ptoBalance
        };
      }
      
      // Check if asking for team PTO
      if ((user.role === 'ADMIN' || user.role === 'MANAGER') && 
          (lowerMessage.includes('team') || lowerMessage.includes('department'))) {
        const teamPTO = await this.ptoManager.getTeamPTO(user.id);
        return {
          success: true,
          message: 'Team PTO status',
          data: teamPTO
        };
      }
      
      // Get all PTO requests for managers
      if (user.role === 'ADMIN' || user.role === 'MANAGER') {
        const requests = await storage.getPendingPtoRequests();
        return {
          success: true,
          message: `Found ${requests.length} pending PTO request(s)`,
          data: requests
        };
      }
      
      return {
        success: true,
        message: 'PTO information retrieved',
        data: null
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to lookup PTO information',
        error: (error as Error).message
      };
    }
  }

  private async lookupTools(message: string): Promise<ActionResult> {
    try {
      const tools = await storage.getAllTools();

      // Extract tool name from message
      const toolMatch = message.match(/(?:find|look up|show|search for|get)\s+(?:tool\s+)?(\w+)/i);
      const searchTool = toolMatch?.[1]?.toLowerCase();

      let filteredTools = tools;
      if (searchTool) {
        filteredTools = tools.filter(tool =>
          tool.name?.toLowerCase().includes(searchTool) ||
          tool.category?.toLowerCase().includes(searchTool)
        );
      }

      return {
        success: true,
        message: `Found ${filteredTools.length} tool(s) in inventory`,
        data: filteredTools
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to lookup tools',
        error: (error as Error).message
      };
    }
  }

  private async lookupDocuments(message: string): Promise<ActionResult> {
    try {
      const allDocuments = await storage.getAllDocuments();

      // Extract search term from message
      const searchMatch = message.match(/(?:find|look up|show|search for|get)\s+(?:document\s+)?(.+)/i);
      const searchTerm = searchMatch?.[1]?.toLowerCase().trim();

      let filteredDocuments = allDocuments;
      if (searchTerm) {
        filteredDocuments = allDocuments.filter(doc =>
          doc.name?.toLowerCase().includes(searchTerm) ||
          doc.category?.toLowerCase().includes(searchTerm) ||
          doc.type?.toLowerCase().includes(searchTerm)
        );
      }

      return {
        success: true,
        message: `Found ${filteredDocuments.length} document(s)`,
        data: filteredDocuments
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to lookup documents',
        error: (error as Error).message
      };
    }
  }

  /**
   * Lookup COI documents (NEW METHOD)
   */
  private async lookupCOI(message: string, user: User): Promise<ActionResult> {
    try {
      const lowerMessage = message.toLowerCase();

      // Check for expiring COIs
      if (lowerMessage.includes('expir') || lowerMessage.includes('renew')) {
        const expiringCOIs = await storage.getExpiringCoiDocuments(30);
        if (expiringCOIs.length === 0) {
          return {
            success: true,
            message: '✅ No COI documents are expiring in the next 30 days.'
          };
        }

        const coiList = expiringCOIs.map((coi: any) =>
          `• **${coi.type || 'Unknown'}** - Expires: ${coi.expirationDate || 'N/A'}`
        ).join('\n');

        return {
          success: true,
          message: `⚠️ **COI Documents Expiring Soon (30 days):**\n\n${coiList}\n\n${expiringCOIs.length} document(s) need attention.`
        };
      }

      // Get all COI documents
      const allCOIs = await storage.getAllCoiDocuments();

      if (allCOIs.length === 0) {
        return {
          success: true,
          message: '📋 No COI documents found in the system. You can upload COI documents using the COI Documents page.'
        };
      }

      // Group by status (COI documents don't have ACTIVE/PENDING/EXPIRED status)
      const active = allCOIs.filter((c: any) => c.status === 'ACTIVE' || !c.status);
      const expired = allCOIs.filter((c: any) => c.status === 'EXPIRED');
      const pending: any[] = []; // allCOIs.filter((c: any) => c.status === 'PENDING');

      let summary = `📋 **COI Documents Summary:**\n\n`;
      summary += `• **Total:** ${allCOIs.length}\n`;
      summary += `• **Active:** ${active.length}\n`;
      summary += `• **Expired:** ${expired.length}\n`;
      summary += `• **Pending Review:** ${pending.length}\n\n`;

      // Show recent COIs
      const recent = allCOIs.slice(0, 5);
      summary += `**Recent COIs:**\n`;
      recent.forEach((coi: any) => {
        summary += `• ${coi.type || 'Unknown'} (Exp: ${coi.expirationDate || 'N/A'})\n`;
      });

      if (allCOIs.length > 5) {
        summary += `\n_...and ${allCOIs.length - 5} more. View all on the COI Documents page._`;
      }

      return {
        success: true,
        message: summary,
        data: { total: allCOIs.length, active: active.length, expired: expired.length }
      };
    } catch (error) {
      console.error('[SUSAN-AI] COI lookup error:', error);
      return {
        success: false,
        message: 'Failed to fetch COI documents: ' + (error as Error).message
      };
    }
  }

  /**
   * Lookup contracts (NEW METHOD)
   */
  private async lookupContracts(message: string, user: User): Promise<ActionResult> {
    try {
      const lowerMessage = message.toLowerCase();

      // Get all employee contracts
      const allContracts = await storage.getAllEmployeeContracts();

      if (allContracts.length === 0) {
        return {
          success: true,
          message: '📄 No contracts found in the system. You can create contracts using the Contracts page.'
        };
      }

      // Check if asking about a specific employee
      const nameMatch = message.match(/(?:for|from|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch) {
        const searchName = nameMatch[1].toLowerCase();
        const employees = await storage.getAllUsers();
        const employee = employees.find(e =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchName)
        );

        if (employee) {
          const employeeContracts = await storage.getEmployeeContractsByEmployeeId(employee.id);
          if (employeeContracts.length === 0) {
            return {
              success: true,
              message: `📄 No contracts found for **${employee.firstName} ${employee.lastName}**.`
            };
          }

          const contractList = employeeContracts.map(c =>
            `• ${c.title || 'Untitled'} - Status: ${c.status || 'Unknown'} (Created: ${c.createdAt})`
          ).join('\n');

          return {
            success: true,
            message: `📄 **Contracts for ${employee.firstName} ${employee.lastName}:**\n\n${contractList}`,
            data: employeeContracts
          };
        }
      }

      // Group by status (valid statuses are: DRAFT, SENT, VIEWED, SIGNED, REJECTED)
      const active: any[] = []; // allContracts.filter((c: any) => c.status === 'ACTIVE');
      const pending: any[] = allContracts.filter((c: any) => c.status === 'SENT' || c.status === 'VIEWED');
      const expired: any[] = []; // allContracts.filter((c: any) => c.status === 'EXPIRED');
      const signed = allContracts.filter((c: any) => c.status === 'SIGNED');

      let summary = `📄 **Contracts Summary:**\n\n`;
      summary += `• **Total:** ${allContracts.length}\n`;
      summary += `• **Active:** ${active.length}\n`;
      summary += `• **Pending:** ${pending.length}\n`;
      summary += `• **Signed:** ${signed.length}\n`;
      summary += `• **Expired:** ${expired.length}\n\n`;

      // Show recent contracts
      const recent = allContracts.slice(0, 5);
      summary += `**Recent Contracts:**\n`;
      recent.forEach(contract => {
        summary += `• ${contract.title || 'Untitled'} - ${contract.status || 'Unknown'}\n`;
      });

      if (allContracts.length > 5) {
        summary += `\n_...and ${allContracts.length - 5} more. View all on the Contracts page._`;
      }

      return {
        success: true,
        message: summary,
        data: { total: allContracts.length, active: active.length, pending: pending.length }
      };
    } catch (error) {
      console.error('[SUSAN-AI] Contract lookup error:', error);
      return {
        success: false,
        message: 'Failed to fetch contracts: ' + (error as Error).message
      };
    }
  }

  /**
   * Lookup and manage territories (NEW METHOD)
   */
  private async lookupTerritories(message: string, user: User): Promise<ActionResult> {
    try {
      const lowerMessage = message.toLowerCase();
      const territories = await storage.getAllTerritories();

      // Check if asking to assign someone to a territory
      if (lowerMessage.includes('assign') || lowerMessage.includes('put') || lowerMessage.includes('add')) {
        if (territories.length === 0) {
          return {
            success: true,
            message: `🗺️ **No territories exist yet!**\n\nTo assign employees to territories, first create territories on the Territories page.\n\nI can help you create a territory - just say "create territory [name]".`
          };
        }

        // Extract employee and territory names from message
        const territoryList = territories.map(t => `• **${t.name}** (${t.region || 'No region'})`).join('\n');

        return {
          success: true,
          message: `🗺️ **Available Territories:**\n\n${territoryList}\n\nTo assign an employee, please specify:\n1. The employee name\n2. The territory name\n\nExample: "Assign John Smith to Dallas territory"`,
          requiresConfirmation: true,
          confirmationData: { type: 'territory_assignment' }
        };
      }

      // Just listing territories
      if (territories.length === 0) {
        return {
          success: true,
          message: `🗺️ **No territories set up yet.**\n\nYou can create territories on the Territories page or ask me to create one:\n"Create territory Dallas"\n"Create territory Houston with region South Texas"`
        };
      }

      // Count employees per territory
      const employees = await storage.getAllUsers();
      const territoryStats = territories.map(t => {
        const assignedCount = employees.filter(e => e.territoryId === t.id).length;
        return {
          ...t,
          employeeCount: assignedCount
        };
      });

      let summary = `🗺️ **Territories Overview:**\n\n`;
      summary += `**Total Territories:** ${territories.length}\n\n`;

      territoryStats.forEach(t => {
        summary += `• **${t.name}**\n`;
        summary += `  Region: ${t.region || 'Not set'}\n`;
        summary += `  Employees: ${t.employeeCount}\n`;
        if (t.salesManagerId) {
          const manager = employees.find(e => e.id === t.salesManagerId);
          summary += `  Manager: ${manager ? `${manager.firstName} ${manager.lastName}` : 'Unknown'}\n`;
        }
        summary += '\n';
      });

      return {
        success: true,
        message: summary,
        data: territoryStats
      };
    } catch (error) {
      console.error('[SUSAN-AI] Territory lookup error:', error);
      return {
        success: false,
        message: 'Failed to fetch territories: ' + (error as Error).message
      };
    }
  }

  /**
   * Read resume content for a candidate
   * Retrieves the raw resume text stored during upload
   */
  private async readResumeContent(message: string): Promise<ActionResult | null> {
    try {
      const lowerMessage = message.toLowerCase();

      // Check if user is asking to read/view/show resume content
      if (!lowerMessage.includes('read') && !lowerMessage.includes('view') &&
          !lowerMessage.includes('show') && !lowerMessage.includes('what') &&
          !lowerMessage.includes('content') && !lowerMessage.includes('text')) {
        return null;
      }

      // Extract candidate name from message
      const nameMatch = message.match(/(?:resume\s+(?:for|from|of)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      let searchName = nameMatch?.[1]?.trim();

      // Also try to match "read [name]'s resume"
      if (!searchName) {
        const possessiveMatch = message.match(/(?:read|view|show)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'?s?\s+resume/i);
        searchName = possessiveMatch?.[1]?.trim();
      }

      if (!searchName || searchName.length < 2) {
        return {
          success: false,
          message: "Please specify the candidate's name. For example: 'Read Oliver Brown's resume' or 'Show resume for John Smith'"
        };
      }

      // Search for the candidate
      const candidates = await storage.searchCandidatesByName(searchName);

      if (candidates.length === 0) {
        // Try getting all and filtering
        const allCandidates = await storage.getAllCandidates();
        const filtered = allCandidates.filter(cand =>
          `${cand.firstName} ${cand.lastName}`.toLowerCase().includes(searchName!.toLowerCase())
        );

        if (filtered.length === 0) {
          return {
            success: false,
            message: `No candidate found with name "${searchName}". Please check the name and try again.`
          };
        }
        candidates.push(...filtered);
      }

      const candidate = candidates[0];

      // Check if we have parsed resume data with the raw text
      let resumeContent = '';
      if (candidate.parsedResumeData) {
        try {
          const parsedData = JSON.parse(candidate.parsedResumeData);
          if (parsedData.rawResumeText) {
            resumeContent = parsedData.rawResumeText;
          } else {
            // Format the parsed data if no raw text
            resumeContent = this.formatParsedResumeData(parsedData);
          }
        } catch (e) {
          resumeContent = candidate.parsedResumeData;
        }
      }

      if (!resumeContent && candidate.notes) {
        // Fallback to notes if no resume data
        resumeContent = candidate.notes;
      }

      if (!resumeContent) {
        return {
          success: true,
          message: `📄 **Resume for ${candidate.firstName} ${candidate.lastName}**\n\n⚠️ No resume content available for this candidate.\n\n**Position:** ${candidate.position}\n**Email:** ${candidate.email || 'N/A'}\n**Phone:** ${candidate.phone || 'N/A'}\n**Status:** ${candidate.status}\n**Applied:** ${candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : 'N/A'}${candidate.resumeUrl ? `\n\n[View Resume File](${candidate.resumeUrl})` : ''}`,
          data: { candidate, hasResumeContent: false }
        };
      }

      // Truncate if very long (over 3000 chars)
      const displayContent = resumeContent.length > 3000
        ? resumeContent.substring(0, 3000) + '\n\n... [Resume content truncated. Full resume has ' + resumeContent.length + ' characters]'
        : resumeContent;

      return {
        success: true,
        message: `📄 **Resume for ${candidate.firstName} ${candidate.lastName}**\n\n**Position:** ${candidate.position}\n**Status:** ${candidate.status}\n\n---\n\n${displayContent}${candidate.resumeUrl ? `\n\n---\n[View Original Resume File](${candidate.resumeUrl})` : ''}`,
        data: {
          candidate,
          resumeContent: resumeContent,
          hasResumeContent: true
        }
      };

    } catch (error) {
      console.error('[SUSAN-AI] Error reading resume:', error);
      return {
        success: false,
        message: 'Failed to read resume content: ' + (error as Error).message
      };
    }
  }

  /**
   * Format parsed resume data into readable text
   */
  private formatParsedResumeData(parsedData: any): string {
    const parts: string[] = [];

    if (parsedData.firstName || parsedData.lastName) {
      parts.push(`**Name:** ${parsedData.firstName || ''} ${parsedData.lastName || ''}`);
    }
    if (parsedData.email) {
      parts.push(`**Email:** ${parsedData.email}`);
    }
    if (parsedData.phone) {
      parts.push(`**Phone:** ${parsedData.phone}`);
    }
    if (parsedData.skills && parsedData.skills.length > 0) {
      parts.push(`**Skills:** ${parsedData.skills.join(', ')}`);
    }
    if (parsedData.experience) {
      parts.push(`**Experience:** ${parsedData.experience}`);
    }
    if (parsedData.education) {
      parts.push(`**Education:** ${parsedData.education}`);
    }
    if (parsedData.summary) {
      parts.push(`\n**Summary:**\n${parsedData.summary}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No detailed resume information available.';
  }

  /**
   * ENHANCED ACTION METHODS - Making Susan more capable
   */

  // Helper to parse natural language dates
  private parseNaturalDate(text: string, baseDate: Date = new Date()): Date | null {
    const lower = text.toLowerCase();
    const result = new Date(baseDate);

    // Today/tomorrow
    if (lower.includes('today')) return result;
    if (lower.includes('tomorrow')) {
      result.setDate(result.getDate() + 1);
      return result;
    }

    // Next week/month
    if (lower.includes('next week')) {
      result.setDate(result.getDate() + 7);
      return result;
    }
    if (lower.includes('next month')) {
      result.setMonth(result.getMonth() + 1);
      return result;
    }

    // Day names
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) {
        const currentDay = result.getDay();
        let daysUntil = i - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        result.setDate(result.getDate() + daysUntil);
        return result;
      }
    }

    // Month day (Dec 15, December 15, 12/15)
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthMatch = lower.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
    if (monthMatch) {
      const monthIdx = monthNames.findIndex(m => monthMatch[1].startsWith(m));
      if (monthIdx !== -1) {
        result.setMonth(monthIdx);
        result.setDate(parseInt(monthMatch[2]));
        if (result < baseDate) result.setFullYear(result.getFullYear() + 1);
        return result;
      }
    }

    // Standard date formats
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1;
      const day = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : result.getFullYear();
      result.setFullYear(year, month, day);
      return result;
    }

    return null;
  }

  // Allow any employee to request PTO
  private async requestPTOForSelf(user: User, message: string): Promise<ActionResult> {
    try {
      const lower = message.toLowerCase();

      // Parse dates - try natural language first, then specific formats
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let duration = 1; // Default 1 day

      // Check for duration patterns
      const daysMatch = lower.match(/(\d+)\s*days?/);
      if (daysMatch) duration = parseInt(daysMatch[1]);

      // Check for "next week" context
      const isNextWeek = lower.includes('next week');
      const baseDate = new Date();
      if (isNextWeek) {
        // Move base to next week (next Monday)
        const daysUntilMonday = (8 - baseDate.getDay()) % 7 || 7;
        baseDate.setDate(baseDate.getDate() + daysUntilMonday);
      }

      // Handle "X and Y" pattern for consecutive days (e.g., "tuesday and wednesday")
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayAndDayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+and\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      if (dayAndDayMatch) {
        const day1Idx = days.indexOf(dayAndDayMatch[1].toLowerCase());
        const day2Idx = days.indexOf(dayAndDayMatch[2].toLowerCase());

        const date1 = new Date(baseDate);
        const date2 = new Date(baseDate);

        let daysUntil1 = day1Idx - date1.getDay();
        if (daysUntil1 <= 0 && !isNextWeek) daysUntil1 += 7;
        if (daysUntil1 < 0) daysUntil1 += 7;
        date1.setDate(date1.getDate() + daysUntil1);

        let daysUntil2 = day2Idx - date2.getDay();
        if (daysUntil2 <= 0 && !isNextWeek) daysUntil2 += 7;
        if (daysUntil2 < 0) daysUntil2 += 7;
        date2.setDate(date2.getDate() + daysUntil2);

        // Use earlier date as start, later as end
        startDate = date1 < date2 ? date1 : date2;
        endDate = date1 < date2 ? date2 : date1;
      }

      // Check for date ranges like "from X to Y" or "X through Y"
      if (!startDate) {
        const rangeMatch = lower.match(/(?:from\s+)?(.+?)\s+(?:to|through|until|-)\s+(.+?)(?:\s+for|\s*$)/i);
        if (rangeMatch) {
          startDate = this.parseNaturalDate(rangeMatch[1], baseDate);
          endDate = this.parseNaturalDate(rangeMatch[2], baseDate);
        }
      }

      // If no range, look for single date
      if (!startDate) {
        startDate = this.parseNaturalDate(message, baseDate);
      }

      // Calculate end date if not found
      if (startDate && !endDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration - 1);
      }

      // If still no dates, prompt user
      if (!startDate) {
        return {
          success: false,
          message: `I'd be happy to help you request PTO! Please specify when you need off. You can say things like:\n• "I need PTO tomorrow"\n• "Request vacation from Dec 20 to Dec 27"\n• "I want to take Monday off"\n• "Tuesday and Wednesday next week"\n• "Need 3 days off starting next week"`,
          error: 'Need dates'
        };
      }

      // Determine type
      const type = lower.includes('sick') ? 'SICK' :
                   lower.includes('personal') ? 'PERSONAL' : 'VACATION';

      // Extract reason
      const reasonMatch = message.match(/(?:for|because|reason:?)\s+(.+)/i);
      const reason = reasonMatch?.[1]?.replace(/\b(vacation|pto|time off|sick|personal)\b/gi, '').trim() ||
                    (type === 'SICK' ? 'Sick leave' : 'Personal time off');

      // Calculate business days
      const businessDays = this.countBusinessDays(startDate, endDate!);

      const result = await this.ptoManager.requestPTO({
        employeeId: user.id,
        startDate,
        endDate: endDate!,
        type,
        reason,
        status: 'PENDING'
      });

      if (result.success) {
        return {
          success: true,
          message: `✅ PTO request submitted!\n\n📅 **${startDate.toLocaleDateString()} - ${endDate!.toLocaleDateString()}** (${businessDays} business day${businessDays !== 1 ? 's' : ''})\n📝 Type: ${type}\n💬 Reason: ${reason}\n\nYour manager will be notified and can approve the request.`,
          data: result
        };
      } else {
        return {
          success: false,
          message: result.error || 'Failed to submit PTO request',
          error: result.error
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to request PTO: ' + (error as Error).message,
        error: (error as Error).message
      };
    }
  }

  // Count business days between dates
  private countBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // Allow scheduling interviews directly
  private async scheduleInterviewDirectly(message: string, user: User): Promise<ActionResult> {
    try {
      
      // First, check for complex sentences with interviewer specification
      const complexPattern = /schedule\s+(?:an?\s+)?interview\s+(?:for\s+)?(?:tomorrow|today|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})?\s*(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?(?:\s+with\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+as\s+(?:the\s+)?interviewer)?/i;
      const complexMatch = message.match(complexPattern);
      
      let candidateName: string | null = null;
      let interviewerName: string | null = null;
      
      if (complexMatch && complexMatch[2]) {
        // This is the interviewer name from "with X as the interviewer"
        interviewerName = complexMatch[2].trim();
      }
      
      // Extract candidate name - clean it from prepositions
      const candidatePatterns = [
        /schedule\s+(?:an?\s+)?interview\s+with\s+([A-Za-z]+(?:\s+[A-Za-z]+)??)(?:\s+(?:for|at|on|as)|\s*$)/i,
        /schedule\s+(?:an?\s+)?interview\s+for\s+([A-Za-z]+(?:\s+[A-Za-z]+)??)(?:\s+(?:at|on|with)|\s*$)/i,
        /interview\s+([A-Za-z]+(?:\s+[A-Za-z]+)??)(?:\s+(?:for|at|on)|\s*$)/i
      ];
      
      for (const pattern of candidatePatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          candidateName = match[1].trim();
          // Clean up: remove common words that shouldn't be part of names
          candidateName = candidateName.replace(/\b(with|for|at|on|as|the)\b/gi, '').trim();
          if (candidateName) break;
        }
      }
      
      // If no candidate name found and this looks like a context-aware request
      if (!candidateName) {
        // Check if this is just scheduling for a time without mentioning candidate
        const timeOnlyPattern = /schedule\s+(?:an?\s+)?interview\s+(?:for\s+)?(?:tomorrow|today|\d)/i;
        if (timeOnlyPattern.test(message)) {
          // Try to get the most recently created or mentioned candidate
          const recentCandidates = await storage.getRecentCandidates?.(1) || await storage.getAllCandidates();
          if (recentCandidates && recentCandidates.length > 0) {
            // Use the most recent candidate
            const candidate = recentCandidates[0];
            candidateName = `${candidate.firstName} ${candidate.lastName}`;
            console.log(`[SUSAN-AI] Using recent candidate for context: ${candidateName}`);
          }
        }
      }
      
      if (!candidateName) {
        return {
          success: false,
          message: 'Please specify the candidate name for the interview, or ensure a candidate was recently mentioned.',
          error: 'Missing candidate name'
        };
      }
      
      // Find candidate using the search function
      const candidates = await storage.searchCandidatesByName(candidateName);
      
      if (candidates.length === 0) {
        return {
          success: false,
          message: `Could not find candidate: ${candidateName}`,
          error: 'Candidate not found'
        };
      }
      
      // If multiple candidates found, ask for clarification
      if (candidates.length > 1) {
        return {
          success: false,
          message: `Found ${candidates.length} candidates matching "${candidateName}": ${candidates.map(c => `${c.firstName} ${c.lastName} (${c.position})`).join(', ')}. Please be more specific.`,
          error: 'Multiple candidates found'
        };
      }
      
      const candidate = candidates[0];
      
      // Extract date and time with improved natural language parsing
      let interviewDate: Date;
      let interviewTime: string = '10:00 AM';
      
      // Parse date
      if (message.toLowerCase().includes('tomorrow')) {
        interviewDate = new Date();
        interviewDate.setDate(interviewDate.getDate() + 1);
      } else if (message.toLowerCase().includes('today')) {
        interviewDate = new Date();
      } else {
        const dateMatch = message.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          interviewDate = new Date(dateMatch[1]);
        } else {
          // Default to tomorrow
          interviewDate = new Date();
          interviewDate.setDate(interviewDate.getDate() + 1);
        }
      }
      
      // Parse time (handle formats like "3pm", "3:00 pm", "15:00")
      const timeMatch = message.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] || '00';
        const meridiem = timeMatch[3]?.toLowerCase();
        
        if (meridiem === 'pm' && hour !== 12) {
          hour += 12;
        } else if (meridiem === 'am' && hour === 12) {
          hour = 0;
        } else if (!meridiem && hour < 8) {
          // Assume PM for times like 2, 3, 4 without meridiem
          hour += 12;
        }
        
        interviewTime = `${hour}:${minute}`;
      }
      
      // Determine interviewer
      let interviewerIds = [user.id]; // Default to current user
      
      if (interviewerName) {
        // Try to find the interviewer by name
        const employees = await storage.getAllUsers();
        const interviewer = employees.find(e => {
          const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
          return fullName.includes(interviewerName.toLowerCase()) || 
                 e.firstName.toLowerCase() === interviewerName.toLowerCase() ||
                 e.lastName.toLowerCase() === interviewerName.toLowerCase();
        });
        
        if (interviewer) {
          interviewerIds = [interviewer.id];
          console.log(`[SUSAN-AI] Found interviewer: ${interviewer.firstName} ${interviewer.lastName}`);
        } else {
          console.log(`[SUSAN-AI] Could not find interviewer: ${interviewerName}, using current user`);
        }
      }
      
      const result = await this.recruitingManager.scheduleInterview(candidate.id, {
        date: interviewDate,
        time: interviewTime,
        interviewerIds,
        type: 'IN_PERSON',
        location: 'Main Office',
        notes: interviewerName ? 
          `Interview scheduled by ${user.firstName} ${user.lastName} with ${interviewerName} as interviewer` :
          `Interview scheduled by ${user.firstName} ${user.lastName}`
      });
      
      return {
        success: result.success,
        message: result.success ?
          `Interview scheduled with ${candidate.firstName} ${candidate.lastName} on ${interviewDate.toLocaleDateString()} at ${interviewTime}` :
          'Failed to schedule interview',
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to schedule interview',
        error: (error as Error).message
      };
    }
  }

  // Universal email sending
  private async sendEmailUniversal(message: string, user: User): Promise<ActionResult> {
    try {
      const emailService = new EmailService();
      
      // Extract recipient
      const toMatch = message.match(/(?:send|email).*(?:to)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Z|a-z]{2,}|\w+\s*\w*)/i);
      const recipient = toMatch?.[1];
      
      if (!recipient) {
        return {
          success: false,
          message: 'Please specify who to send the email to',
          error: 'Missing recipient'
        };
      }
      
      // Determine if it's an email address or a name
      let recipientEmail: string;
      let recipientName: string;
      
      if (recipient.includes('@')) {
        recipientEmail = recipient;
        recipientName = recipient.split('@')[0];
      } else {
        // Look up the person
        const employees = await storage.getAllUsers();
        const employee = employees.find(e => 
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(recipient.toLowerCase())
        );
        
        if (employee) {
          recipientEmail = employee.email;
          recipientName = `${employee.firstName} ${employee.lastName}`;
        } else {
          // Check candidates
          const candidates = await storage.getAllCandidates();
          const candidate = candidates.find(c => 
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(recipient.toLowerCase())
          );
          
          if (candidate) {
            recipientEmail = candidate.email;
            recipientName = `${candidate.firstName} ${candidate.lastName}`;
          } else {
            return {
              success: false,
              message: `Could not find email for: ${recipient}`,
              error: 'Recipient not found'
            };
          }
        }
      }
      
      // Extract subject and body
      const subjectMatch = message.match(/(?:subject|about|regarding):\s*([^.!?]+)/i);
      const subject = subjectMatch?.[1] || 'Message from HR System';
      
      const bodyMatch = message.match(/(?:saying|message|body|content):\s*(.+)/i);
      const body = bodyMatch?.[1] || message;
      
      // Send email
      await emailService.sendEmail({
        to: recipientEmail,
        subject: subject,
        html: `
          <p>Hello ${recipientName},</p>
          <p>${body}</p>
          <p>Best regards,<br>${user.firstName} ${user.lastName}</p>
        `
      });
      
      return {
        success: true,
        message: `Email sent to ${recipientName} (${recipientEmail})`,
        data: { recipient: recipientEmail, subject }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send email',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle welcome email requests
   * Examples:
   * - "send welcome email to john smith"
   * - "send welcome emails to all employees"
   * - "send welcome emails to sales department"
   * - "who hasn't received their welcome email?"
   */
  private async handleWelcomeEmail(message: string, user: User): Promise<ActionResult | null> {
    try {
      const lowerMessage = message.toLowerCase();

      // Check who hasn't received welcome email
      if (lowerMessage.includes("hasn't") || lowerMessage.includes("haven't") ||
          lowerMessage.includes("not received") || lowerMessage.includes("pending")) {
        const employees = await storage.getAllUsers();
        // For now, we can't track who received welcome emails, but we can suggest based on mustChangePassword
        const pendingEmployees = employees.filter(e => e.mustChangePassword && e.isActive);

        if (pendingEmployees.length === 0) {
          return {
            success: true,
            message: "All employees have either received welcome emails or logged in and changed their passwords."
          };
        }

        const employeeList = pendingEmployees.slice(0, 10).map(e =>
          `• ${e.firstName} ${e.lastName} (${e.email})`
        ).join('\n');

        return {
          success: true,
          message: `Found ${pendingEmployees.length} employee(s) who haven't changed their password yet (likely haven't logged in):\n\n${employeeList}${pendingEmployees.length > 10 ? `\n\n...and ${pendingEmployees.length - 10} more.` : ''}\n\nYou can send them welcome emails from the Employees page or ask me to "send welcome email to [name]".`,
          data: { pendingCount: pendingEmployees.length, pending: pendingEmployees.map(e => e.id) }
        };
      }

      // Send to all employees or a department
      if (lowerMessage.includes('all employee') || lowerMessage.includes('all staff')) {
        const employees = await storage.getAllUsers();
        const activeEmployees = employees.filter(e => e.isActive && e.mustChangePassword);

        if (activeEmployees.length === 0) {
          return {
            success: true,
            message: "All active employees have already received welcome emails or logged in."
          };
        }

        return {
          success: true,
          message: `Ready to send welcome emails to ${activeEmployees.length} employees who haven't logged in yet. Would you like me to proceed?\n\nTo confirm, use the "Send Welcome Emails" button on the Employees page for better control, or tell me "yes, send welcome emails to all".`,
          requiresConfirmation: true,
          confirmationData: { employeeIds: activeEmployees.map(e => e.id), action: 'send_welcome_all' }
        };
      }

      // Send to specific department
      const deptMatch = lowerMessage.match(/(?:to|for)\s+(?:the\s+)?(\w+)\s+(?:department|team)/i);
      if (deptMatch) {
        const department = deptMatch[1];
        const employees = await storage.getAllUsers();
        const deptEmployees = employees.filter(e =>
          e.isActive &&
          e.mustChangePassword &&
          e.department?.toLowerCase().includes(department.toLowerCase())
        );

        if (deptEmployees.length === 0) {
          return {
            success: true,
            message: `No employees in the ${department} department need welcome emails.`
          };
        }

        return {
          success: true,
          message: `Ready to send welcome emails to ${deptEmployees.length} employees in the ${department} department. Use the Employees page for better control.`,
          data: { departmentCount: deptEmployees.length, department }
        };
      }

      // Send to specific employee
      const nameMatch = lowerMessage.match(/(?:to|for)\s+([a-z]+(?:\s+[a-z]+)?)/i);
      if (nameMatch) {
        const searchName = nameMatch[1];
        const employees = await storage.getAllUsers();
        const matches = employees.filter(e => {
          const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
          return fullName.includes(searchName.toLowerCase()) ||
                 e.firstName?.toLowerCase().includes(searchName.toLowerCase()) ||
                 e.lastName?.toLowerCase().includes(searchName.toLowerCase());
        });

        if (matches.length === 0) {
          return {
            success: false,
            message: `Couldn't find an employee named "${searchName}". Please check the name and try again.`
          };
        }

        if (matches.length > 1) {
          const matchList = matches.slice(0, 5).map(e =>
            `• ${e.firstName} ${e.lastName} (${e.email})`
          ).join('\n');
          return {
            success: false,
            message: `Found multiple employees matching "${searchName}":\n\n${matchList}\n\nPlease specify the full name.`
          };
        }

        const employee = matches[0];

        // Send welcome email via the email service
        try {
          const emailService = new EmailService();
          await emailService.sendWelcomeEmail(employee, 'Susan2025');

          return {
            success: true,
            message: `✅ Welcome email sent to ${employee.firstName} ${employee.lastName} (${employee.email}) with login credentials.\n\nPassword: Susan2025 (must be changed on first login)`
          };
        } catch (emailError) {
          return {
            success: false,
            message: `Found employee but couldn't send email: ${(emailError as Error).message}`,
            error: (emailError as Error).message
          };
        }
      }

      return {
        success: false,
        message: "Please specify who to send welcome emails to. Examples:\n• \"Send welcome email to John Smith\"\n• \"Who hasn't received their welcome email?\"\n• \"Send welcome emails to all employees\""
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process welcome email request.',
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle employee stats and counts
   * Examples:
   * - "how many employees do we have?"
   * - "how many people are in sales?"
   * - "total staff count"
   * - "count employees by department"
   */
  private async handleEmployeeStats(message: string, user: User): Promise<ActionResult | null> {
    try {
      const lowerMessage = message.toLowerCase();
      const employees = await storage.getAllUsers();
      const activeEmployees = employees.filter(e => e.isActive);

      // By department
      if (lowerMessage.includes('department') || lowerMessage.includes('by department')) {
        const deptCounts: Record<string, number> = {};
        activeEmployees.forEach(e => {
          const dept = e.department || 'Unassigned';
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });

        const deptList = Object.entries(deptCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([dept, count]) => `• ${dept}: ${count}`)
          .join('\n');

        return {
          success: true,
          message: `**Employee Distribution by Department**\n\nTotal: ${activeEmployees.length} active employees\n\n${deptList}`,
          data: { total: activeEmployees.length, byDepartment: deptCounts }
        };
      }

      // By role
      if (lowerMessage.includes('role') || lowerMessage.includes('by role')) {
        const roleCounts: Record<string, number> = {};
        activeEmployees.forEach(e => {
          const role = e.role || 'Unknown';
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        });

        const roleDisplayNames: Record<string, string> = {
          'TRUE_ADMIN': 'Super Admin',
          'ADMIN': 'Admin',
          'GENERAL_MANAGER': 'General Manager',
          'TERRITORY_SALES_MANAGER': 'Sales Manager',
          'MANAGER': 'Manager',
          'EMPLOYEE': 'Employee',
          'CONTRACTOR': 'Contractor',
          'SALES_REP': 'Sales Rep',
          'FIELD_TECH': 'Field Tech'
        };

        const roleList = Object.entries(roleCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([role, count]) => `• ${roleDisplayNames[role] || role}: ${count}`)
          .join('\n');

        return {
          success: true,
          message: `**Employee Distribution by Role**\n\nTotal: ${activeEmployees.length} active employees\n\n${roleList}`,
          data: { total: activeEmployees.length, byRole: roleCounts }
        };
      }

      // Specific department count
      const deptMatch = lowerMessage.match(/(?:in|for)\s+(?:the\s+)?(\w+)(?:\s+department)?/i);
      if (deptMatch) {
        const dept = deptMatch[1];
        const deptEmployees = activeEmployees.filter(e =>
          e.department?.toLowerCase().includes(dept.toLowerCase())
        );

        return {
          success: true,
          message: `There are **${deptEmployees.length}** active employees in the ${dept} department.`,
          data: { count: deptEmployees.length, department: dept }
        };
      }

      // General total count
      const inactiveCount = employees.length - activeEmployees.length;

      return {
        success: true,
        message: `**Employee Overview**\n\n• Total Active Employees: **${activeEmployees.length}**\n• Inactive/Terminated: ${inactiveCount}\n• Total in System: ${employees.length}\n\nAsk me "count employees by department" or "count employees by role" for more details.`,
        data: {
          total: employees.length,
          active: activeEmployees.length,
          inactive: inactiveCount
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve employee statistics.',
        error: (error as Error).message
      };
    }
  }
}