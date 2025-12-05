import { google } from 'googleapis';
import { googleAuthService } from './google-auth';

class GoogleDocsService {
  private docs: any;

  async initialize() {
    try {
      await googleAuthService.initialize();
      const auth = googleAuthService.getAuthClient();
      this.docs = google.docs({ version: 'v1', auth });
      console.log('[Google Docs] Service initialized with service account');
    } catch (error) {
      console.error('[Google Docs] Failed to initialize:', error);
      throw error;
    }
  }

  async createDocument(title: string, content?: string) {
    try {
      // Create the document
      const createResponse = await this.docs.documents.create({
        requestBody: {
          title
        }
      });

      const documentId = createResponse.data.documentId;

      // Add content if provided
      if (content) {
        await this.updateDocument(documentId, content);
      }

      console.log('[Google Docs] Document created:', documentId);
      return createResponse.data;
    } catch (error) {
      console.error('[Google Docs] Error creating document:', error);
      throw error;
    }
  }

  async updateDocument(documentId: string, content: string, index: number = 1) {
    try {
      const requests = [
        {
          insertText: {
            location: { index },
            text: content
          }
        }
      ];

      const response = await this.docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });

      console.log('[Google Docs] Document updated:', documentId);
      return response.data;
    } catch (error) {
      console.error('[Google Docs] Error updating document:', error);
      throw error;
    }
  }

  async getDocument(documentId: string) {
    try {
      const response = await this.docs.documents.get({ documentId });
      return response.data;
    } catch (error) {
      console.error('[Google Docs] Error getting document:', error);
      throw error;
    }
  }

  async createEmployeeContract(employee: any, contractDetails: any) {
    try {
      const contractContent = `
EMPLOYMENT CONTRACT

This Employment Agreement ("Agreement") is entered into as of ${new Date().toLocaleDateString()}, between ROOF-ER ("Company") and ${employee.firstName} ${employee.lastName} ("Employee").

1. POSITION AND DUTIES
Employee agrees to serve as ${contractDetails.position} and shall perform the duties and responsibilities as assigned by the Company.

2. COMPENSATION
Base Salary: $${contractDetails.salary?.toLocaleString() || 'TBD'} per year
Payment Schedule: ${contractDetails.paymentSchedule || 'Bi-weekly'}
Additional Benefits: ${contractDetails.benefits || 'As per company policy'}

3. EMPLOYMENT TYPE
Employment Type: ${contractDetails.employmentType || employee.employmentType}
Start Date: ${contractDetails.startDate || 'TBD'}
Work Location: ${contractDetails.location || 'Company Office'}

4. WORKING HOURS
Standard working hours are ${contractDetails.workingHours || '9:00 AM to 5:00 PM, Monday through Friday'}.

5. CONFIDENTIALITY
Employee agrees to maintain the confidentiality of all proprietary information and trade secrets of the Company.

6. TERMINATION
This agreement may be terminated by either party with ${contractDetails.noticePeriod || '30 days'} written notice.

7. BENEFITS
- Health Insurance: ${contractDetails.healthInsurance || 'Company-provided health insurance'}
- PTO: ${contractDetails.pto || 'As per company PTO policy'}
- Other Benefits: ${contractDetails.otherBenefits || 'As outlined in the employee handbook'}

8. ACKNOWLEDGMENT
By signing below, both parties acknowledge they have read, understood, and agree to be bound by the terms of this Agreement.

______________________________
Employee Signature
${employee.firstName} ${employee.lastName}
Date: _______________

______________________________
Company Representative
ROOF-ER
Date: _______________
      `.trim();

      const doc = await this.createDocument(
        `Employment Contract - ${employee.firstName} ${employee.lastName}`,
        contractContent
      );

      return doc;
    } catch (error) {
      console.error('[Google Docs] Error creating employee contract:', error);
      throw error;
    }
  }

  async createPerformanceReview(employee: any, review: any) {
    try {
      const reviewContent = `
PERFORMANCE REVIEW

Employee: ${employee.firstName} ${employee.lastName}
Position: ${employee.position}
Department: ${employee.department}
Review Period: ${review.period || 'Q' + Math.ceil(new Date().getMonth() / 3) + ' ' + new Date().getFullYear()}
Review Date: ${new Date().toLocaleDateString()}
Reviewer: ${review.reviewerName || 'Manager'}

OVERALL RATING: ${review.overallRating || 'Pending'}/5

PERFORMANCE AREAS:

1. Job Knowledge & Skills
Rating: ${review.jobKnowledge || 'N/A'}/5
Comments: ${review.jobKnowledgeComments || 'No comments provided'}

2. Quality of Work
Rating: ${review.qualityOfWork || 'N/A'}/5
Comments: ${review.qualityComments || 'No comments provided'}

3. Communication
Rating: ${review.communication || 'N/A'}/5
Comments: ${review.communicationComments || 'No comments provided'}

4. Teamwork
Rating: ${review.teamwork || 'N/A'}/5
Comments: ${review.teamworkComments || 'No comments provided'}

5. Initiative & Innovation
Rating: ${review.initiative || 'N/A'}/5
Comments: ${review.initiativeComments || 'No comments provided'}

ACHIEVEMENTS:
${review.achievements || '- No specific achievements noted'}

AREAS FOR IMPROVEMENT:
${review.improvements || '- No specific areas identified'}

GOALS FOR NEXT PERIOD:
${review.goals || '- Goals to be established'}

MANAGER'S COMMENTS:
${review.managerComments || 'No additional comments'}

EMPLOYEE'S COMMENTS:
${review.employeeComments || 'Employee has not provided comments'}

SIGNATURES:

______________________________
Employee Signature
Date: _______________

______________________________
Manager Signature
Date: _______________
      `.trim();

      const doc = await this.createDocument(
        `Performance Review - ${employee.firstName} ${employee.lastName} - ${new Date().toLocaleDateString()}`,
        reviewContent
      );

      return doc;
    } catch (error) {
      console.error('[Google Docs] Error creating performance review:', error);
      throw error;
    }
  }

  async exportToHTML(documentId: string) {
    try {
      const auth = googleAuthService.getAuthClient();
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.export({
        fileId: documentId,
        mimeType: 'text/html'
      });

      return response.data;
    } catch (error) {
      console.error('[Google Docs] Error exporting to HTML:', error);
      throw error;
    }
  }

  async exportToPDF(documentId: string) {
    try {
      const auth = googleAuthService.getAuthClient();
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.export({
        fileId: documentId,
        mimeType: 'application/pdf'
      }, { responseType: 'stream' });

      return response.data;
    } catch (error) {
      console.error('[Google Docs] Error exporting to PDF:', error);
      throw error;
    }
  }
}

export const googleDocsService = new GoogleDocsService();