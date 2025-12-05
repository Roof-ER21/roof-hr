import { storage } from '../storage';
import { CoiDocument } from '../../shared/schema';

export class CoiAlertService {
  /**
   * Check all COI documents and send appropriate alerts
   * Alerts are sent:
   * - 30 days before expiration (monthly alert)
   * - 14 days before expiration (two weeks alert)
   * - 7 days before expiration (weekly alert)
   * - 6 days to 0 days before expiration (daily alerts)
   * - After expiration (daily alerts continue)
   */
  async checkAndSendAlerts(): Promise<void> {
    try {
      const documents = await storage.getAllCoiDocuments();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const doc of documents) {
        await this.processDocumentAlerts(doc, today);
      }
    } catch (error) {
      console.error('Error in COI alert service:', error);
    }
  }

  private async processDocumentAlerts(doc: CoiDocument, today: Date): Promise<void> {
    const expirationDate = new Date(doc.expirationDate);
    expirationDate.setHours(0, 0, 0, 0);
    
    const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine alert frequency based on days until expiration
    let alertFrequency: 'MONTH_BEFORE' | 'TWO_WEEKS' | 'ONE_WEEK' | 'DAILY' | null = null;
    let shouldSendAlert = false;

    if (daysUntilExpiration === 30) {
      alertFrequency = 'MONTH_BEFORE';
      shouldSendAlert = true;
    } else if (daysUntilExpiration === 14) {
      alertFrequency = 'TWO_WEEKS';
      shouldSendAlert = true;
    } else if (daysUntilExpiration === 7) {
      alertFrequency = 'ONE_WEEK';
      shouldSendAlert = true;
    } else if (daysUntilExpiration <= 6) {
      // Daily alerts from 6 days before to after expiration
      alertFrequency = 'DAILY';
      shouldSendAlert = this.shouldSendDailyAlert(doc);
    }

    // Update document status
    let status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
    if (daysUntilExpiration < 0) {
      status = 'EXPIRED';
    } else if (daysUntilExpiration <= 30) {
      status = 'EXPIRING_SOON';
    }

    // Send alert if needed
    if (shouldSendAlert) {
      await this.sendAlert(doc, daysUntilExpiration);
      
      // Update the document with new alert info
      await storage.updateCoiDocument(doc.id, {
        status,
        alertFrequency,
        lastAlertSent: new Date()
      });
    } else if (status !== doc.status) {
      // Just update status if it changed
      await storage.updateCoiDocument(doc.id, { status });
    }
  }

  private shouldSendDailyAlert(doc: CoiDocument): boolean {
    if (!doc.lastAlertSent) {
      return true;
    }

    const lastAlert = new Date(doc.lastAlertSent);
    const now = new Date();
    
    // Check if last alert was sent today
    const isSameDay = 
      lastAlert.getDate() === now.getDate() &&
      lastAlert.getMonth() === now.getMonth() &&
      lastAlert.getFullYear() === now.getFullYear();
    
    return !isSameDay;
  }

  private async sendAlert(doc: CoiDocument, daysUntilExpiration: number): Promise<void> {
    // Get employee details
    const employee = await storage.getUserById(doc.employeeId);
    if (!employee) {
      console.error(`Employee not found for COI document: ${doc.id}`);
      return;
    }

    // Construct alert message
    let subject: string;
    let urgency: string;
    
    if (daysUntilExpiration < 0) {
      const daysExpired = Math.abs(daysUntilExpiration);
      subject = `URGENT: COI Document EXPIRED ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago`;
      urgency = 'CRITICAL';
    } else if (daysUntilExpiration === 0) {
      subject = 'URGENT: COI Document EXPIRES TODAY';
      urgency = 'CRITICAL';
    } else if (daysUntilExpiration <= 6) {
      subject = `URGENT: COI Document expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}`;
      urgency = 'HIGH';
    } else if (daysUntilExpiration === 7) {
      subject = 'COI Document expires in 1 week';
      urgency = 'MEDIUM';
    } else if (daysUntilExpiration === 14) {
      subject = 'COI Document expires in 2 weeks';
      urgency = 'MEDIUM';
    } else {
      subject = 'COI Document expires in 30 days';
      urgency = 'LOW';
    }

    const message = {
      to: employee.email,
      subject: `[${urgency}] ${subject} - ${doc.type.replace('_', ' ')}`,
      body: `
        Dear ${employee.firstName} ${employee.lastName},

        This is an automated reminder about your ${doc.type.replace('_', ' ')} Certificate of Insurance.
        
        Document Type: ${doc.type.replace('_', ' ')}
        Issue Date: ${doc.issueDate}
        Expiration Date: ${doc.expirationDate}
        ${daysUntilExpiration < 0 ? 
          `Status: EXPIRED (${Math.abs(daysUntilExpiration)} days overdue)` : 
          daysUntilExpiration === 0 ? 
            'Status: EXPIRES TODAY' :
            `Days Until Expiration: ${daysUntilExpiration}`
        }
        
        ${daysUntilExpiration <= 0 ? 
          'IMMEDIATE ACTION REQUIRED: Please upload a renewed certificate immediately.' :
          'Please ensure you renew this certificate before the expiration date.'
        }
        
        ${doc.notes ? `Notes: ${doc.notes}` : ''}
        
        Please log into the HR system to upload your renewed certificate.
        
        Thank you,
        HR Department
      `
    };

    // Log the alert (in production, this would send an actual email)
    console.log('COI Alert:', {
      employeeId: doc.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      documentType: doc.type,
      daysUntilExpiration,
      urgency,
      subject: message.subject
    });

    // In production, integrate with email service here
    // await emailService.send(message);
  }

  /**
   * Get alert summary for dashboard
   */
  async getAlertSummary(): Promise<{
    expired: number;
    expiringToday: number;
    expiringThisWeek: number;
    expiringThisMonth: number;
    total: number;
  }> {
    const documents = await storage.getAllCoiDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expired = 0;
    let expiringToday = 0;
    let expiringThisWeek = 0;
    let expiringThisMonth = 0;

    for (const doc of documents) {
      const expirationDate = new Date(doc.expirationDate);
      expirationDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiration < 0) {
        expired++;
      } else if (daysUntilExpiration === 0) {
        expiringToday++;
      } else if (daysUntilExpiration <= 7) {
        expiringThisWeek++;
      } else if (daysUntilExpiration <= 30) {
        expiringThisMonth++;
      }
    }

    return {
      expired,
      expiringToday,
      expiringThisWeek,
      expiringThisMonth,
      total: documents.length
    };
  }
}

export const coiAlertService = new CoiAlertService();